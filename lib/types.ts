export type Rating = 'not_yet' | 'partial' | 'met'
export type Lane = 'lane1' | 'lane2'
export type Dimension =
  | 'representation'
  | 'engagement'
  | 'expression'
  | 'accessibility'
  | 'flexibility'
  | 'equity'

export interface Assessment {
  id: string
  name: string
  type: string
  lane: Lane
  description: string
}

export interface CheckpointDef {
  code: string
  principle: 'Representation' | 'Engagement' | 'Expression'
  dimension: Dimension
  title: string
  description: string
  harmful: string[]
  helpful: string[]
}

export interface CheckpointResult {
  checkpointId: string
  assessmentId: string
  aiRating: Rating
  aiReasoning: string
  userRating: Rating | null
  overridden: boolean
}

export interface Suggestions {
  quickWins: string[]
  longerTerm: string[]
}

export interface SessionState {
  assessments: Assessment[]
  checkpoints: CheckpointResult[]
  suggestions: Suggestions | null
}

export type SessionAction =
  | { type: 'SET_ASSESSMENTS'; assessments: Assessment[] }
  | { type: 'SET_CHECKPOINTS'; checkpoints: CheckpointResult[] }
  | { type: 'UPDATE_CHECKPOINT'; checkpointId: string; assessmentId: string; userRating: Rating }
  | { type: 'SET_SUGGESTIONS'; suggestions: Suggestions }
  | { type: 'RESET' }

export interface UdlData {
  checkpoints: Record<string, CheckpointDef>
  assessmentTypes: Record<string, string[]>
}

export interface DimensionScore {
  dimension: Dimension
  label: string
  score: number
  total: number
  percentage: number
}
