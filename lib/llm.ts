import Anthropic from '@anthropic-ai/sdk'
import type { Suggestions, Suggestion } from '@/lib/types'

// Single lazily-constructed client. Lazy so importing this module (e.g. in tests)
// doesn't require ANTHROPIC_API_KEY at import time - the key is only needed when
// a route actually calls the model.
let client: Anthropic | null = null
export function getClient(): Anthropic {
  if (!client) client = new Anthropic()
  return client
}

type ModelKind = 'extract' | 'prefill' | 'suggestions'
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
// then parse. Throws if the remaining text is not valid JSON (callers decide how
// to handle that - retry, 500, or treat as empty).
export function parseJsonResponse<T = unknown>(text: string): T {
  const jsonText = text.trim()
    .replace(/^```(?:json)?\n?/, '')
    .replace(/\n?```$/, '')
  return JSON.parse(jsonText) as T
}

type ContentBlock = { type: string; text?: string }

// Pull the first text block out of a model response. Throws if there isn't one.
export function getResponseText(content: ContentBlock[]): string {
  const block = content.find(b => b.type === 'text')
  if (!block || block.type !== 'text' || typeof block.text !== 'string') {
    throw new Error('No text response from model')
  }
  return block.text
}

// Narrows to the shape the LLM is allowed to return for a suggestion. The id is
// added server-side; curation flags (dismissed, done, userAuthored) are never
// accepted from the LLM.
type RawSuggestion = { text: string; why: string; udlCodes: string[] }

function isRawSuggestion(s: unknown): s is RawSuggestion {
  if (!s || typeof s !== 'object') return false
  const obj = s as Record<string, unknown>
  return typeof obj.text === 'string'
    && typeof obj.why === 'string'
    && Array.isArray(obj.udlCodes)
    && obj.udlCodes.every(c => typeof c === 'string')
}

// Explicit field pick prevents the LLM from injecting curation flags
// (e.g. dismissed: true) by hallucinating them in its JSON output.
export function sanitizeSuggestions(parsed: unknown): Suggestions {
  if (!parsed || typeof parsed !== 'object') return { quickWins: [], longerTerm: [] }
  const obj = parsed as Record<string, unknown>
  const withIds = (raw: unknown[]): Suggestion[] =>
    raw.filter(isRawSuggestion).map(s => ({
      id: crypto.randomUUID(),
      text: s.text,
      why: s.why,
      udlCodes: s.udlCodes,
    }))
  const quickWins = Array.isArray(obj.quickWins) ? withIds(obj.quickWins) : []
  const longerTerm = Array.isArray(obj.longerTerm) ? withIds(obj.longerTerm) : []
  return { quickWins, longerTerm }
}
