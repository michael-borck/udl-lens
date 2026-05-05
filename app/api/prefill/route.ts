import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { Assessment, CheckpointResult, Rating } from '@/lib/types'
import { getCheckpointDef } from '@/lib/udl'

const client = new Anthropic()

interface PrefillRequest {
  assessments: Assessment[]
  checkpointIds: string[]
}

interface PrefillItem {
  checkpointId: string
  assessmentId: string
  rating: Rating
  reasoning: string
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as PrefillRequest
    const { assessments, checkpointIds } = body

    if (!assessments?.length || !checkpointIds?.length) {
      return NextResponse.json({ error: 'Missing assessments or checkpointIds' }, { status: 400 })
    }

    const checkpointContext = checkpointIds
      .map(id => {
        const def = getCheckpointDef(id)
        if (!def) return null
        return `Checkpoint ${id} (${def.code} — ${def.title}):
Dimension: ${def.dimension}
Harmful practices: ${def.harmful.join('; ')}
Helpful practices: ${def.helpful.join('; ')}`
      })
      // Checkpoints not found in the data are omitted from context; Claude won't return results for them.
      // In practice, callers always pass IDs from getCheckpointIdsForAssessments(), so this is defensive only.
      .filter(Boolean)
      .join('\n\n')

    const assessmentContext = assessments
      .map(a => `Assessment ID: ${a.id}
Name: ${a.name}
Type: ${a.type}
Lane: ${a.lane}
Description: ${a.description || '(no description provided — use assessment type as context)'}`)
      .join('\n\n')

    const prompt = `You are a UDL (Universal Design for Learning) expert helping a university educator audit their assessments.

ASSESSMENTS:
${assessmentContext}

UDL CHECKPOINTS TO RATE:
${checkpointContext}

For each combination of assessment and checkpoint, rate how well the assessment addresses that checkpoint.

Ratings:
- "not_yet": The assessment shows no evidence of this UDL principle based on the description
- "partial": The assessment partially addresses this principle
- "met": The assessment clearly demonstrates this principle

For each assessment, rate EVERY checkpoint listed. Return a JSON array with this exact structure:
[
  {
    "checkpointId": "r1",
    "assessmentId": "assessment-uuid-here",
    "rating": "not_yet" | "partial" | "met",
    "reasoning": "One sentence explaining the rating based on the description."
  }
]

Important:
- Base ratings on the description provided. If no description, use the assessment type as context.
- Be realistic — most assessments will have a mix of "not_yet" and "partial" with a few "met".
- Keep reasoning to one sentence.
- Return ONLY the JSON array, no other text.`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = response.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    let items: PrefillItem[]
    try {
      const jsonText = textBlock.text.trim()
        .replace(/^```(?:json)?\n?/, '')
        .replace(/\n?```$/, '')
      items = JSON.parse(jsonText) as PrefillItem[]
    } catch {
      throw new Error('Failed to parse Claude response as JSON')
    }

    const checkpointResults: CheckpointResult[] = items.map(item => ({
      checkpointId: item.checkpointId,
      assessmentId: item.assessmentId,
      aiRating: (['not_yet', 'partial', 'met'] as const).includes(item.rating) ? item.rating : 'not_yet',
      aiReasoning: item.reasoning,
      userRating: null,
      overridden: false,
    }))

    return NextResponse.json(checkpointResults)
  } catch (err) {
    console.error('/api/prefill error:', err)
    return NextResponse.json({ error: 'Prefill failed' }, { status: 500 })
  }
}
