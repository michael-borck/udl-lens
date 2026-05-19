import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { Assessment, CheckpointResult, Rating } from '@/lib/types'
import { getCheckpointDef } from '@/lib/udl'

const client = new Anthropic()
const MODEL = process.env.PREFILL_MODEL ?? process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6'

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
        return `Checkpoint ${id} (UDL 3.0 ${def.code} - ${def.title}):
Principle: ${def.principle} · Guideline: ${def.guideline}
Harmful practices: ${def.harmful.join('; ')}
Helpful practices: ${def.helpful.join('; ')}`
      })
      // Checkpoints not found in the data are omitted from context; Claude won't return results for them.
      // In practice, callers always pass IDs from getCheckpointIdsForAssessments(), so this is defensive only.
      .filter(Boolean)
      .join('\n\n')

    const assessmentContext = assessments
      .map(a => {
        const docs = a.documents.length === 0
          ? '(no documents uploaded)'
          : a.documents
              .map(d => {
                if (!d.extractedText) {
                  return `--- ${d.type.toUpperCase()} (${d.filename}) ---\n(PDF binary; summary applied during upload)`
                }
                return `--- ${d.type.toUpperCase()} (${d.filename}) ---\n${d.extractedText}`
              })
              .join('\n\n')
        const responseEntries = Object.entries(a.responses)
        const responses = responseEntries.length === 0
          ? '(no self-report answers provided)'
          : responseEntries
              .map(([id, ans]) => `  ${id}: ${ans}`)
              .join('\n')
        const extraNotes = a.description ? `Extra notes: ${a.description}\n` : ''
        const rubricNote = a.rubricInBrief
          ? 'Rubric note: There is no separate rubric file. The marking criteria are embedded within the Brief - parse the brief text for rubric criteria, performance descriptors, and standards, and do not treat the rubric as missing.\n'
          : ''
        return `Assessment ID: ${a.id}
Name: ${a.name}
Type: ${a.type}
Lane: ${a.lane}
${extraNotes}${rubricNote}Documents:
${docs}

Teacher's self-report (per checkpoint ID):
${responses}`
      })
      .join('\n\n========\n\n')

    const prompt = `You are a UDL (Universal Design for Learning) expert helping a university educator audit their assessments.

ASSESSMENTS:
${assessmentContext}

UDL CHECKPOINTS TO RATE:
${checkpointContext}

The teacher has uploaded documents (typed as Brief, Rubric, or Exemplar) and answered short self-report questions about classroom delivery. The self-report key matches the checkpoint ID. Weight the self-report heavily for checkpoints whose practice lives in delivery rather than in documents (collaboration, biases in language, joy and play). For checkpoints clearly evidenced by the documents (e.g. multiple tools, methods of response), corroborate the self-report with the document text.

For each combination of assessment and checkpoint, rate how well the assessment addresses that checkpoint.

Ratings:
- "not_yet": The assessment shows no evidence of this UDL principle based on the available evidence
- "partial": The assessment partially addresses this principle
- "met": The assessment clearly demonstrates this principle

For each assessment, rate EVERY checkpoint listed. Return a JSON array with this exact structure:
[
  {
    "checkpointId": "r1",
    "assessmentId": "assessment-uuid-here",
    "rating": "not_yet" | "partial" | "met",
    "reasoning": "One sentence explaining the rating citing the documents, self-report, or assessment type as appropriate."
  }
]

Important:
- Base ratings on the documents, self-report answers, and any extra notes. If none of these are present, use the assessment type as context.
- Be realistic - most assessments will have a mix of "not_yet" and "partial" with a few "met".
- Keep reasoning to one sentence.
- Return ONLY the JSON array, no other text.`

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
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
      acceptedAI: false,
    }))

    return NextResponse.json(checkpointResults)
  } catch (err) {
    console.error('/api/prefill error:', err)
    return NextResponse.json({ error: 'Prefill failed' }, { status: 500 })
  }
}
