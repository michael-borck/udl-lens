import type { DimensionScore } from '@/lib/types'

interface Props {
  scores: DimensionScore[]
}

export function DimensionBars({ scores }: Props) {
  return (
    <div className="space-y-3">
      {scores.map(s => (
        <div key={s.dimension}>
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-sm font-medium text-teal">{s.label}</span>
            <span className="text-xs text-teal/50 tabular-nums">{s.percentage}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-sand overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                s.percentage >= 75 ? 'bg-green-500' :
                s.percentage >= 45 ? 'bg-amber' :
                'bg-terracotta'
              }`}
              style={{ width: `${s.percentage}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
