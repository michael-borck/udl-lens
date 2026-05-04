import type { CheckpointResult, DimensionScore, Dimension } from '@/lib/types'
import { getCheckpointDef } from '@/lib/udl'

const DIMENSION_LABELS: Record<Dimension, string> = {
  representation: 'Representation',
  engagement: 'Engagement',
  expression: 'Expression',
  accessibility: 'Accessibility',
  flexibility: 'Flexibility',
  equity: 'Equity',
}

function ratingValue(rating: CheckpointResult['userRating'] | CheckpointResult['aiRating']): number {
  if (rating === 'met') return 1
  if (rating === 'partial') return 0.5
  return 0
}

export function computeDimensionScores(checkpoints: CheckpointResult[]): DimensionScore[] {
  const dimensions = Object.keys(DIMENSION_LABELS) as Dimension[]
  return dimensions.map(dimension => {
    const relevant = checkpoints.filter(c => {
      const def = getCheckpointDef(c.checkpointId)
      return def?.dimension === dimension
    })
    if (relevant.length === 0) {
      return { dimension, label: DIMENSION_LABELS[dimension], score: 0, total: 0, percentage: 0 }
    }
    const score = relevant.reduce((sum, c) => {
      const rating = c.userRating ?? c.aiRating
      return sum + ratingValue(rating)
    }, 0)
    const percentage = Math.round((score / relevant.length) * 100)
    return { dimension, label: DIMENSION_LABELS[dimension], score, total: relevant.length, percentage }
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
