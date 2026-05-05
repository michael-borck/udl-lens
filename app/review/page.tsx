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
  const [filterAssessmentId, setFilterAssessmentId] = useState<string | null>(null)
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
    const checkpointIds = getCheckpointIdsForAssessments(assessments)
    if (checkpointIds.length === 0) return
    setLoading(true)
    setPrefillError(null)
    try {
      const res = await fetch('/api/prefill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessments, checkpointIds }),
      })
      if (!res.ok) throw new Error('Prefill request failed')
      const data = await res.json() as CheckpointResult[]
      dispatch({ type: 'SET_CHECKPOINTS', checkpoints: data })
    } catch {
      setPrefillError('AI pre-fill is temporarily unavailable. You can still rate checkpoints manually.')
      // Create blank checkpoints so user can proceed
      const blank: CheckpointResult[] = []
      for (const a of assessments) {
        const ids = getCheckpointIdsForAssessments([a])
        for (const id of ids) {
          blank.push({
            checkpointId: id,
            assessmentId: a.id,
            aiRating: 'not_yet',
            aiReasoning: 'AI pre-fill unavailable.',
            userRating: null,
            overridden: false,
          })
        }
      }
      dispatch({ type: 'SET_CHECKPOINTS', checkpoints: blank })
    } finally {
      setLoading(false)
      prefilling.current = false
    }
  }, [assessments, checkpoints.length, dispatch])

  useEffect(() => {
    runPrefill()
  }, [runPrefill])

  const completedCount = checkpoints.filter(c => c.userRating !== null).length
  const allComplete = completedCount === checkpoints.length && checkpoints.length > 0

  function handleRate(rating: Rating) {
    const active = checkpoints[activeIndex]
    if (!active) return
    dispatch({
      type: 'UPDATE_CHECKPOINT',
      checkpointId: active.checkpointId,
      assessmentId: active.assessmentId,
      userRating: rating,
    })
    if (activeIndex < checkpoints.length - 1 && active.userRating === null) {
      setTimeout(() => setActiveIndex(i => i + 1), 250)
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
        <div className="bg-amber/20 border-b border-amber px-6 py-3 text-sm text-teal">
          {prefillError}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-teal/20 border-t-teal rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-teal/60">Claude is pre-filling checkpoint ratings…</p>
          </div>
        </div>
      ) : (
        <div className="flex h-[calc(100vh-73px)]">
          {/* Left nav */}
          <aside className="w-72 border-r border-sand bg-white flex flex-col overflow-hidden shrink-0">
            <div className="p-4 border-b border-sand">
              <ProgressBar completed={completedCount} total={checkpoints.length} />
            </div>
            {/* Assessment filter tabs */}
            <div className="flex gap-1 px-3 pt-3 pb-2 overflow-x-auto">
              <button
                onClick={() => setFilterAssessmentId(null)}
                className={`rounded-full px-3 py-1 text-xs whitespace-nowrap transition-colors ${
                  !filterAssessmentId ? 'bg-teal text-white' : 'text-teal/60 hover:bg-sand'
                }`}
              >
                All
              </button>
              {assessments.map(a => (
                <button
                  key={a.id}
                  onClick={() => setFilterAssessmentId(a.id === filterAssessmentId ? null : a.id)}
                  className={`rounded-full px-3 py-1 text-xs whitespace-nowrap transition-colors ${
                    filterAssessmentId === a.id ? 'bg-teal text-white' : 'text-teal/60 hover:bg-sand'
                  }`}
                >
                  {a.name}
                </button>
              ))}
            </div>
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
                {/* Prev/Next navigation */}
                <div className="flex justify-between mt-6">
                  <button
                    onClick={() => setActiveIndex(i => Math.max(0, i - 1))}
                    disabled={activeIndex === 0}
                    className="text-sm text-teal/60 hover:text-teal disabled:opacity-30 transition-colors"
                  >
                    ← Previous
                  </button>
                  <span className="text-xs text-teal/40">
                    {activeIndex + 1} of {checkpoints.length}
                  </span>
                  <button
                    onClick={() => setActiveIndex(i => Math.min(checkpoints.length - 1, i + 1))}
                    disabled={activeIndex === checkpoints.length - 1}
                    className="text-sm text-teal/60 hover:text-teal disabled:opacity-30 transition-colors"
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
