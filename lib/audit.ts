import type {
  Assessment,
  Candidate,
  CheckpointResult,
  Rating,
  Suggestion,
  Suggestions,
} from '@/lib/types'
import { getCheckpointDef } from '@/lib/udl'
import { completeJson } from '@/lib/llm'
import {
  buildExtractPrompt,
  buildPrefillPrompt,
  buildSuggestionsPrompt,
  type CheckpointForPrompt,
} from '@/lib/prompts'

// The three model operations the audit pipeline runs (prefill, suggestions,
// extract), as thin typed wrappers over completeJson. Each bakes in its
// max_tokens, retry budget, and validator; call sites get a typed result and
// never touch the model call shape. The validators below define what "strict"
// means per operation - completeJson flips the strict flag, the validator
// decides what it implies.

const RATINGS: readonly Rating[] = ['not_yet', 'partial', 'met']

function coerceRating(r: unknown): Rating {
  return RATINGS.includes(r as Rating) ? (r as Rating) : 'not_yet'
}

// Prefill: strict throws on a non-array or an item missing its ids (-> retry).
// A bad rating enum is a recoverable per-item issue - coerced to not_yet in both
// modes so one odd item doesn't nuke the whole batch.
export function validatePrefill(raw: unknown, { strict }: { strict: boolean }): CheckpointResult[] {
  if (!Array.isArray(raw)) {
    if (strict) throw new Error('prefill: expected a JSON array')
    return []
  }
  const results: CheckpointResult[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      if (strict) throw new Error('prefill: item is not an object')
      continue
    }
    const o = item as Record<string, unknown>
    if (typeof o.checkpointId !== 'string' || typeof o.assessmentId !== 'string') {
      if (strict) throw new Error('prefill: item missing checkpointId/assessmentId')
      continue
    }
    results.push({
      checkpointId: o.checkpointId,
      assessmentId: o.assessmentId,
      aiRating: coerceRating(o.rating),
      aiReasoning: typeof o.reasoning === 'string' ? o.reasoning : '',
      userRating: null,
      acceptedAI: false,
    })
  }
  if (strict && results.length === 0) throw new Error('prefill: no usable items')
  return results
}

// Narrows to the shape the LLM is allowed to return for a suggestion. The id is
// added server-side; curation flags (dismissed, done, userAuthored) are never
// accepted from the LLM.
type RawSuggestion = { text: string; why: string; udlCodes: string[] }

function isRawSuggestion(s: unknown): s is RawSuggestion {
  if (!s || typeof s !== 'object') return false
  const o = s as Record<string, unknown>
  return typeof o.text === 'string'
    && typeof o.why === 'string'
    && Array.isArray(o.udlCodes)
    && o.udlCodes.every(c => typeof c === 'string')
}

// Suggestions: strict throws on the wrong envelope, a non-array bucket, a
// malformed item, or an entirely empty result (the model was asked about real
// gaps, so empty is a failure worth retrying). Lenient filters to valid items -
// the explicit field pick also prevents the LLM injecting curation flags.
export function validateSuggestions(raw: unknown, { strict }: { strict: boolean }): Suggestions {
  if (!raw || typeof raw !== 'object') {
    if (strict) throw new Error('suggestions: expected an object')
    return { quickWins: [], longerTerm: [] }
  }
  const o = raw as Record<string, unknown>
  const pick = (list: unknown): Suggestion[] => {
    if (!Array.isArray(list)) {
      if (strict) throw new Error('suggestions: bucket is not an array')
      return []
    }
    const out: Suggestion[] = []
    for (const s of list) {
      if (isRawSuggestion(s)) {
        out.push({ id: crypto.randomUUID(), text: s.text, why: s.why, udlCodes: s.udlCodes })
      } else if (strict) {
        throw new Error('suggestions: malformed item')
      }
    }
    return out
  }
  const quickWins = pick(o.quickWins)
  const longerTerm = pick(o.longerTerm)
  if (strict && quickWins.length === 0 && longerTerm.length === 0) {
    throw new Error('suggestions: no usable suggestions')
  }
  return { quickWins, longerTerm }
}

function isCandidate(c: unknown): c is Candidate {
  if (!c || typeof c !== 'object') return false
  const o = c as Record<string, unknown>
  return typeof o.title === 'string' && typeof o.content === 'string'
}

// Extract: strict throws on the wrong envelope, a non-array candidates field, or
// a malformed candidate (-> retry). An EMPTY candidates array is a legitimate
// answer ("no rubric in this document"), so it is success, not a retry trigger.
export function validateExtract(raw: unknown, { strict }: { strict: boolean }): Candidate[] {
  if (!raw || typeof raw !== 'object') {
    if (strict) throw new Error('extract: expected an object')
    return []
  }
  const list = (raw as Record<string, unknown>).candidates
  if (!Array.isArray(list)) {
    if (strict) throw new Error('extract: candidates is not an array')
    return []
  }
  const out: Candidate[] = []
  for (const c of list) {
    if (isCandidate(c)) out.push({ title: c.title, content: c.content })
    else if (strict) throw new Error('extract: malformed candidate')
  }
  return out
}

// Canned response when every checkpoint is already Met - no model call needed.
function allMetSuggestions(): Suggestions {
  const id = () => crypto.randomUUID()
  return {
    quickWins: [
      { id: id(), text: 'All checkpoints are rated Met - outstanding UDL alignment across your unit.', why: 'Your design already supports the full breadth of audited UDL principles.', udlCodes: [] },
      { id: id(), text: 'Consider sharing your assessment design as an exemplar with colleagues.', why: 'Strong UDL practice spreads when others can see what good looks like in context.', udlCodes: [] },
      { id: id(), text: 'Document your approach for your teaching portfolio as evidence of UDL practice.', why: 'Captures your inclusive design choices for review, promotion, or accreditation.', udlCodes: [] },
    ],
    longerTerm: [
      { id: id(), text: 'Explore UDL Guidelines 3.0 checkpoints beyond the ones audited here to deepen your practice.', why: 'The audited checkpoints are a curated subset; the full framework offers more dimensions to explore.', udlCodes: [] },
      { id: id(), text: 'Consider mentoring colleagues in UDL-aligned assessment design.', why: 'Your demonstrated practice is a teaching resource for the wider unit team.', udlCodes: [] },
    ],
  }
}

export async function runPrefill(
  assessment: Assessment,
  checkpoints: CheckpointForPrompt[],
): Promise<CheckpointResult[]> {
  const { system, prompt } = buildPrefillPrompt(assessment, checkpoints)
  return completeJson({
    kind: 'prefill',
    system,
    prompt,
    maxTokens: 8192,
    maxAttempts: 2, // expensive call - one strict try, then lenient salvage
    validate: validatePrefill,
  })
}

export async function runSuggestions(
  checkpoints: CheckpointResult[],
  assessments: Assessment[],
  focus?: string,
): Promise<Suggestions> {
  const allMet = checkpoints.every(c => (c.userRating ?? c.aiRating) === 'met')
  if (allMet) return allMetSuggestions()

  const { system, prompt } = buildSuggestionsPrompt(checkpoints, assessments, getCheckpointDef, focus)
  return completeJson({
    kind: 'suggestions',
    system,
    prompt,
    maxTokens: 1024,
    maxAttempts: 3, // cheap call - two strict tries before lenient salvage
    validate: validateSuggestions,
  })
}

export async function runExtract(
  content: { text: string } | { base64: string },
  docType: string | null,
): Promise<Candidate[]> {
  const system = buildExtractPrompt(docType)
  const isPdf = 'base64' in content
  return completeJson({
    kind: 'extract',
    system,
    prompt: isPdf ? 'Extract from the attached PDF document.' : `DOCUMENT:\n${content.text}`,
    attachments: isPdf ? [{ kind: 'pdf', base64: content.base64 }] : undefined,
    maxTokens: 2048,
    maxAttempts: 2,
    validate: validateExtract,
  })
}
