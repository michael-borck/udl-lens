'use client'

import { useEffect, useState } from 'react'
import { getGradeLabel } from '@/lib/scoring'

// Decorative (aria-hidden) preview of the results screen, shown on the landing
// hero. It mirrors the real results page: a teal score card, the 9-guideline
// radar, and the principle bars. The data is hand-picked to read as a
// realistic, uneven audit and is NOT wired to any real session. Grades reuse
// the real getGradeLabel so the band text can never drift from the app.

const GUIDELINES = [
  'Welcoming', 'Effort', 'Emotional',
  'Perception', 'Language', 'Knowledge',
  'Interaction', 'Expression', 'Strategy',
] as const

// Lopsided on purpose — a real audit is never a circle. Fractions of full radius.
const SHAPE = [0.92, 0.7, 0.55, 0.82, 0.6, 0.48, 0.38, 0.66, 0.54] as const

interface PrincipleBar {
  name: string
  pct: number
  // tailwind bg classes mirroring the scoreBand() colour vocabulary
  cls: string
}

const PRINCIPLES: PrincipleBar[] = [
  { name: 'Engagement', pct: 82, cls: 'bg-teal' },
  { name: 'Representation', pct: 61, cls: 'bg-amber' },
  { name: 'Action & Expression', pct: 47, cls: 'bg-terracotta' },
]

const TARGET_SCORE = 68
const CYCLE_MS = 5600

// ── Radar geometry. viewBox 0 0 200 200, centred ────────────────────────────
const CX = 100
const CY = 100
const R = 78
const RINGS = [0.25, 0.5, 0.75, 1] as const

interface Pt {
  x: number
  y: number
}

// Named (not inlined): it encodes the polar→cartesian conversion and the
// rotation that puts the first axis at 12 o'clock, and it has many call sites.
function radarPt(i: number, frac: number): Pt {
  const a = ((-90 + i * (360 / GUIDELINES.length)) * Math.PI) / 180
  return { x: CX + R * frac * Math.cos(a), y: CY + R * frac * Math.sin(a) }
}

const RING_POINTS = RINGS.map(frac =>
  GUIDELINES.map((_, i) => radarPt(i, frac))
    .map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' '),
)
const AXES = GUIDELINES.map((_, i) => radarPt(i, 1))
const LABELS = GUIDELINES.map((g, i) => {
  const p = radarPt(i, 1.16)
  const anchor: 'start' | 'middle' | 'end' = Math.abs(p.x - CX) < 6 ? 'middle' : p.x > CX ? 'start' : 'end'
  return { name: g, x: p.x, y: p.y + 2, anchor }
})
const SHAPE_POINTS = SHAPE.map((frac, i) => radarPt(i, frac))
  .map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
  .join(' ')

export function ResultsMock(): React.ReactElement {
  const [score, setScore] = useState(0)
  const [drawn, setDrawn] = useState(false)
  const [barVals, setBarVals] = useState<number[]>(PRINCIPLES.map(() => 0))
  const [cycle, setCycle] = useState(0)

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Reduced motion: jump straight to the finished state, no loop.
    if (reduced) {
      setScore(TARGET_SCORE)
      setDrawn(true)
      setBarVals(PRINCIPLES.map(p => p.pct))
      return
    }

    // Reset for this cycle.
    setScore(0)
    setDrawn(false)
    setBarVals(PRINCIPLES.map(() => 0))

    // Closures hold the id; no need to name the (env-ambiguous) timer type.
    const cleanups: Array<() => void> = []

    const scoreStart = performance.now()
    const scoreDur = 1300
    const tickScore = (now: number): void => {
      const t = Math.min(1, (now - scoreStart) / scoreDur)
      const eased = 1 - Math.pow(1 - t, 3)
      setScore(Math.round(TARGET_SCORE * eased))
      if (t < 1) {
        const id = requestAnimationFrame(tickScore)
        cleanups.push(() => cancelAnimationFrame(id))
      }
    }
    {
      const id = requestAnimationFrame(tickScore)
      cleanups.push(() => cancelAnimationFrame(id))
    }

    // Radar draw-in.
    {
      const id = setTimeout(() => setDrawn(true), 250)
      cleanups.push(() => clearTimeout(id))
    }

    // Principle bars, staggered; rAF drives both width and the numeric value so
    // there is no shrink artifact on reset.
    PRINCIPLES.forEach((p, i) => {
      const id = setTimeout(() => {
        const barStart = performance.now()
        const barDur = 900
        const tickBar = (now: number): void => {
          const t = Math.min(1, (now - barStart) / barDur)
          const eased = 1 - Math.pow(1 - t, 3)
          setBarVals(prev => {
            const next = [...prev]
            next[i] = Math.round(p.pct * eased)
            return next
          })
          if (t < 1) {
            const rafId = requestAnimationFrame(tickBar)
            cleanups.push(() => cancelAnimationFrame(rafId))
          }
        }
        const rafId = requestAnimationFrame(tickBar)
        cleanups.push(() => cancelAnimationFrame(rafId))
      }, 600 + i * 160)
      cleanups.push(() => clearTimeout(id))
    })

    // Loop.
    {
      const id = setTimeout(() => setCycle(c => c + 1), CYCLE_MS)
      cleanups.push(() => clearTimeout(id))
    }

    return () => {
      cleanups.forEach(fn => fn())
    }
  }, [cycle])

  return (
    <div
      aria-hidden="true"
      className="relative animate-mock-rise rounded-2xl border border-sand bg-white shadow-[0_24px_60px_-28px_rgba(15,37,48,0.32),0_6px_18px_-12px_rgba(15,37,48,0.18)]"
    >
      <span className="absolute right-4 top-3.5 z-10 inline-flex items-center gap-1.5 rounded-full border border-sand bg-cream px-2 py-1 text-[0.62rem] font-bold tracking-wide text-teal-light">
        <i className="h-1.5 w-1.5 rounded-full bg-terracotta animate-blink" />
        SAMPLE AUDIT
      </span>

      {/* Score card — mirrors the results-page teal hero */}
      <div className="flex items-center justify-between gap-4 rounded-t-2xl bg-teal px-6 py-5 text-white">
        <div className="min-w-0">
          <p className="mb-1 text-xs text-white/70">UDL audit for</p>
          <p className="truncate font-display text-lg font-semibold leading-tight">
            Interactive Oral · Field Journal
          </p>
          <p className="mt-0.5 text-sm text-white/85">{getGradeLabel(score)}</p>
        </div>
        <div className="shrink-0 text-right">
          <b className="block font-display text-4xl font-bold tabular-nums">{score}%</b>
          <small className="mt-0.5 block text-[0.68rem] text-white/60">UDL alignment</small>
        </div>
      </div>

      {/* Radar + bars */}
      <div className="px-6 pb-6 pt-4">
        <h3 className="font-display text-base text-teal">UDL Guidelines</h3>
        <p className="mb-2 text-xs text-teal-light/70">Coverage across all 9 UDL 3.0 guidelines</p>

        <div className="flex justify-center">
          <svg viewBox="0 0 200 200" className="h-[260px] w-[320px] overflow-visible">
            {RING_POINTS.map((pts, i) => (
              <polygon key={i} points={pts} className="fill-none stroke-sand" strokeWidth={1} />
            ))}
            {AXES.map((p, i) => (
              <line key={i} x1={CX} y1={CY} x2={p.x} y2={p.y} className="stroke-sand" strokeWidth={1} />
            ))}
            {LABELS.map(l => (
              <text
                key={l.name}
                x={l.x}
                y={l.y}
                textAnchor={l.anchor}
                className="fill-teal-light font-sans text-[8.5px] opacity-85"
              >
                {l.name}
              </text>
            ))}
            <polygon
              points={SHAPE_POINTS}
              className={`radar-shape fill-terracotta/20 stroke-terracotta ${drawn ? 'animate-radar-draw' : ''}`}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className="mt-3 flex flex-col gap-2.5">
          {PRINCIPLES.map((p, i) => (
            <div key={p.name} className="flex items-center gap-3">
              <span className="w-32 text-sm font-medium text-teal md:w-36">{p.name}</span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-sand">
                <span className={`block h-full rounded-full ${p.cls}`} style={{ width: `${barVals[i]}%` }} />
              </span>
              <span className="w-9 text-right text-sm font-semibold tabular-nums text-teal">{barVals[i]}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
