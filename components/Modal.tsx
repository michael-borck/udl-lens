'use client'

import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  labelledById?: string
  children: ReactNode
}

// Shared modal chrome: backdrop, escape-to-close, click-outside, focus + scroll
// lock on open, role=dialog/aria-modal. Content modals (UdlPrimerModal,
// AboutModal) compose this so the accessibility behaviour stays in one place.
export function Modal({ open, onClose, title, labelledById = 'modal-title', children }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-teal/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledById}
        className="relative bg-white rounded-2xl border border-sand shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col"
      >
        <div className="flex items-start justify-between gap-4 p-6 pb-3">
          <h2 id={labelledById} className="font-display text-2xl text-teal">
            {title}
          </h2>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="shrink-0 text-teal/60 hover:text-teal text-2xl leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/60 rounded"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-6 pb-6 space-y-4 text-sm text-teal/80 leading-relaxed text-left">
          {children}
        </div>
      </div>
    </div>
  )
}
