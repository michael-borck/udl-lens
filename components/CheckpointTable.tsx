import type { CheckpointResult, Assessment } from '@/lib/types'
import { getCheckpointDef } from '@/lib/udl'

interface Props {
  checkpoints: CheckpointResult[]
  assessments: Assessment[]
}

const RATING_BADGE: Record<string, string> = {
  met: 'bg-green-100 text-green-800',
  partial: 'bg-amber/30 text-teal',
  not_yet: 'bg-red-100 text-red-700',
}
const RATING_LABEL: Record<string, string> = {
  met: 'Met',
  partial: 'Partial',
  not_yet: 'Not yet',
}

export function CheckpointTable({ checkpoints, assessments }: Props) {
  return (
    <div className="overflow-x-auto rounded-xl border border-sand">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-sand/50 text-teal/60 text-xs font-medium uppercase tracking-wide">
            <th className="text-left px-4 py-3">Checkpoint</th>
            <th className="text-left px-4 py-3">Assessment</th>
            <th className="text-left px-4 py-3">Principle</th>
            <th className="text-left px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-sand">
          {checkpoints.map(c => {
            const def = getCheckpointDef(c.checkpointId)
            const assessment = assessments.find(a => a.id === c.assessmentId)
            const rating = c.userRating ?? c.aiRating
            if (!def) return null
            return (
              <tr key={`${c.checkpointId}-${c.assessmentId}`} className="hover:bg-sand/30 transition-colors">
                <td className="px-4 py-3 text-teal font-medium">
                  {def.code} {def.title}
                </td>
                <td className="px-4 py-3 text-teal/60">{assessment?.name ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className="rounded px-2 py-0.5 text-xs bg-teal/10 text-teal">{def.principle}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${RATING_BADGE[rating]}`}>
                    {RATING_LABEL[rating]}
                  </span>
                  {!c.userRating && (
                    <span className="ml-1 text-xs text-teal/40 italic">AI</span>
                  )}
                  {c.overridden && (
                    <span className="ml-1 text-xs text-terracotta italic">edited</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
