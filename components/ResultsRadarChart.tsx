'use client'

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import type { DimensionScore } from '@/lib/types'

interface Props {
  scores: DimensionScore[]
}

export function ResultsRadarChart({ scores }: Props) {
  const data = scores.map(s => ({
    subject: s.label,
    score: s.percentage,
    fullMark: 100,
  }))

  return (
    <ResponsiveContainer width="100%" height={320}>
      <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke="#E8E0D0" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fontSize: 12, fill: '#1B3A4B', fontFamily: 'var(--font-plus-jakarta)' }}
        />
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
  )
}
