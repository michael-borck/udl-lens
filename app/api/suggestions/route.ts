import { NextResponse } from 'next/server'
import type { Assessment, CheckpointResult } from '@/lib/types'
import { runSuggestions } from '@/lib/audit'
import { ModelCallError } from '@/lib/llm'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

interface SuggestionsRequest {
  checkpoints: CheckpointResult[]
  assessments: Assessment[]
  focus?: string
}

export async function POST(req: Request) {
  const rl = checkRateLimit(getClientIp(req))
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    )
  }
  try {
    const { checkpoints, assessments, focus } = await req.json() as SuggestionsRequest
    const suggestions = await runSuggestions(checkpoints, assessments, focus)
    return NextResponse.json(suggestions)
  } catch (err) {
    if (err instanceof ModelCallError) {
      // Retries exhausted - the UI offers a retry / lets the user add their own.
      console.error('/api/suggestions failed after retries:', err.cause)
      return NextResponse.json({ error: 'Suggestions temporarily unavailable' }, { status: 503 })
    }
    console.error('/api/suggestions error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
