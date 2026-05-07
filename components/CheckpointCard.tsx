'use client'

import { useState, useEffect } from 'react'
import type { CheckpointResult, CheckpointDef, Rating, Assessment } from '@/lib/types'

interface Props {
  result: CheckpointResult
  def: CheckpointDef
  assessment: Assessment
  onRate: (rating: Rating) => void
}

const RATING_OPTIONS: { value: Rating; label: string; help: string; color: string }[] = [
  { value: 'not_yet', label: 'Not yet', help: 'Absent or unclear from the brief', color: 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100' },
  { value: 'partial', label: 'Partially', help: 'Addressed in part - room to strengthen', color: 'border-amber text-teal bg-amber/10 hover:bg-amber/20' },
  { value: 'met', label: 'Met', help: 'Clearly supported by the assessment', color: 'border-green-400 text-green-800 bg-green-50 hover:bg-green-100' },
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
  // Terracotta = human agency (clicked a rating button directly)
  // Teal = deferred to AI (Confirm suggestion or Accept all remaining)
  const tickColor = result.acceptedAI ? 'text-teal' : 'text-terracotta'
  const tickLabel = result.acceptedAI ? 'AI accepted' : 'Your rating'

  return (
    <div className="bg-white rounded-2xl border border-sand p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="inline-block text-xs font-medium bg-teal/10 text-teal rounded px-2 py-0.5 mb-1.5">
            {def.principle} · {def.guideline}
          </span>
          <h2 className="font-display text-lg text-teal leading-snug">{def.code} - {def.title}</h2>
          <p className="text-xs text-teal/60 mt-0.5">Assessment: <strong>{assessment.name}</strong></p>
        </div>
        {/* Rated badge */}
        {rated && (
          <div className={`flex flex-col items-center shrink-0 mt-1 ${tickColor}`}>
            <span className="text-2xl leading-none">✓</span>
            <span className="text-xs font-medium mt-0.5 whitespace-nowrap">{tickLabel}</span>
          </div>
        )}
      </div>

      {def.description && (
        <p className="text-sm text-teal/80 leading-relaxed">{def.description}</p>
      )}

      {/* AI pre-fill */}
      <div className="rounded-lg bg-teal/5 border border-teal/10 p-3 space-y-1.5">
        <p className="text-xs font-semibold text-teal/70 uppercase tracking-wide">
          AI suggestion
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
        {result.userRating !== null && (
          <p className="text-xs text-teal/70 pt-1 border-t border-teal/10">
            <span className="font-medium">
              {result.acceptedAI ? 'You confirmed the AI suggestion.' : 'You changed it to'}
            </span>
            {!result.acceptedAI && (
              <span className={`inline-block ml-1 rounded px-2 py-0.5 text-[11px] font-bold ${
                result.userRating === 'met' ? 'bg-green-100 text-green-800' :
                result.userRating === 'partial' ? 'bg-amber/30 text-teal' :
                'bg-red-100 text-red-700'
              }`}>
                {result.userRating === 'met' ? 'Met' : result.userRating === 'partial' ? 'Partially' : 'Not yet'}
              </span>
            )}
          </p>
        )}
      </div>

      {/* Examples (collapsed) - generic patterns, NOT findings about the user's upload */}
      <details className="group rounded-lg border border-sand bg-cream/40">
        <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-teal/70 flex items-center justify-between hover:bg-cream/70 rounded-lg transition-colors">
          <span>Examples of patterns to watch for <span className="text-teal/40">· not findings about your upload</span></span>
          <span className="text-teal/40 text-xs group-open:rotate-180 transition-transform">▾</span>
        </summary>
        <div className="grid grid-cols-2 gap-2 p-2 pt-0">
          <div className="rounded-md border border-red-100 bg-red-50/50 p-2.5">
            <p className="text-[10px] font-semibold text-red-700/80 uppercase tracking-wide mb-1.5">Often harmful</p>
            <ul className="space-y-1">
              {def.harmful.map((h, i) => (
                <li key={i} className="text-xs text-red-800/90 flex gap-1.5 leading-snug">
                  <span className="shrink-0 mt-0.5">✗</span>
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-md border border-green-100 bg-green-50/50 p-2.5">
            <p className="text-[10px] font-semibold text-green-700/80 uppercase tracking-wide mb-1.5">Often helpful</p>
            <ul className="space-y-1">
              {def.helpful.map((h, i) => (
                <li key={i} className="text-xs text-green-800/90 flex gap-1.5 leading-snug">
                  <span className="shrink-0 mt-0.5">✓</span>
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </details>

      {/* Rating buttons */}
      <div>
        <p className="text-sm font-semibold text-teal">Select your rating</p>
        <p className="text-xs text-teal/50 mb-2">Confirm the AI suggestion or choose a different level</p>
        <div className="flex gap-2">
          {RATING_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onRate(opt.value)}
              title={opt.help}
              className={`flex-1 rounded-lg border-2 py-2 text-sm transition-all ${
                effectiveRating === opt.value ? SELECTED[opt.value] : opt.color
              }`}
            >
              <span className="block font-medium">{opt.label}</span>
              <span className="block text-[10px] font-normal opacity-75 mt-0.5 leading-tight">{opt.help}</span>
            </button>
          ))}
        </div>
        {/* Confirmation flash */}
        <p className={`text-xs text-center mt-1.5 transition-opacity duration-300 ${
          flash ? 'opacity-100' : 'opacity-0'
        } ${result.acceptedAI ? 'text-teal' : 'text-terracotta'}`}>
          ✓ {result.acceptedAI ? 'AI suggestion confirmed' : 'Your rating saved'}
        </p>
      </div>
    </div>
  )
}
