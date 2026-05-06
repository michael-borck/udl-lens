'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/context/SessionContext'
import { getCheckpointIdsForAssessments, getCheckpointDef } from '@/lib/udl'
import { ProgressBar } from '@/components/ProgressBar'
import { CheckpointNav } from '@/components/CheckpointNav'
import { CheckpointCard } from '@/components/CheckpointCard'
import type { Rating, CheckpointResult } from '@/lib/types'

export default function ReviewPage() {
  const router = useRouter()
  const { state, dispatch } = useSession()
  const [activeIndex, setActiveIndex] = useState(0)
  const [filterAssessmentId, setFilterAssessmentId] = useState<string | null>(
    () => state.assessments[0]?.id ?? null
  )
  const [loading, setLoading] = useState(false)
  const [prefillError, setPrefillError] = useState<string | null>(null)

  const { assessments, checkpoints } = state

  useEffect(() => {
    if (assessments.length === 0) {
      router.replace('/audit')
    }
  }, [assessments, router])

  const prefilling = useRef(false)

  const runPrefill = useCallback(async () => {
    if (prefilling.current) return
    prefilling.current = true
    if (checkpoints.length > 0) {
      prefilling.current = false
      return
    }
    setLoading(true)
    setPrefillError(null)

    // Batch one API call per assessment — keeps responses small and isolates failures
    const allResults: CheckpointResult[] = []
    const failedAssessments: string[] = []

    for (const assessment of assessments) {
      const checkpointIds = getCheckpointIdsForAssessments([assessment])
      if (checkpointIds.length === 0) continue
      try {
        const res = await fetch('/api/prefill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assessments: [assessment], checkpointIds }),
        })
        if (!res.ok) throw new Error('Prefill request failed')
        const data = await res.json() as CheckpointResult[]
        allResults.push(...data)
      } catch {
        failedAssessments.push(assessment.name)
        for (const id of checkpointIds) {
          allResults.push({
            checkpointId: id,
            assessmentId: assessment.id,
            aiRating: 'not_yet',
            aiReasoning: 'AI pre-fill unavailable.',
            userRating: null,
            acceptedAI: false,
          })
        }
      }
    }

    dispatch({ type: 'SET_CHECKPOINTS', checkpoints: allResults })
    if (failedAssessments.length > 0) {
      setPrefillError(
        failedAssessments.length === assessments.length
          ? 'AI pre-fill is temporarily unavailable. You can retry or rate checkpoints manually.'
          : `AI pre-fill failed for: ${failedAssessments.join(', ')}. You can retry or rate those checkpoints manually.`
      )
    }

    setLoading(false)
    prefilling.current = false
  }, [assessments, checkpoints.length, dispatch])

  function handleRetryPrefill() {
    setPrefillError(null)
    prefilling.current = false
    dispatch({ type: 'SET_CHECKPOINTS', checkpoints: [] })
  }

  useEffect(() => {
    runPrefill()
  }, [runPrefill])

  const completedCount = checkpoints.filter(c => c.userRating !== null).length
  const remainingCount = checkpoints.length - completedCount
  const allComplete = completedCount === checkpoints.length && checkpoints.length > 0

  function handleRate(rating: Rating) {
    const active = checkpoints[activeIndex]
    if (!active) return
    dispatch({
      type: 'UPDATE_CHECKPOINT',
      checkpointId: active.checkpointId,
      assessmentId: active.assessmentId,
      userRating: rating,
      acceptedAI: false,
    })
    if (activeIndex < checkpoints.length - 1 && active.userRating === null) {
      setTimeout(() => setActiveIndex(i => i + 1), 400)
    }
  }

  function handleAcceptAI() {
    const active = checkpoints[activeIndex]
    if (!active) return
    dispatch({
      type: 'UPDATE_CHECKPOINT',
      checkpointId: active.checkpointId,
      assessmentId: active.assessmentId,
      userRating: active.aiRating,
      acceptedAI: true,
    })
    if (activeIndex < checkpoints.length - 1) {
      setTimeout(() => setActiveIndex(i => i + 1), 400)
    }
  }

  function handleAcceptAllRemaining() {
    const unreviewed = checkpoints.filter(c => c.userRating === null)
    for (const c of unreviewed) {
      dispatch({
        type: 'UPDATE_CHECKPOINT',
        checkpointId: c.checkpointId,
        assessmentId: c.assessmentId,
        userRating: c.aiRating,
        acceptedAI: true,
      })
    }
  }

  const activeCheckpoint = checkpoints[activeIndex]
  const activeDef = activeCheckpoint ? getCheckpointDef(activeCheckpoint.checkpointId) : null
  const activeAssessment = activeCheckpoint
    ? assessments.find(a => a.id === activeCheckpoint.assessmentId)
    : null

  if (assessments.length === 0) return null

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-sand bg-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl text-teal">UDL Lens</h1>
          <div className="flex items-center gap-2 mt-1 text-sm">
            <span className="text-teal/40">Select Assessments</span>
            <span className="text-teal/30">›</span>
            <span className="font-medium text-teal">Review Checkpoints</span>
            <span className="text-teal/30">›</span>
            <span className="text-teal/40">Your Results</span>
          </div>
        </div>
        {allComplete && (
          <button
            onClick={() => router.push('/results')}
            className="rounded-lg bg-terracotta text-white px-6 py-2 text-sm font-medium hover:bg-terracotta-dark transition-colors"
          >
            See results →
          </button>
        )}
      </header>

      {prefillError && (
        <div className="bg-amber/20 border-b border-amber px-6 py-3 text-sm text-teal flex items-center justify-between gap-4">
          <span>{prefillError}</span>
          <button
            onClick={handleRetryPrefill}
            className="shrink-0 rounded-lg border border-teal/30 px-3 py-1 text-xs hover:bg-teal/10 transition-colors"
          >
            Retry AI suggestions
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-teal/20 border-t-teal rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-teal/60">AI is pre-filling checkpoint ratings…</p>
          </div>
        </div>
      ) : (
        <div className="flex h-[calc(100vh-73px)]">
          {/* Left nav */}
          <aside className="w-72 border-r border-sand bg-white flex flex-col overflow-hidden shrink-0">
            <div className="p-4 border-b border-sand space-y-2">
              <ProgressBar completed={completedCount} total={checkpoints.length} />
              {!allComplete && (
                <p className="text-xs text-teal/50">
                  Rate all checkpoints to view your results
                </p>
              )}
              {/* Legend */}
              <div className="flex gap-3 text-xs text-teal/50 pt-1">
                <span className="flex items-center gap-1">
                  <span className="text-terracotta font-bold">✓</span> Your rating
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-teal font-bold">✓</span> AI accepted
                </span>
              </div>
              {/* Accept all remaining */}
              {remainingCount > 0 && (
                <button
                  onClick={handleAcceptAllRemaining}
                  className="w-full text-xs text-teal/60 hover:text-teal border border-teal/20 hover:border-teal/40 rounded-lg py-1.5 transition-colors"
                >
                  Accept AI for {remainingCount} remaining
                </button>
              )}
            </div>

            {/* Assessment filter tabs */}
            {assessments.length > 1 && (
              <div className="flex gap-1 px-3 pt-3 pb-2 overflow-x-auto">
                {assessments.map(a => (
                  <button
                    key={a.id}
                    onClick={() => setFilterAssessmentId(a.id)}
                    className={`rounded-full px-3 py-1 text-xs whitespace-nowrap transition-colors ${
                      filterAssessmentId === a.id ? 'bg-teal text-white' : 'text-teal/60 hover:bg-sand'
                    }`}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-3">
              <CheckpointNav
                checkpoints={checkpoints}
                activeIndex={activeIndex}
                onSelect={setActiveIndex}
                filterAssessmentId={filterAssessmentId}
              />
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 overflow-y-auto p-8">
            {activeCheckpoint && activeDef && activeAssessment ? (
              <div className="max-w-2xl mx-auto">
                <CheckpointCard
                  result={activeCheckpoint}
                  def={activeDef}
                  assessment={activeAssessment}
                  onRate={handleRate}
                />
                {/* Navigation: Previous / Confirm suggestion / Next */}
                <div className="flex items-center justify-between mt-6 gap-2">
                  <button
                    onClick={() => setActiveIndex(i => Math.max(0, i - 1))}
                    disabled={activeIndex === 0}
                    className="rounded-lg border border-sand px-4 py-1.5 text-sm text-teal/60 hover:text-teal hover:border-teal/30 disabled:opacity-30 transition-colors"
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={handleAcceptAI}
                    className="rounded-lg border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 px-4 py-1.5 text-sm font-medium transition-colors"
                  >
                    ✓ Confirm suggestion
                  </button>
                  <button
                    onClick={() => setActiveIndex(i => Math.min(checkpoints.length - 1, i + 1))}
                    disabled={activeIndex === checkpoints.length - 1}
                    className="rounded-lg border border-sand px-4 py-1.5 text-sm text-teal/60 hover:text-teal hover:border-teal/30 disabled:opacity-30 transition-colors"
                  >
                    Next →
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-teal/40">
                No checkpoints to show
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
