import { NextResponse } from 'next/server'
import type { CheckpointResult, PrefillRequest } from '@/lib/types'
import { getCheckpointDef } from '@/lib/udl'
import type { CheckpointForPrompt } from '@/lib/prompts'
import { runPrefill } from '@/lib/audit'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(req: Request) {
  const rl = checkRateLimit(getClientIp(req))
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    )
  }
  try {
    const { assessments, checkpointIds } = await req.json() as PrefillRequest
    if (!assessments?.length || !checkpointIds?.length) {
      return NextResponse.json({ error: 'Missing assessments or checkpointIds' }, { status: 400 })
    }

    // Resolve each id to its definition once. Unknown ids are dropped (defensive;
    // callers pass ids from getCheckpointIdsForAssessments).
    const checkpoints: CheckpointForPrompt[] = checkpointIds
      .map(id => {
        const def = getCheckpointDef(id)
        return def ? { id, def } : null
      })
      .filter((c): c is CheckpointForPrompt => c !== null)

    // The client batches one assessment per call; the loop also keeps the
    // multi-assessment case working (and isolates a failure to its assessment).
    const results: CheckpointResult[] = []
    for (const assessment of assessments) {
      results.push(...await runPrefill(assessment, checkpoints))
    }

    return NextResponse.json(results)
  } catch (err) {
    // ModelCallError (retries exhausted) or anything else -> 500. The client
    // falls back to manual rating per assessment when a prefill request fails.
    console.error('/api/prefill error:', err)
    return NextResponse.json({ error: 'Prefill failed' }, { status: 500 })
  }
}
