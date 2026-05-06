import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { CheckpointResult, Assessment, Suggestions } from '@/lib/types'
import { getCheckpointDef } from '@/lib/udl'

const client = new Anthropic()
const MODEL = process.env.SUGGESTIONS_MODEL ?? process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6'

interface SuggestionsRequest {
  checkpoints: CheckpointResult[]
  assessments: Assessment[]
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as SuggestionsRequest
    const { checkpoints, assessments } = body

    const allMet = checkpoints.every(c => (c.userRating ?? c.aiRating) === 'met')

    if (allMet) {
      return NextResponse.json({
        quickWins: [
          'All checkpoints are rated Met — outstanding UDL alignment across your unit.',
          'Consider sharing your assessment design as an exemplar with colleagues.',
          'Document your approach for your teaching portfolio as evidence of UDL practice.',
        ],
        longerTerm: [
          'Explore UDL Guidelines 3.0 checkpoints beyond the ones audited here to deepen your practice.',
          'Consider mentoring colleagues in UDL-aligned assessment design.',
        ],
      } satisfies Suggestions)
    }

    const gapContext = checkpoints
      .filter(c => (c.userRating ?? c.aiRating) !== 'met')
      .map(c => {
        const def = getCheckpointDef(c.checkpointId)
        const assessment = assessments.find(a => a.id === c.assessmentId)
        const rating = c.userRating ?? c.aiRating
        return `[${rating === 'not_yet' ? 'GAP' : 'PARTIAL'}] Assessment "${assessment?.name}" — UDL ${def?.code} ${def?.title} (${def?.principle})`
      })
      .join('\n')

    const prompt = `You are a teaching support specialist at Curtin University, advising on UDL (Universal Design for Learning) assessment design in the context of Assessment 2030.

The following UDL checkpoints have not been fully met in this unit's assessments:

${gapContext}

Generate:
1. QUICK WINS: 2–4 specific, immediately actionable suggestions. These should be changes the unit coordinator could make before the next study period — concrete edits to briefs, rubrics, or policies. Be specific and practical.
2. LONGER TERM: 2–3 deeper structural suggestions that would require more planning or curriculum redesign. Frame these as aspirational next steps.

Return JSON in this exact format:
{
  "quickWins": ["suggestion 1", "suggestion 2", ...],
  "longerTerm": ["suggestion 1", "suggestion 2", ...]
}

Be direct and specific. Reference the actual assessment names and checkpoints. No generic advice.`

    let attempts = 0
    let lastError: unknown
    while (attempts < 2) {
      try {
        const response = await client.messages.create({
          model: MODEL,
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        })
        const textBlock = response.content.find(b => b.type === 'text')
        if (!textBlock || textBlock.type !== 'text') throw new Error('No text response')
        const jsonText = textBlock.text.trim()
          .replace(/^```(?:json)?\n?/, '')
          .replace(/\n?```$/, '')
        const suggestions = JSON.parse(jsonText) as Suggestions
        return NextResponse.json(suggestions)
      } catch (err) {
        lastError = err
        attempts++
      }
    }

    console.error('/api/suggestions failed after retries:', lastError)
    return NextResponse.json({ error: 'Suggestions temporarily unavailable' }, { status: 503 })
  } catch (err) {
    console.error('/api/suggestions error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
