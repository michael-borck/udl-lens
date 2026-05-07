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

export interface Assessment {
  id: string
  name: string
  type: AssessmentType
  lane: Lane
  description: string
  documents: AssessmentDocument[]
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
