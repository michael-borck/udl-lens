'use client'

import { useEffect, useState, type ComponentType } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useSession } from '@/context/SessionContext'
import { computeDimensionScores, computeOverallScore, getGradeLabel } from '@/lib/scoring'
import { ResultsRadarChart } from '@/components/ResultsRadarChart'
import { DimensionBars } from '@/components/DimensionBars'
import { CheckpointTable } from '@/components/CheckpointTable'
import { SuggestionsList } from '@/components/SuggestionsList'
import type { Suggestions, CheckpointResult, Assessment, DimensionScore } from '@/lib/types'

// ── Placeholder types for components added in Tasks 11 and 12 ──────────────
interface ResetModalProps { onConfirm: () => void; onCancel: () => void }
interface PdfDownloadButtonProps {
  checkpoints: CheckpointResult[]
  assessments: Assessment[]
  dimensionScores: DimensionScore[]
  overallScore: number
  gradeLabel: string
  suggestions: Suggestions | null
}

const ResetModal = dynamic<ResetModalProps>(() => import('@/components/ResetModal').then(m => m.ResetModal), { ssr: false })

const PdfDownloadButton = dynamic<PdfDownloadButtonProps>(
  () => import('@/components/PdfReport').then((m: { PdfDownloadButton: ComponentType<PdfDownloadButtonProps> }) => m.PdfDownloadButton),
  {
    ssr: false,
    loading: () => (
      <button disabled className="rounded-lg border border-sand text-teal/40 px-5 py-2 text-sm">
        Preparing PDF…
      </button>
    ),
  }
)

export default function ResultsPage() {
  const router = useRouter()
  const { state, dispatch } = useSession()
  const [showResetModal, setShowResetModal] = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [suggestionsError, setSuggestionsError] = useState(false)

  const { assessments, checkpoints, suggestions } = state

  useEffect(() => {
    if (assessments.length === 0) router.replace('/')
  }, [assessments, router])

  useEffect(() => {
    if (suggestions || checkpoints.length === 0) return
    setLoadingSuggestions(true)
    setSuggestionsError(false)
    fetch('/api/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkpoints, assessments }),
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: Suggestions) => dispatch({ type: 'SET_SUGGESTIONS', suggestions: data }))
      .catch(() => setSuggestionsError(true))
      .finally(() => setLoadingSuggestions(false))
  }, [suggestions, checkpoints, assessments, dispatch])

  function handleReset() {
    dispatch({ type: 'RESET' })
    router.push('/')
  }

  if (assessments.length === 0) return null

  const dimensionScores = computeDimensionScores(checkpoints)
  const overallScore = computeOverallScore(checkpoints)
  const gradeLabel = getGradeLabel(overallScore)
  const unitName = assessments.map(a => a.name).join(', ')

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-sand bg-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl text-teal">UDL Lens</h1>
          <div className="flex items-center gap-2 mt-1 text-sm">
            <span className="text-teal/40">Select Assessments</span>
            <span className="text-teal/30">›</span>
            <span className="text-teal/40">Review Checkpoints</span>
            <span className="text-teal/30">›</span>
            <span className="font-medium text-teal">Your Results</span>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/review')}
            className="text-sm text-teal/60 underline hover:text-teal"
          >
            Edit responses
          </button>
          <button
            onClick={() => setShowResetModal(true)}
            className="text-sm text-terracotta underline hover:text-terracotta-dark"
          >
            Start over
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12 space-y-12">
        {/* Hero */}
        <div className="rounded-2xl bg-teal text-white p-8 flex items-center justify-between">
          <div>
            <p className="text-white/60 text-sm mb-1">UDL audit for</p>
            <h2 className="font-display text-3xl mb-2">{unitName}</h2>
            <p className="text-white/70">{gradeLabel}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-6xl font-bold">{overallScore}%</p>
            <p className="text-white/50 text-sm mt-1">overall UDL alignment</p>
          </div>
        </div>

        {/* Radar + dimension bars */}
        <div className="grid grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl border border-sand p-6">
            <h3 className="font-display text-xl text-teal mb-4">UDL Dimensions</h3>
            <ResultsRadarChart scores={dimensionScores} />
          </div>
          <div className="bg-white rounded-2xl border border-sand p-6">
            <h3 className="font-display text-xl text-teal mb-4">Breakdown</h3>
            <DimensionBars scores={dimensionScores} />
          </div>
        </div>

        {/* Suggestions */}
        <div>
          <h2 className="font-display text-2xl text-teal mb-6">Recommendations</h2>
          {loadingSuggestions ? (
            <div className="flex items-center gap-3 text-teal/60">
              <div className="w-5 h-5 border-2 border-teal/20 border-t-teal rounded-full animate-spin" />
              <span className="text-sm">Claude is generating recommendations…</span>
            </div>
          ) : suggestionsError ? (
            <p className="text-sm text-terracotta">
              Suggestions are temporarily unavailable. The checkpoint data above is still accurate.
            </p>
          ) : suggestions ? (
            <SuggestionsList suggestions={suggestions} />
          ) : null}
        </div>

        {/* Checkpoint table */}
        <div>
          <h2 className="font-display text-2xl text-teal mb-4">All Checkpoints</h2>
          <CheckpointTable checkpoints={checkpoints} assessments={assessments} />
        </div>

        {/* Download */}
        <div className="pt-4 border-t border-sand flex items-center gap-4">
          <PdfDownloadButton
            checkpoints={checkpoints}
            assessments={assessments}
            dimensionScores={dimensionScores}
            overallScore={overallScore}
            gradeLabel={gradeLabel}
            suggestions={suggestions}
          />
          <p className="text-xs text-teal/40">
            PDF includes all checkpoints, ratings, and recommendations.
          </p>
        </div>
      </div>

      {showResetModal && (
        <ResetModal
          onConfirm={handleReset}
          onCancel={() => setShowResetModal(false)}
        />
      )}
    </main>
  )
}
