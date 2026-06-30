import type { CheckpointResult } from '@/lib/types'
import { getCheckpointDef } from '@/lib/udl'

interface Props {
  checkpoints: CheckpointResult[]
  activeIndex: number
  onSelect: (index: number) => void
  filterAssessmentId: string | null
}

// Completion indicators use only neutral brand teal (never the red/amber/green
// rating palette, which would imply good/bad). Agency is shown by emphasis:
// a strong tick = you set it, a faint tick = AI default kept, hollow = not reviewed.
function StatusIcon({ result, active }: { result: CheckpointResult; active: boolean }) {
  const ring = active ? 'border-white/60' : 'border-teal/30'
  if (result.userRating === null) {
    // Not reviewed - hollow ring
    return <span className={`w-2.5 h-2.5 rounded-full border shrink-0 ${ring}`} aria-label="Not reviewed" />
  }
  if (result.acceptedAI) {
    // AI default kept - faint tick
    return <span className={`text-sm leading-none shrink-0 ${active ? 'text-white/60' : 'text-teal/70'}`} aria-label="AI default kept">✓</span>
  }
  // You set this - strong tick
  return <span className={`text-sm leading-none shrink-0 font-bold ${active ? 'text-white' : 'text-teal'}`} aria-label="You set this">✓</span>
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
            <StatusIcon result={result} active={isActive} />
            <span className="truncate">{def?.code} {def?.title}</span>
          </button>
        )
      })}
    </nav>
  )
}
