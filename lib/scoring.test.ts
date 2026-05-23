import { describe, it, expect } from 'vitest'
import { computeOverallScore, computePrincipleScores, getGradeLabel, scoreBand } from '@/lib/scoring'
import type { CheckpointResult, Rating } from '@/lib/types'

// Real checkpoint IDs from data/udl-checkpoints.json, grouped by principle:
//   Engagement:           io-8-3, fj-7-3
//   Representation:       io-2-4, fj-3-3
//   Action & Expression:  io-4-1, fj-5-2
function cp(checkpointId: string, aiRating: Rating, userRating: Rating | null = null): CheckpointResult {
  return {
    checkpointId,
    assessmentId: 'a1',
    aiRating,
    aiReasoning: '',
    userRating,
    acceptedAI: false,
  }
}

describe('computeOverallScore', () => {
  it('returns 0 for no checkpoints', () => {
    expect(computeOverallScore([])).toBe(0)
  })

  it('returns 100 when everything is met', () => {
    expect(computeOverallScore([cp('io-4-1', 'met'), cp('io-2-4', 'met')])).toBe(100)
  })

  it('returns 0 when everything is not_yet', () => {
    expect(computeOverallScore([cp('io-4-1', 'not_yet'), cp('io-2-4', 'not_yet')])).toBe(0)
  })

  it('scores partial as half', () => {
    expect(computeOverallScore([cp('io-4-1', 'partial'), cp('io-2-4', 'partial')])).toBe(50)
  })

  it('prefers userRating over aiRating', () => {
    // aiRating says not_yet, but the human set it to met -> should score 100
    expect(computeOverallScore([cp('io-4-1', 'not_yet', 'met')])).toBe(100)
  })

  it('rounds to the nearest percent', () => {
    // 1 met + 2 not_yet = 1/3 = 33.33% -> 33
    expect(computeOverallScore([cp('io-4-1', 'met'), cp('io-2-4', 'not_yet'), cp('io-8-3', 'not_yet')])).toBe(33)
  })
})

describe('computePrincipleScores', () => {
  it('returns the three principles in fixed order', () => {
    const scores = computePrincipleScores([])
    expect(scores.map(s => s.principle)).toEqual(['Engagement', 'Representation', 'Action & Expression'])
  })

  it('computes per-principle percentages and totals', () => {
    const scores = computePrincipleScores([
      cp('io-8-3', 'met'),      // Engagement      -> 100%
      cp('io-2-4', 'partial'),  // Representation  -> 50%
      cp('io-4-1', 'met'),      // Action & Expr   -> (1 + 0) / 2 = 50%
      cp('fj-5-2', 'not_yet'),  // Action & Expr
    ])
    const byPrinciple = Object.fromEntries(scores.map(s => [s.principle, s]))
    expect(byPrinciple['Engagement']).toMatchObject({ score: 1, total: 1, percentage: 100 })
    expect(byPrinciple['Representation']).toMatchObject({ score: 0.5, total: 1, percentage: 50 })
    expect(byPrinciple['Action & Expression']).toMatchObject({ score: 1, total: 2, percentage: 50 })
  })

  it('reports 0/0/0 for a principle with no checkpoints', () => {
    const scores = computePrincipleScores([cp('io-8-3', 'met')]) // Engagement only
    const rep = scores.find(s => s.principle === 'Representation')!
    expect(rep).toMatchObject({ score: 0, total: 0, percentage: 0 })
  })

  it('prefers userRating over aiRating per principle', () => {
    const scores = computePrincipleScores([cp('io-8-3', 'not_yet', 'met')])
    const eng = scores.find(s => s.principle === 'Engagement')!
    expect(eng.percentage).toBe(100)
  })
})

describe('getGradeLabel', () => {
  it.each([
    [100, 'Strong UDL Alignment'],
    [85, 'Strong UDL Alignment'],
    [84, 'Developing UDL Alignment'],
    [65, 'Developing UDL Alignment'],
    [64, 'Emerging UDL Alignment'],
    [40, 'Emerging UDL Alignment'],
    [39, 'UDL Alignment Needs Attention'],
    [0, 'UDL Alignment Needs Attention'],
  ])('maps %i%% to "%s"', (pct, label) => {
    expect(getGradeLabel(pct)).toBe(label)
  })
})

describe('scoreBand', () => {
  it.each([
    [100, 'strong'],
    [75, 'strong'],
    [74, 'developing'],
    [45, 'developing'],
    [44, 'attention'],
    [0, 'attention'],
  ] as const)('maps %i%% to %s', (pct, band) => {
    expect(scoreBand(pct)).toBe(band)
  })
})
