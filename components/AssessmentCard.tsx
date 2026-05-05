import type { Assessment } from '@/lib/types'
import { getAssessmentTypeLabel } from '@/lib/udl'

interface Props {
  assessment: Assessment
  onEdit: () => void
  onRemove: () => void
}

export function AssessmentCard({ assessment, onEdit, onRemove }: Props) {
  const laneLabel = assessment.lane === 'lane1' ? 'Lane 1 — Secure' : 'Lane 2 — Non-secure'
  return (
    <div className="rounded-xl border border-sand bg-white p-5 flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="font-display text-lg font-semibold text-teal">{assessment.name}</p>
        <p className="text-sm text-teal/70 mt-0.5">
          {getAssessmentTypeLabel(assessment.type)} · {laneLabel}
        </p>
        {assessment.description && (
          <p className="text-sm text-teal/60 mt-2 line-clamp-2">{assessment.description}</p>
        )}
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={onEdit}
          className="text-sm text-teal/60 hover:text-teal underline"
        >
          Edit
        </button>
        <button
          onClick={onRemove}
          className="text-sm text-terracotta hover:text-terracotta-dark underline"
        >
          Remove
        </button>
      </div>
    </div>
  )
}
