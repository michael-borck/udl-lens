'use client'

import { useState, useEffect } from 'react'
import type { CheckpointResult, CheckpointDef, Rating, Assessment } from '@/lib/types'

interface Props {
  result: CheckpointResult
  def: CheckpointDef
  assessment: Assessment
  onRate: (rating: Rating) => void
}

const RATING_OPTIONS: { value: Rating; label: string; color: string }[] = [
  { value: 'not_yet', label: 'Not yet', color: 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100' },
  { value: 'partial', label: 'Partially', color: 'border-amber text-teal bg-amber/10 hover:bg-amber/20' },
  { value: 'met', label: 'Met', color: 'border-green-400 text-green-800 bg-green-50 hover:bg-green-100' },
]

const SELECTED: Record<Rating, string> = {
  not_yet: 'border-red-400 bg-red-100 text-red-800 font-semibold ring-2 ring-red-300',
  partial: 'border-amber bg-amber/30 text-teal font-semibold ring-2 ring-amber/50',
  met: 'border-green-500 bg-green-100 text-green-900 font-semibold ring-2 ring-green-300',
}

export function CheckpointCard({ result, def, assessment, onRate }: Props) {
  const effectiveRating = result.userRating ?? null
  const [flash, setFlash] = useState(false)

  // Brief confirmation flash when a rating is set
  useEffect(() => {
    if (result.userRating !== null) {
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 1200)
      return () => clearTimeout(t)
    }
  }, [result.userRating])

  const rated = result.userRating !== null
  // Blue = user confirmed AI suggestion; green = user made their own call
  const tickColor = result.overridden ? 'text-green-600' : 'text-blue-500'
  const tickLabel = result.overridden ? 'Your rating' : 'AI confirmed'

  return (
    <div className="bg-white rounded-2xl border border-sand p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="inline-block text-xs font-medium bg-teal/10 text-teal rounded px-2 py-0.5 mb-2">
            {def.principle} · {def.dimension}
          </span>
          <h2 className="font-display text-xl text-teal">{def.code} — {def.title}</h2>
          <p className="text-sm text-teal/60 mt-1">Assessment: <strong>{assessment.name}</strong></p>
        </div>
        {/* Rated badge */}
        {rated && (
          <div className={`flex flex-col items-center shrink-0 mt-1 ${tickColor}`}>
            <span className="text-2xl leading-none">✓</span>
            <span className="text-xs font-medium mt-0.5 whitespace-nowrap">{tickLabel}</span>
          </div>
        )}
      </div>

      <p className="text-sm text-teal/80 leading-relaxed">{def.description}</p>

      {/* Harmful / Helpful */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-red-50 border border-red-100 p-4">
          <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">Harmful practices</p>
          <ul className="space-y-1.5">
            {def.harmful.map((h, i) => (
              <li key={i} className="text-xs text-red-800 flex gap-1.5">
                <span className="shrink-0 mt-0.5">✗</span>
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg bg-green-50 border border-green-100 p-4">
          <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">Helpful practices</p>
          <ul className="space-y-1.5">
            {def.helpful.map((h, i) => (
              <li key={i} className="text-xs text-green-800 flex gap-1.5">
                <span className="shrink-0 mt-0.5">✓</span>
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* AI pre-fill */}
      <div className="rounded-lg bg-teal/5 border border-teal/10 p-4">
        <p className="text-xs font-semibold text-teal/70 uppercase tracking-wide mb-1">
          AI suggestion {result.overridden && <span className="text-terracotta">(you changed this)</span>}
        </p>
        <p className="text-sm text-teal">
          <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold mr-2 ${
            result.aiRating === 'met' ? 'bg-green-100 text-green-800' :
            result.aiRating === 'partial' ? 'bg-amber/30 text-teal' :
            'bg-red-100 text-red-700'
          }`}>
            {result.aiRating === 'met' ? 'Met' : result.aiRating === 'partial' ? 'Partially' : 'Not yet'}
          </span>
          {result.aiReasoning}
        </p>
      </div>

      {/* Rating buttons */}
      <div>
        <p className="text-sm font-semibold text-teal mb-0.5">Select your rating</p>
        <p className="text-xs text-teal/50 mb-3">Confirm the AI suggestion or choose a different level</p>
        <div className="flex gap-3">
          {RATING_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onRate(opt.value)}
              className={`flex-1 rounded-lg border-2 py-2.5 text-sm transition-all ${
                effectiveRating === opt.value ? SELECTED[opt.value] : opt.color
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {/* Confirmation flash */}
        <p className={`text-xs text-center mt-2 transition-opacity duration-300 ${
          flash ? 'opacity-100' : 'opacity-0'
        } ${result.overridden ? 'text-green-600' : 'text-blue-500'}`}>
          ✓ {result.overridden ? 'Your rating saved' : 'AI suggestion confirmed'}
        </p>
      </div>
    </div>
  )
}
