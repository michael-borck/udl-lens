import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { CheckpointResult, Assessment, Suggestions, Suggestion } from '@/lib/types'
import { getCheckpointDef } from '@/lib/udl'

const client = new Anthropic()
const MODEL = process.env.SUGGESTIONS_MODEL ?? process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6'

interface SuggestionsRequest {
  checkpoints: CheckpointResult[]
  assessments: Assessment[]
}

function isSuggestion(s: unknown): s is Suggestion {
  if (!s || typeof s !== 'object') return false
  const obj = s as Record<string, unknown>
  return typeof obj.text === 'string'
    && typeof obj.why === 'string'
    && Array.isArray(obj.udlCodes)
    && obj.udlCodes.every(c => typeof c === 'string')
}

function sanitizeSuggestions(parsed: unknown): Suggestions {
  if (!parsed || typeof parsed !== 'object') return { quickWins: [], longerTerm: [] }
  const obj = parsed as Record<string, unknown>
  const quickWins = Array.isArray(obj.quickWins) ? obj.quickWins.filter(isSuggestion) : []
  const longerTerm = Array.isArray(obj.longerTerm) ? obj.longerTerm.filter(isSuggestion) : []
  return { quickWins, longerTerm }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as SuggestionsRequest
    const { checkpoints, assessments } = body

    const allMet = checkpoints.every(c => (c.userRating ?? c.aiRating) === 'met')

    if (allMet) {
      return NextResponse.json({
        quickWins: [
          { text: 'Add a plain-English summary of what the assessment requires at the top of the brief.', why: 'Reduces cognitive load and supports students new to academic English.', udlCodes: ['2.1', '1.2'] },
          { text: 'Document your approach to assessment delivery for your teaching portfolio.', why: 'Captures the UDL-aligned practices you already use as evidence for review.', udlCodes: [] },
        ],
        longerTerm: [
          { text: "Audit your unit's assessments together to see how they balance the three UDL principles across the semester.", why: 'UDL is read across the whole unit; gaps in one assessment can be addressed by another.', udlCodes: [] },
        ],
      } satisfies Suggestions)
    }

    const gapContext = checkpoints
      .filter(c => (c.userRating ?? c.aiRating) !== 'met')
      .map(c => {
        const def = getCheckpointDef(c.checkpointId)
        const assessment = assessments.find(a => a.id === c.assessmentId)
        const rating = c.userRating ?? c.aiRating
        return `[${rating === 'not_yet' ? 'GAP' : 'PARTIAL'}] Assessment "${assessment?.name}" - UDL ${def?.code} ${def?.title} (${def?.principle})`
      })
      .join('\n')

    const prompt = `You are a teaching support specialist at Curtin University, advising on UDL (Universal Design for Learning) assessment design in the context of Assessment 2030.

The following UDL checkpoints have not been fully met in this unit's assessments:

${gapContext}

Return JSON in EXACTLY this structure (no extra fields, no prose around the JSON):

{
  "quickWins": [
    { "text": "...", "why": "...", "udlCodes": ["..."] }
  ],
  "longerTerm": [
    { "text": "...", "why": "...", "udlCodes": ["..."] }
  ]
}

Field guidance:
- "text": Write each suggestion as a concrete, actionable statement (under 30 words). Reference the assessment name when it helps clarity.
- "why": One short sentence (under 25 words) explaining what improves for students and why it advances UDL alignment.
- "udlCodes": List the UDL 3.0 consideration codes this suggestion addresses, e.g. ["8.3"] or ["7.3", "9.1"]. Use only codes you can justify from the suggestion content.

QUICK WINS: 2-4 specific, immediately actionable suggestions the unit coordinator could make before the next study period - concrete edits to briefs, rubrics, or policies.
LONGER TERM: 2-3 deeper structural suggestions that would require more planning or curriculum redesign. Frame as aspirational next steps.

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
        const suggestions = sanitizeSuggestions(JSON.parse(jsonText))
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
