'use client'

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import type { PrincipleScore } from '@/lib/types'

interface Props {
  scores: PrincipleScore[]
}

interface TickProps {
  x?: number | string
  y?: number | string
  cy?: number | string
  payload?: { value: string }
}

export function ResultsRadarChart({ scores }: Props) {
  const data = scores.map(s => ({
    subject: s.label,
    score: s.percentage,
    fullMark: 100,
  }))

  // Recharts plots clockwise from 12 o'clock; PRINCIPLES order from scoring.ts
  // gives: top=Engagement, bottom-right=Representation, bottom-left=Action & Expression.
  // We render long bottom labels outside the SVG so they can fit and be justified
  // to the card edges instead of getting clipped at the polygon vertex.
  const bottomRight = scores.find(s => s.principle === 'Representation')
  const bottomLeft = scores.find(s => s.principle === 'Action & Expression')

  const renderTick = (props: TickProps) => {
    const { payload } = props
    if (!payload) return <g />
    const x = Number(props.x ?? 0)
    const y = Number(props.y ?? 0)
    const cy = Number(props.cy ?? 0)
    if (y < cy - 10) {
      return (
        <text
          x={x}
          y={y - 6}
          textAnchor="middle"
          fontSize={12}
          fill="#1B3A4B"
          style={{ fontFamily: 'var(--font-plus-jakarta)' }}
        >
          {payload.value}
        </text>
      )
    }
    return <g />
  }

  return (
    <div className="relative h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} margin={{ top: 20, right: 20, bottom: 32, left: 20 }}>
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
      <div className="absolute left-0 right-0 bottom-1 flex justify-between px-1 text-xs font-medium text-teal pointer-events-none">
        <span>{bottomLeft?.label}</span>
        <span>{bottomRight?.label}</span>
      </div>
    </div>
  )
}
