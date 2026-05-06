'use client'

export interface Candidate {
  title: string
  content: string
}

interface Props {
  candidates: Candidate[]
  onSelect: (candidate: Candidate) => void
  onClose: () => void
  title?: string
}

export function AssessmentPickerModal({ candidates, onSelect, onClose, title = 'Multiple items found' }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl border border-sand max-w-lg w-full max-h-[80vh] flex flex-col">
        <div className="px-5 py-4 border-b border-sand flex items-center justify-between">
          <h2 className="font-display text-xl text-teal">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-teal/50 hover:text-teal text-xl leading-none"
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
              className="w-full text-left rounded-lg border border-sand hover:border-teal/40 hover:bg-teal/5 px-4 py-3 transition-colors"
            >
              <p className="font-medium text-teal">{c.title}</p>
              <p className="text-xs text-teal/60 mt-1">
                {c.content.length > 200 ? `${c.content.slice(0, 200)}…` : c.content}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
