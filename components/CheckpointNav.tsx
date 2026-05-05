import type { CheckpointResult } from '@/lib/types'
import { getCheckpointDef } from '@/lib/udl'

interface Props {
  checkpoints: CheckpointResult[]
  activeIndex: number
  onSelect: (index: number) => void
  filterAssessmentId: string | null
}

function statusClass(result: CheckpointResult): string {
  const rating = result.userRating ?? null
  if (rating === null) return 'status-dot-pending'
  if (rating === 'met') return 'status-dot-met'
  if (rating === 'partial') return 'status-dot-partial'
  return 'status-dot-gap'
}

export function CheckpointNav({ checkpoints, activeIndex, onSelect, filterAssessmentId }: Props) {
  const visible = filterAssessmentId
    ? checkpoints.filter(c => c.assessmentId === filterAssessmentId)
    : checkpoints

  return (
    <nav className="space-y-1">
      {visible.map((result) => {
        const def = getCheckpointDef(result.checkpointId)
        const globalIdx = checkpoints.indexOf(result)
        const isActive = globalIdx === activeIndex
        return (
          <button
            key={`${result.checkpointId}-${result.assessmentId}`}
            onClick={() => onSelect(globalIdx)}
            className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive ? 'bg-teal text-white' : 'text-teal/70 hover:bg-sand'
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusClass(result)}`} />
            <span className="truncate">{def?.code} {def?.title}</span>
          </button>
        )
      })}
    </nav>
  )
}
