export type Rating = 'not_yet' | 'partial' | 'met'
export type Lane = 'lane1' | 'lane2'
export type AssessmentType = 'interactive_oral' | 'field_journal'
export type Principle = 'Engagement' | 'Representation' | 'Action & Expression'

export type DocumentType = 'brief' | 'rubric' | 'exemplar'

export interface AssessmentDocument {
  type: DocumentType
  filename: string
  extractedText: string
}

// One extracted item (brief/rubric/exemplar) the model found in an uploaded
// document. Wire shape shared by the extract route, the audit wrapper, and the
// picker modal - a single source of truth so it isn't redeclared per consumer.
export interface Candidate {
  title: string
  content: string
}

export interface Assessment {
  id: string
  name: string
  type: AssessmentType
  lane: Lane
  description: string
  documents: AssessmentDocument[]
  // User has no separate rubric file because the marking criteria are inside the brief.
  rubricInBrief?: boolean
  responses: Record<string, string>
}

export interface CheckpointDef {
  code: string
  principle: Principle
  guideline: string
  title: string
  description?: string
  question?: string
  harmful: string[]
  helpful: string[]
}

export interface CheckpointResult {
  checkpointId: string
  assessmentId: string
  aiRating: Rating
  aiReasoning: string
  userRating: Rating | null
  // true = user deferred to AI (Confirm suggestion / Accept all remaining)
  // false = user clicked a rating button themselves
  acceptedAI: boolean
}

export interface Suggestion {
  id: string                  // Stable UUID, assigned server-side
  text: string
  why: string
  udlCodes: string[]
  dismissed?: boolean         // User excluded this from active list and PDF
  done?: boolean              // User marked "I do this / I'll do this"
  userAuthored?: boolean      // User-added (no UDL chip rendered)
}

export interface Suggestions {
  quickWins: Suggestion[]
  longerTerm: Suggestion[]
}

export interface SessionState {
  assessments: Assessment[]
  checkpoints: CheckpointResult[]
  suggestions: Suggestions | null
  auditNotes: string
}

export type SessionAction =
  | { type: 'HYDRATE'; state: SessionState }
  | { type: 'SET_ASSESSMENTS'; assessments: Assessment[] }
  | { type: 'SET_CHECKPOINTS'; checkpoints: CheckpointResult[] }
  | { type: 'UPDATE_CHECKPOINT'; checkpointId: string; assessmentId: string; userRating: Rating; acceptedAI: boolean }
  | { type: 'SET_SUGGESTIONS'; suggestions: Suggestions }
  | { type: 'UPDATE_SUGGESTION'; id: string; patch: Partial<Pick<Suggestion, 'dismissed' | 'done'>> }
  | { type: 'ADD_SUGGESTION'; bucket: 'quickWins' | 'longerTerm'; suggestion: Suggestion }
  | { type: 'SET_AUDIT_NOTES'; notes: string }
  | { type: 'RESET' }

export interface UdlData {
  checkpoints: Record<string, CheckpointDef>
  assessmentTypes: Record<AssessmentType, string[]>
}

export interface PrincipleScore {
  principle: Principle
  label: string
  score: number
  total: number
  percentage: number
}

export interface GuidelineScore {
  principle: Principle
  guideline: string        // UDL guideline name, e.g. "Interaction"
  label: string            // display label (guideline name)
  score: number
  total: number
  percentage: number
}

// ── API wire contracts ─────────────────────────────────────────────────────
// Shared by the route handlers and the browser audit-client (lib/audit-client),
// so the two ends of each request can't drift. Responses: prefill -> CheckpointResult[],
// suggestions -> Suggestions, extract -> ExtractResponse.

export interface PrefillRequest {
  assessments: Assessment[]
  checkpointIds: string[]
}

export interface SuggestionsRequest {
  checkpoints: CheckpointResult[]
  assessments: Assessment[]
  focus?: string
}

export interface ExtractResponse {
  extractedText: string
  documentType: string | null
  candidates: Candidate[]
}
