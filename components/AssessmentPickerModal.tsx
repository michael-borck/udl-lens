'use client'

import { useEffect, useRef } from 'react'
import type { Candidate } from '@/lib/types'

// Re-exported so existing importers (TypedDocumentSlots) keep their import path.
export type { Candidate }

interface Props {
  candidates: Candidate[]
  onSelect: (candidate: Candidate) => void
  onClose: () => void
  title?: string
}

export function AssessmentPickerModal({ candidates, onSelect, onClose, title = 'Multiple items found' }: Props) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeButtonRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="picker-title"
        className="bg-white rounded-2xl border border-sand max-w-lg w-full max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-sand flex items-center justify-between">
          <h2 id="picker-title" className="font-display text-xl text-teal">{title}</h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="text-teal/70 hover:text-teal text-xl leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/60 rounded"
            aria-label="Close picker"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {candidates.map((c, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(c)}
              className="w-full text-left rounded-lg border border-sand hover:border-teal/40 hover:bg-teal/5 px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/60"
            >
              <p className="font-medium text-teal">{c.title}</p>
              <p className="text-xs text-teal/70 mt-1">
                {c.content.length > 200 ? `${c.content.slice(0, 200)}…` : c.content}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
