interface Props {
  completed: number
  total: number
}

export function ProgressBar({ completed, total }: Props) {
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100)
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-sand overflow-hidden">
        <div
          className="h-full bg-teal transition-all duration-300 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm text-teal/70 tabular-nums shrink-0">
        {completed}/{total}
      </span>
    </div>
  )
}
