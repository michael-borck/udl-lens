'use client'

interface ExtractedAssessment {
  title: string
  description: string
}

interface Props {
  assessments: ExtractedAssessment[]
  onSelect: (assessment: ExtractedAssessment) => void
  onClose: () => void
}

export function AssessmentPickerModal({ assessments, onSelect, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-teal/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[80vh] flex flex-col">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-display text-xl text-teal">Multiple assessments found</h2>
            <p className="text-sm text-teal/60 mt-0.5">
              Select the one you&apos;re adding now - you can upload this file again for the others.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-teal/40 hover:text-teal transition-colors ml-4 shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto space-y-2">
          {assessments.map((a, i) => (
            <button
              key={i}
              onClick={() => onSelect(a)}
              className="w-full text-left rounded-xl border border-sand hover:border-teal/30 hover:bg-teal/5 p-4 transition-colors"
            >
              <p className="font-medium text-teal text-sm">{a.title}</p>
              <p className="text-xs text-teal/50 mt-1 line-clamp-2">{a.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
