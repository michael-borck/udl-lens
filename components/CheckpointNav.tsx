import type { CheckpointResult } from '@/lib/types'
import { getCheckpointDef } from '@/lib/udl'

interface Props {
  checkpoints: CheckpointResult[]
  activeIndex: number
  onSelect: (index: number) => void
  filterAssessmentId: string | null
}

function StatusIcon({ result }: { result: CheckpointResult }) {
  if (result.userRating === null) {
    // Pending — grey dot
    return <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-teal/20" />
  }
  if (result.acceptedAI) {
    // Deferred to AI — teal checkmark
    return <span className="text-sm leading-none shrink-0 text-teal font-bold">✓</span>
  }
  // Human agency — terracotta checkmark
  return <span className="text-sm leading-none shrink-0 text-terracotta font-bold">✓</span>
}

export function CheckpointNav({ checkpoints, activeIndex, onSelect, filterAssessmentId }: Props) {
  const visible = filterAssessmentId
    ? checkpoints.filter(c => c.assessmentId === filterAssessmentId)
    : checkpoints

  return (
    <nav className="space-y-1">
      {visible.map((result) => {
        const def = getCheckpointDef(result.checkpointId)
        const globalIdx = checkpoints.findIndex(
          c => c.checkpointId === result.checkpointId && c.assessmentId === result.assessmentId
        )
        const isActive = globalIdx === activeIndex
        return (
          <button
            key={`${result.checkpointId}-${result.assessmentId}`}
            onClick={() => onSelect(globalIdx)}
            className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive ? 'bg-teal text-white' : 'text-teal/70 hover:bg-sand'
            }`}
          >
            <StatusIcon result={result} />
            <span className="truncate">{def?.code} {def?.title}</span>
          </button>
        )
      })}
    </nav>
  )
}
