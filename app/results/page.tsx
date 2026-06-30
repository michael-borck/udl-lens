'use client'

import { useEffect, useState, useRef, useCallback, type ComponentType } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { ResetModal } from '@/components/ResetModal'
import { useSession } from '@/context/SessionContext'
import { suggestions as requestSuggestions } from '@/lib/audit-client'
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
  auditNotes: string
}

const PdfDownloadButton = dynamic<PdfDownloadButtonProps>(
  () => import('@/components/PdfReport').then((m: { PdfDownloadButton: ComponentType<PdfDownloadButtonProps> }) => m.PdfDownloadButton),
  {
    ssr: false,
    loading: () => (
      <button disabled className="rounded-lg border border-sand text-teal/70 px-5 py-2 text-sm">
        Preparing PDF…
      </button>
    ),
  }
)

export default function ResultsPage() {
  const router = useRouter()
  const { state, dispatch, hydrated } = useSession()
  const [showResetModal, setShowResetModal] = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [suggestionsError, setSuggestionsError] = useState(false)
  const fetchingSuggestions = useRef(false)

  const { assessments, checkpoints, suggestions } = state

  useEffect(() => {
    if (hydrated && assessments.length === 0) router.replace('/audit')
  }, [hydrated, assessments, router])

  const fetchSuggestions = useCallback(async (focus?: string) => {
    setLoadingSuggestions(true)
    setSuggestionsError(false)
    try {
      const data = await requestSuggestions({ checkpoints, assessments, focus })
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
    if (!hydrated) return
    if (suggestions || checkpoints.length === 0) return
    if (fetchingSuggestions.current) return
    fetchingSuggestions.current = true
    fetchSuggestions().finally(() => {
      fetchingSuggestions.current = false
    })
  }, [hydrated, suggestions, checkpoints, assessments, fetchSuggestions])

  function handleReset() {
    dispatch({ type: 'RESET' })
    router.push('/audit')
  }

  if (!hydrated || assessments.length === 0) return null

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
            <span className="text-teal/70">Select</span>
            <span className="text-teal/30">›</span>
            <span className="text-teal/70">Review</span>
            <span className="text-teal/30">›</span>
            <span className="font-medium text-teal">Results</span>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/review')}
            className="text-sm text-teal/70 underline hover:text-teal"
          >
            Edit responses
          </button>
          <button
            onClick={() => setShowResetModal(true)}
            className="text-sm text-terracotta-dark underline hover:text-terracotta-dark"
          >
            Start over
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12 space-y-12">
        {/* Hero */}
        <div className="rounded-2xl bg-teal text-white p-8">
          <div className="flex items-center justify-between gap-6">
            <div>
              <p className="text-white/70 text-sm mb-1">UDL audit for</p>
              <h2 className="font-display text-3xl mb-2">{unitName}</h2>
              <p className="text-white/85">{gradeLabel}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-display text-4xl font-bold">{overallScore}%</p>
              <p className="text-white/70 text-xs mt-1">UDL alignment</p>
            </div>
          </div>
          <p className="text-white/70 text-xs mt-4 leading-relaxed">
            Based on {checkpoints.length} UDL 3.0 checkpoint{checkpoints.length !== 1 ? 's' : ''} across {assessments.length} assessment{assessments.length !== 1 ? 's' : ''}.
            {assessments.length === 1 && " A single assessment can't represent a whole unit - add your other assessments for a fuller picture."}
          </p>
        </div>

        {/* Whole-of-unit hint - only the 0%-principle case; the single-assessment caveat sits at the hero now. */}
        {principleScores.some(s => s.percentage === 0) && (
          <div className="rounded-xl bg-amber/10 border border-amber/40 p-4 text-sm text-teal/80 leading-relaxed">
            <strong className="text-teal font-semibold">UDL is read across the whole unit.</strong>{' '}
            Principles showing 0% may reflect the focus of these assessment types rather than a unit-level gap. Adding more assessments from your unit can sharpen the picture.
          </div>
        )}

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

        {/* Audit notes */}
        <div className="bg-white rounded-2xl border border-sand p-6">
          <label htmlFor="audit-notes" className="block font-display text-xl text-teal mb-2">
            Audit notes
            <span className="ml-2 text-xs font-normal text-teal/70">(optional - included in the PDF)</span>
          </label>
          <p className="text-xs text-teal/70 mb-3 leading-relaxed">
            Add any context the AI couldn&apos;t infer - context for teaching support, links to your unit outline, planned next steps, anything you want captured in the report.
          </p>
          <textarea
            id="audit-notes"
            value={state.auditNotes}
            onChange={e => dispatch({ type: 'SET_AUDIT_NOTES', notes: e.target.value })}
            placeholder="Notes for teaching support, your portfolio, or future-you…"
            rows={4}
            className="w-full rounded-lg border border-sand px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/40 bg-cream/40 resize-none"
          />
        </div>

        {/* Suggestions */}
        <div>
          <h2 className="font-display text-2xl text-teal mb-6">Recommendations</h2>
          {loadingSuggestions && !suggestions ? (
            <div className="flex items-center gap-3 text-teal/70">
              <div className="w-5 h-5 border-2 border-teal/20 border-t-teal rounded-full animate-spin" />
              <span className="text-sm">AI is generating recommendations…</span>
            </div>
          ) : suggestionsError && !suggestions ? (
            <>
              <p className="text-sm text-terracotta-dark mb-3">
                AI suggestions are temporarily unavailable. The checkpoint data above is still accurate. You can retry, or add your own suggestions below.
              </p>
              <SuggestionsList
                suggestions={{ quickWins: [], longerTerm: [] }}
                onRegenerate={handleRegenerate}
                regenerating={loadingSuggestions}
              />
            </>
          ) : suggestions ? (
            <>
              {suggestionsError && (
                <p className="text-sm text-terracotta-dark mb-3">
                  Couldn&apos;t regenerate just now. Your existing suggestions are still here - try again in a moment.
                </p>
              )}
              <SuggestionsList
                suggestions={suggestions}
                onRegenerate={handleRegenerate}
                regenerating={loadingSuggestions}
              />
            </>
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
            auditNotes={state.auditNotes}
          />
          <p className="text-xs text-teal/70">
            PDF includes all checkpoints, ratings, and recommendations.
          </p>
        </div>

        {/* End-of-flow close */}
        <div className="rounded-2xl bg-teal text-white p-8 space-y-3">
          <h2 className="font-display text-2xl">Nice work - that&apos;s your UDL audit done.</h2>
          <div className="text-white/80 text-sm leading-relaxed">
            <ul className="list-disc pl-5 space-y-1">
              <li>Reviewed {checkpoints.filter(c => c.userRating !== null).length} of {checkpoints.length} UDL 3.0 checkpoints across {assessments.length} assessment{assessments.length !== 1 ? 's' : ''}.</li>
              <li>Kept the final call on every rating.</li>
              <li>Produced a shareable record of where {assessments.length > 1 ? 'this unit' : 'this assessment'} supports all learners and where it can grow.</li>
            </ul>
            <p className="font-medium text-white mt-3">That&apos;s real, evidenced UDL practice.</p>
          </div>
          <div className="text-white/80 text-sm leading-relaxed">
            <p className="font-semibold text-white mb-1">Good next steps:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Take the PDF to a Teaching Support conversation, or keep it as professional-development evidence.</li>
              <li>Action a quick win or two before the next study period, then re-run the audit to see the shift.</li>
              {assessments.length === 1 && (
                <li>Add the rest of your unit&apos;s assessments - UDL reads best across the whole unit.</li>
              )}
              <li>Reflect on this audit and use it as evidence of your commitment to teaching excellence in your iSoLT practices.</li>
            </ul>
          </div>
          <div className="flex flex-wrap gap-3 pt-1">
            <button
              onClick={() => router.push('/audit')}
              className="rounded-lg bg-white text-teal px-5 py-2 text-sm font-medium hover:bg-cream transition-colors"
            >
              Add or edit assessments
            </button>
            <button
              onClick={() => setShowResetModal(true)}
              className="rounded-lg border border-white/40 text-white px-5 py-2 text-sm font-medium hover:bg-white/10 transition-colors"
            >
              Start a new audit
            </button>
          </div>
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
