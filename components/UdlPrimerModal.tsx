'use client'

import { useEffect, useRef, useState } from 'react'

// A "What is UDL?" trigger that opens a short UDL + A2030 primer in a modal.
// Self-contained (owns its open state) so it can be dropped into the server-
// rendered landing page as a client island. Content mirrors the /about page so
// the two stay in sync; keep them aligned if either changes.
export function UdlPrimerModal() {
  const [open, setOpen] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden' // lock background scroll while open
    closeRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-teal underline underline-offset-4 hover:text-terracotta-dark transition-colors"
      >
        What is UDL?
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-teal/30 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="udl-primer-title"
            className="relative bg-white rounded-2xl border border-sand shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col"
          >
            <div className="flex items-start justify-between gap-4 p-6 pb-3">
              <h2 id="udl-primer-title" className="font-display text-2xl text-teal">
                A quick UDL primer
              </h2>
              <button
                ref={closeRef}
                onClick={() => setOpen(false)}
                aria-label="Close primer"
                className="shrink-0 text-teal/60 hover:text-teal text-2xl leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/60 rounded"
              >
                ×
              </button>
            </div>

            <div className="overflow-y-auto px-6 pb-6 space-y-4 text-sm text-teal/80 leading-relaxed text-left">
              <p>
                <strong className="text-teal">Universal Design for Learning (UDL)</strong> is a framework
                for designing teaching and assessment so that <em>all</em> students can access, engage
                with, and demonstrate their learning - regardless of background, ability, or learning
                preference. It is published by CAST (UDL Guidelines 3.0).
              </p>

              <p className="font-medium text-teal">Three principles - the why, what, and how of learning:</p>
              <ul className="space-y-2">
                <li>
                  <strong className="text-teal">Engagement</strong> - the <em>why</em>: how learners are
                  motivated and supported.
                </li>
                <li>
                  <strong className="text-teal">Representation</strong> - the <em>what</em>: how content is
                  presented.
                </li>
                <li>
                  <strong className="text-teal">Action &amp; Expression</strong> - the <em>how</em>: how
                  learners show what they know.
                </li>
              </ul>
              <p>
                Each principle contains guidelines and checkpoints - the specific practices UDL Lens
                rates your assessment against.
              </p>

              <p className="font-medium text-teal">Assessment 2030 (A2030)</p>
              <p>Curtin&apos;s initiative to redesign assessment, built on a two-lane structure:</p>
              <ul className="space-y-2">
                <li>
                  <strong className="text-teal">Lane 1 (Secure)</strong> - e.g. interactive orals.
                </li>
                <li>
                  <strong className="text-teal">Lane 2 (Non-secure)</strong> - e.g. field journals with
                  media analysis.
                </li>
              </ul>
              <p>
                UDL Lens rates a curated set of UDL 3.0 checkpoints for each assessment type, so the
                audit stays grounded in the A2030 context.
              </p>

              <p>
                <strong className="text-teal">How it works here:</strong> you add an assessment; the AI
                gives each checkpoint a first-pass rating with a short justification - an evaluation to
                react to, not a verdict. You agree or change each one. You are judging how well the
                assessment supports learners, not whether it has passed or failed.
              </p>

              <p className="text-xs text-teal/70 pt-3 border-t border-sand">
                Full UDL Guidelines 3.0:{' '}
                <a
                  href="https://udlguidelines.cast.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-terracotta-dark underline hover:text-terracotta transition-colors"
                >
                  udlguidelines.cast.org
                </a>
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
