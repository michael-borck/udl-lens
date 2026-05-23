import Anthropic from '@anthropic-ai/sdk'

// Single lazily-constructed client. Lazy so importing this module (e.g. in tests)
// doesn't require ANTHROPIC_API_KEY at import time - the key is only needed when
// the default transport actually calls the model.
let client: Anthropic | null = null
export function getClient(): Anthropic {
  if (!client) client = new Anthropic()
  return client
}

export type ModelKind = 'extract' | 'prefill' | 'suggestions'
const MODEL_ENV: Record<ModelKind, string> = {
  extract: 'EXTRACT_MODEL',
  prefill: 'PREFILL_MODEL',
  suggestions: 'SUGGESTIONS_MODEL',
}

// Per-route override -> global override -> default. Keeps the provider/model
// swappable per deployment without touching route code.
export function resolveModel(kind: ModelKind): string {
  return process.env[MODEL_ENV[kind]] ?? process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6'
}

// Models sometimes wrap JSON in ```json fences. Strip a leading/trailing fence,
// then parse. Throws if the remaining text is not valid JSON. Internal to the
// completeJson pipeline; exported only so it can be tested directly.
export function parseJsonResponse<T = unknown>(text: string): T {
  const jsonText = text.trim()
    .replace(/^```(?:json)?\n?/, '')
    .replace(/\n?```$/, '')
  return JSON.parse(jsonText) as T
}

type ContentBlock = { type: string; text?: string }

// Pull the first text block out of a model response. Throws if there isn't one.
// Used by the default transport; exported only so it can be tested directly.
export function getResponseText(content: ContentBlock[]): string {
  const block = content.find(b => b.type === 'text')
  if (!block || block.type !== 'text' || typeof block.text !== 'string') {
    throw new Error('No text response from model')
  }
  return block.text
}

// ── Transport seam ─────────────────────────────────────────────────────────
// The one place the model is substitutable. The default transport wraps the
// Anthropic SDK (build messages -> create -> extract text); tests install a fake
// that returns canned strings via _setTransport. Two adapters, one seam.

export type PdfAttachment = { kind: 'pdf'; base64: string }

export interface ModelRequest {
  model: string
  maxTokens: number
  // Optional cacheable prefix. `cache` adds a cache_control breakpoint - note
  // Sonnet 4.6 only caches prefixes >= ~2048 tokens; below that the marker is a
  // silent no-op (see lib/prompts.ts for why it's currently off).
  system?: { text: string; cache?: boolean }
  prompt: string
  attachments?: PdfAttachment[]
}

// A transport takes a normalised request and returns the model's text.
export type ModelTransport = (req: ModelRequest) => Promise<string>

async function anthropicTransport(req: ModelRequest): Promise<string> {
  const system: Anthropic.TextBlockParam[] | undefined = req.system
    ? [{
        type: 'text',
        text: req.system.text,
        ...(req.system.cache ? { cache_control: { type: 'ephemeral' as const } } : {}),
      }]
    : undefined

  const content: Anthropic.ContentBlockParam[] = [
    ...(req.attachments ?? []).map((a): Anthropic.ContentBlockParam => ({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: a.base64 },
    })),
    { type: 'text', text: req.prompt },
  ]

  const response = await getClient().messages.create({
    model: req.model,
    max_tokens: req.maxTokens,
    ...(system ? { system } : {}),
    messages: [{ role: 'user', content }],
  })
  return getResponseText(response.content)
}

let transport: ModelTransport = anthropicTransport

// Test seam: swap the transport for an in-memory fake. Mirrors the
// _resetRateLimitStore convention in lib/rate-limit.ts.
export function _setTransport(t: ModelTransport): void { transport = t }
export function _resetTransport(): void { transport = anthropicTransport }

// ── Errors ───────────────────────────────────────────────────────────────
// Thrown when every attempt is exhausted. Carries enough context for a route to
// decide its response (prefill -> 500, suggestions -> 503, extract -> 500).
export class ModelCallError extends Error {
  constructor(
    message: string,
    readonly cause: unknown,
    readonly attempts: number,
    readonly lastRaw: string | null,
  ) {
    super(message)
    this.name = 'ModelCallError'
  }
}

// ── The deep entry point ───────────────────────────────────────────────────
// Build messages -> call transport -> parse JSON -> validate, retrying when a
// strict validate throws. Two-phase: attempts 1..N-1 run the validator in strict
// mode (throw on imperfect output -> retry); the final attempt runs it leniently
// (coerce/salvage). If even the lenient attempt can't produce a value, throws
// ModelCallError. validate is supplied by the caller, so this module stays
// domain-agnostic.
export interface CompleteJsonOptions<T> {
  kind: ModelKind
  system?: { text: string; cache?: boolean }
  prompt: string
  attachments?: PdfAttachment[]
  maxTokens: number
  // Total tries. The last one is lenient. Default 2 (one strict, one lenient).
  maxAttempts?: number
  validate: (raw: unknown, opts: { strict: boolean }) => T
}

export async function completeJson<T>(o: CompleteJsonOptions<T>): Promise<T> {
  const maxAttempts = o.maxAttempts ?? 2
  const model = resolveModel(o.kind)
  let lastErr: unknown = null
  let lastRaw: string | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const strict = attempt < maxAttempts

    let raw: string
    try {
      raw = await transport({
        model,
        maxTokens: o.maxTokens,
        system: o.system,
        prompt: o.prompt,
        attachments: o.attachments,
      })
    } catch (err) {
      // Transport/network failure - nothing to salvage. Retry unless final.
      lastErr = err
      lastRaw = null
      if (attempt === maxAttempts) break
      continue
    }

    lastRaw = raw
    let parsed: unknown
    try {
      parsed = parseJsonResponse(raw)
    } catch (err) {
      // Not even JSON - the lenient validator can't salvage non-JSON, so a
      // parse failure on the final attempt propagates.
      lastErr = err
      if (attempt === maxAttempts) break
      continue
    }

    try {
      return o.validate(parsed, { strict })
    } catch (err) {
      lastErr = err
      if (attempt === maxAttempts) break
      // Strict validation failed - retry with a fresh model call.
    }
  }

  throw new ModelCallError('model call failed after retries', lastErr, maxAttempts, lastRaw)
}
