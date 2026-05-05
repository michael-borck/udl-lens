'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/context/SessionContext'
import { AssessmentCard } from '@/components/AssessmentCard'
import { AssessmentForm } from '@/components/AssessmentForm'
import type { Assessment } from '@/lib/types'

type FormMode = { mode: 'add' } | { mode: 'edit'; assessment: Assessment } | null

export default function SetupPage() {
  const router = useRouter()
  const { state, dispatch } = useSession()
  const [formMode, setFormMode] = useState<FormMode>(null)

  function handleSave(data: Omit<Assessment, 'id'> & { id?: string }) {
    if (data.id) {
      dispatch({
        type: 'SET_ASSESSMENTS',
        assessments: state.assessments.map(a =>
          a.id === data.id ? { ...data, id: data.id } : a
        ),
      })
    } else {
      dispatch({
        type: 'SET_ASSESSMENTS',
        assessments: [
          ...state.assessments,
          { ...data, id: crypto.randomUUID() },
        ],
      })
    }
    setFormMode(null)
  }

  function handleRemove(id: string) {
    dispatch({
      type: 'SET_ASSESSMENTS',
      assessments: state.assessments.filter(a => a.id !== id),
    })
  }

  function handleProceed() {
    router.push('/review')
  }

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-sand bg-teal text-white px-8 py-5">
        <h1 className="font-display text-2xl">UDL Lens</h1>
        <p className="text-sm text-white/70 mt-0.5">Assessment 2030 · UDL Guidelines 3.0 Audit</p>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8 text-sm">
          <span className="rounded-full bg-teal text-white w-6 h-6 flex items-center justify-center text-xs font-bold">1</span>
          <span className="font-medium text-teal">Select Assessments</span>
          <span className="text-teal/30 mx-1">›</span>
          <span className="text-teal/40">Review Checkpoints</span>
          <span className="text-teal/30 mx-1">›</span>
          <span className="text-teal/40">Your Results</span>
        </div>

        <h2 className="font-display text-3xl text-teal mb-2">What assessments are in your unit?</h2>
        <p className="text-teal/60 mb-8">
          Add each assessment separately. For each one, you can upload the assignment brief and Claude will pre-fill the UDL checkpoint ratings for you to verify.
        </p>

        {/* Assessment list */}
        <div className="space-y-3 mb-6">
          {state.assessments.map(a => (
            <AssessmentCard
              key={a.id}
              assessment={a}
              onEdit={() => setFormMode({ mode: 'edit', assessment: a })}
              onRemove={() => handleRemove(a.id)}
            />
          ))}
        </div>

        {/* Add form or button */}
        {formMode ? (
          <div className="rounded-xl border border-teal/20 bg-white p-6 mb-6">
            <h3 className="font-display text-lg text-teal mb-4">
              {formMode.mode === 'edit' ? 'Edit assessment' : 'Add assessment'}
            </h3>
            <AssessmentForm
              initial={formMode.mode === 'edit' ? formMode.assessment : undefined}
              onSave={handleSave}
              onCancel={() => setFormMode(null)}
            />
          </div>
        ) : (
          <button
            onClick={() => setFormMode({ mode: 'add' })}
            className="w-full rounded-xl border-2 border-dashed border-teal/20 text-teal/60 hover:border-teal/40 hover:text-teal py-4 text-sm transition-colors"
          >
            + Add assessment
          </button>
        )}

        {/* Proceed */}
        {state.assessments.length > 0 && !formMode && (
          <div className="mt-8 pt-8 border-t border-sand">
            <p className="text-sm text-teal/60 mb-4">
              {state.assessments.length} assessment{state.assessments.length !== 1 ? 's' : ''} added.
              Claude will pre-fill UDL ratings for each one &mdash; you&apos;ll verify and adjust them in the next step.
            </p>
            <button
              onClick={handleProceed}
              className="rounded-lg bg-terracotta text-white px-8 py-3 font-medium hover:bg-terracotta-dark transition-colors"
            >
              Review UDL checkpoints →
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
