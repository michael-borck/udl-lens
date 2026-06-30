import type { PrincipleScore } from '@/lib/types'
import { scoreBand, type ScoreBand } from '@/lib/scoring'

const BAND_CLASS: Record<ScoreBand, string> = {
  strong: 'bg-teal',
  developing: 'bg-amber',
  attention: 'bg-terracotta',
}

interface Props {
  scores: PrincipleScore[]
}

export function DimensionBars({ scores }: Props) {
  return (
    <div className="space-y-3">
      {scores.map(s => (
        <div key={s.principle}>
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-sm font-medium text-teal">{s.label}</span>
            <span className="text-xs text-teal/70 tabular-nums">{s.percentage}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-sand overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${BAND_CLASS[scoreBand(s.percentage)]}`}
              style={{ width: `${s.percentage}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
