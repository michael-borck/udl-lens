import type {
  CheckpointResult,
  DocumentType,
  ExtractResponse,
  PrefillRequest,
  Suggestions,
  SuggestionsRequest,
} from '@/lib/types'

// Browser-side seam for the three audit API routes. Owns the fetch, the ok-check,
// the JSON cast, and the error mapping, so call sites get a typed result and never
// hand-roll a request. The wire types live in lib/types and are shared with the
// route handlers, so client and server can't drift.

// Thrown on a non-ok response. `serverMessage` is the route's { error } string
// when present (e.g. 413 file-too-large, 429 rate-limited), so a caller can
// surface an actionable message instead of a generic one.
export class AuditClientError extends Error {
  constructor(readonly status: number, readonly serverMessage?: string) {
    super(`audit request failed (${status})`)
    this.name = 'AuditClientError'
  }
}

async function errorFor(res: Response): Promise<AuditClientError> {
  const serverMessage = await res
    .json()
    .then(d => (d as { error?: string })?.error)
    .catch(() => undefined)
  return new AuditClientError(res.status, serverMessage)
}

async function postJson<TRes>(url: string, body: unknown): Promise<TRes> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw await errorFor(res)
  return res.json() as Promise<TRes>
}

export function prefill(req: PrefillRequest): Promise<CheckpointResult[]> {
  return postJson<CheckpointResult[]>('/api/prefill', req)
}

export function suggestions(req: SuggestionsRequest): Promise<Suggestions> {
  return postJson<Suggestions>('/api/suggestions', req)
}

export async function extractDocument(file: File, documentType: DocumentType): Promise<ExtractResponse> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('documentType', documentType)
  const res = await fetch('/api/extract', { method: 'POST', body: fd })
  if (!res.ok) throw await errorFor(res)
  return res.json() as Promise<ExtractResponse>
}
