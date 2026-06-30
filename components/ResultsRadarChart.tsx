'use client'

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import type { GuidelineScore } from '@/lib/types'

interface Props {
  scores: GuidelineScore[]
}

interface TickProps {
  x?: number | string
  y?: number | string
  cx?: number | string
  cy?: number | string
  payload?: { value: string }
}

// UDL guideline names vary a lot in length ("Interaction" vs "Sustaining Effort
// & Persistence"); split long ones across two lines so they fit the axis ends
// without clipping.
function wrapLabel(s: string): string[] {
  if (s.length <= 16) return [s]
  const amp = s.match(/^(.+?)\s+(?:&|and)\s+(.+)$/)
  if (amp) return [`${amp[1]} &`, amp[2]]
  const mid = Math.floor(s.length / 2)
  let best = s.length
  let splitAt = -1
  for (let i = 0; i < s.length; i++) {
    if (s[i] === ' ' && Math.abs(i - mid) < best) {
      best = Math.abs(i - mid)
      splitAt = i
    }
  }
  return splitAt > 0 ? [s.slice(0, splitAt), s.slice(splitAt + 1)] : [s]
}

export function ResultsRadarChart({ scores }: Props) {
  const data = scores.map(s => ({
    subject: s.label,
    score: s.percentage,
    fullMark: 100,
  }))

  const renderTick = (props: TickProps) => {
    const { payload } = props
    if (!payload) return <g />
    const x = Number(props.x ?? 0)
    const y = Number(props.y ?? 0)
    const cx = Number(props.cx ?? 0)
    const cy = Number(props.cy ?? 0)
    const lines = wrapLabel(payload.value)

    // Anchor by position relative to the radar centre so labels read outward.
    let anchor: 'start' | 'middle' | 'end' = 'middle'
    let dx = 0
    let dy = 0
    if (y < cy - 8) dy = -6 - (lines.length - 1) * 6
    else if (y > cy + 8) dy = 12
    if (x < cx - 8) { anchor = 'end'; dx = -4 }
    else if (x > cx + 8) { anchor = 'start'; dx = 4 }

    return (
      <text
        x={x + dx}
        y={y + dy}
        textAnchor={anchor}
        fontSize={10}
        fill="#1B3A4B"
        style={{ fontFamily: 'var(--font-plus-jakarta)' }}
      >
        {lines.map((ln, i) => (
          <tspan key={i} x={x + dx} dy={i === 0 ? 0 : 12}>
            {ln}
          </tspan>
        ))}
      </text>
    )
  }

  return (
    <div className="relative h-[340px]">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} margin={{ top: 24, right: 30, bottom: 28, left: 30 }}>
          <PolarGrid stroke="#E8E0D0" />
          <PolarAngleAxis dataKey="subject" tick={renderTick} />
          <Radar
            name="UDL Alignment"
            dataKey="score"
            stroke="#1B3A4B"
            fill="#1B3A4B"
            fillOpacity={0.25}
            strokeWidth={2}
          />
          <Tooltip
            formatter={(value) => [`${value}%`, 'Alignment']}
            contentStyle={{
              background: '#FAF7F2',
              border: '1px solid #E8E0D0',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
