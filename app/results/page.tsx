'use client'

import { useEffect, useState, useRef, useCallback, type ComponentType } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { ResetModal } from '@/components/ResetModal'
import { useSession } from '@/context/SessionContext'
import { computePrincipleScores, computeOverallScore, getGradeLabel } from '@/lib/scoring'
import { ResultsRadarChart } from '@/components/ResultsRadarChart'
import { DimensionBars } from '@/components/DimensionBars'
import { SuggestionsList } from '@/components/SuggestionsList'
import type { Suggestions, CheckpointResult, Assessment, PrincipleScore } from '@/lib/types'

// ── Placeholder types for components added in Tasks 11 and 12 ──────────────
interface PdfDownloadButtonProps {
  checkpoints: CheckpointResult[]
  assessments: Assessment[]
  principleScores: PrincipleScore[]
  overallScore: number
  gradeLabel: string
  suggestions: Suggestions | null
}

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
  const fetchingSuggestions = useRef(false)

  const { assessments, checkpoints, suggestions } = state

  useEffect(() => {
    if (assessments.length === 0) router.replace('/audit')
  }, [assessments, router])

  const fetchSuggestions = useCallback(async (focus?: string) => {
    setLoadingSuggestions(true)
    setSuggestionsError(false)
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkpoints, assessments, focus }),
      })
      if (!res.ok) throw new Error('failed')
      const data = await res.json() as Suggestions
      dispatch({ type: 'SET_SUGGESTIONS', suggestions: data })
    } catch {
      setSuggestionsError(true)
    } finally {
      setLoadingSuggestions(false)
    }
  }, [checkpoints, assessments, dispatch])

  async function handleRegenerate(focus: string) {
    await fetchSuggestions(focus.trim() || undefined)
  }

  useEffect(() => {
    if (suggestions || checkpoints.length === 0) return
    if (fetchingSuggestions.current) return
    fetchingSuggestions.current = true
    fetchSuggestions().finally(() => {
      fetchingSuggestions.current = false
    })
  }, [suggestions, checkpoints, assessments, fetchSuggestions])

  function handleReset() {
    dispatch({ type: 'RESET' })
    router.push('/audit')
  }

  if (assessments.length === 0) return null

  const principleScores = computePrincipleScores(checkpoints)
  const overallScore = computeOverallScore(checkpoints)
  const gradeLabel = getGradeLabel(overallScore)
  const unitName = assessments.map(a => a.name).join(', ')

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-sand bg-white px-6 py-2.5 flex items-center justify-between">
        <div className="flex items-baseline gap-4">
          <h1 className="font-display text-lg text-teal">UDL Lens</h1>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-teal/40">Select</span>
            <span className="text-teal/30">›</span>
            <span className="text-teal/40">Review</span>
            <span className="text-teal/30">›</span>
            <span className="font-medium text-teal">Results</span>
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

        {/* Whole-of-unit hint */}
        {(() => {
          const hasZero = principleScores.some(s => s.percentage === 0)
          const singleAssessment = assessments.length === 1
          if (!hasZero && !singleAssessment) return null
          return (
            <div className="rounded-xl bg-amber/10 border border-amber/40 p-4 text-sm text-teal/80 leading-relaxed">
              <strong className="text-teal font-semibold">UDL is read across the whole unit.</strong>{' '}
              {singleAssessment
                ? "A single assessment usually can't address every principle on its own. Add your unit's other assessments for a fuller picture."
                : "Principles showing 0% may reflect the focus of these assessment types rather than a unit-level gap. Adding more assessments from your unit can sharpen the picture."}
            </div>
          )
        })()}

        {/* Radar + principle bars */}
        <div className="grid grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl border border-sand p-6">
            <h3 className="font-display text-xl text-teal mb-4">UDL Principles</h3>
            <ResultsRadarChart scores={principleScores} />
          </div>
          <div className="bg-white rounded-2xl border border-sand p-6">
            <h3 className="font-display text-xl text-teal mb-4">Breakdown</h3>
            <DimensionBars scores={principleScores} />
          </div>
        </div>

        {/* Suggestions */}
        <div>
          <h2 className="font-display text-2xl text-teal mb-6">Recommendations</h2>
          {loadingSuggestions ? (
            <div className="flex items-center gap-3 text-teal/60">
              <div className="w-5 h-5 border-2 border-teal/20 border-t-teal rounded-full animate-spin" />
              <span className="text-sm">AI is generating recommendations…</span>
            </div>
          ) : suggestionsError ? (
            <p className="text-sm text-terracotta">
              Suggestions are temporarily unavailable. The checkpoint data above is still accurate.
            </p>
          ) : suggestions ? (
            <SuggestionsList
              suggestions={suggestions}
              onRegenerate={handleRegenerate}
              regenerating={loadingSuggestions}
            />
          ) : null}
        </div>

        {/* Download */}
        <div className="pt-4 border-t border-sand flex items-center gap-4">
          <PdfDownloadButton
            checkpoints={checkpoints}
            assessments={assessments}
            principleScores={principleScores}
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
