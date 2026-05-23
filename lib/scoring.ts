import type { CheckpointResult, PrincipleScore, Principle } from '@/lib/types'
import { getCheckpointDef } from '@/lib/udl'

const PRINCIPLES: Principle[] = ['Engagement', 'Representation', 'Action & Expression']

function ratingValue(rating: CheckpointResult['userRating'] | CheckpointResult['aiRating']): number {
  if (rating === 'met') return 1
  if (rating === 'partial') return 0.5
  return 0
}

export function computePrincipleScores(checkpoints: CheckpointResult[]): PrincipleScore[] {
  return PRINCIPLES.map(principle => {
    const relevant = checkpoints.filter(c => {
      const def = getCheckpointDef(c.checkpointId)
      return def?.principle === principle
    })
    if (relevant.length === 0) {
      return { principle, label: principle, score: 0, total: 0, percentage: 0 }
    }
    const score = relevant.reduce((sum, c) => {
      const rating = c.userRating ?? c.aiRating
      return sum + ratingValue(rating)
    }, 0)
    const percentage = Math.round((score / relevant.length) * 100)
    return { principle, label: principle, score, total: relevant.length, percentage }
  })
}

export function computeOverallScore(checkpoints: CheckpointResult[]): number {
  if (checkpoints.length === 0) return 0
  const total = checkpoints.reduce((sum, c) => {
    const rating = c.userRating ?? c.aiRating
    return sum + ratingValue(rating)
  }, 0)
  return Math.round((total / checkpoints.length) * 100)
}

export function getGradeLabel(percentage: number): string {
  if (percentage >= 85) return 'Strong UDL Alignment'
  if (percentage >= 65) return 'Developing UDL Alignment'
  if (percentage >= 40) return 'Emerging UDL Alignment'
  return 'UDL Alignment Needs Attention'
}

export type ScoreBand = 'strong' | 'developing' | 'attention'

// The per-principle colour band for a percentage - used by both the breakdown
// bars and the PDF, so the thresholds live in one place. Distinct from
// getGradeLabel, which bands the OVERALL score into grade text on a different
// scale (85/65/40); these are separate product judgements and are deliberately
// not unified here. Views map the band to their own colour vocabulary.
export function scoreBand(percentage: number): ScoreBand {
  if (percentage >= 75) return 'strong'
  if (percentage >= 45) return 'developing'
  return 'attention'
}
