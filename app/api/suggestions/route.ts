import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { CheckpointResult, Assessment, Suggestions, Suggestion } from '@/lib/types'
import { getCheckpointDef } from '@/lib/udl'

const client = new Anthropic()
const MODEL = process.env.SUGGESTIONS_MODEL ?? process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6'

interface SuggestionsRequest {
  checkpoints: CheckpointResult[]
  assessments: Assessment[]
  focus?: string
}

// Narrows to the shape the LLM is allowed to return - id is added by the
// server so it's intentionally excluded here. Curation flags (dismissed,
// done, userAuthored) are never accepted from the LLM.
type RawSuggestion = { text: string; why: string; udlCodes: string[] }

function isRawSuggestion(s: unknown): s is RawSuggestion {
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
  // Explicit field pick prevents the LLM from injecting curation flags
  // (e.g. dismissed: true) by hallucinating them in its JSON output.
  const withIds = (raw: unknown[]): Suggestion[] =>
    raw.filter(isRawSuggestion).map(s => ({
      id: crypto.randomUUID(),
      text: s.text,
      why: s.why,
      udlCodes: s.udlCodes,
    }))
  const quickWins = Array.isArray(obj.quickWins) ? withIds(obj.quickWins) : []
  const longerTerm = Array.isArray(obj.longerTerm) ? withIds(obj.longerTerm) : []
  return { quickWins, longerTerm }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as SuggestionsRequest
    const { checkpoints, assessments, focus } = body

    const allMet = checkpoints.every(c => (c.userRating ?? c.aiRating) === 'met')

    if (allMet) {
      const id = () => crypto.randomUUID()
      return NextResponse.json({
        quickWins: [
          { id: id(), text: 'All checkpoints are rated Met - outstanding UDL alignment across your unit.', why: 'Your design already supports the full breadth of audited UDL principles.', udlCodes: [] },
          { id: id(), text: 'Consider sharing your assessment design as an exemplar with colleagues.', why: 'Strong UDL practice spreads when others can see what good looks like in context.', udlCodes: [] },
          { id: id(), text: 'Document your approach for your teaching portfolio as evidence of UDL practice.', why: 'Captures your inclusive design choices for review, promotion, or accreditation.', udlCodes: [] },
        ],
        longerTerm: [
          { id: id(), text: 'Explore UDL Guidelines 3.0 checkpoints beyond the ones audited here to deepen your practice.', why: 'The audited checkpoints are a curated subset; the full framework offers more dimensions to explore.', udlCodes: [] },
          { id: id(), text: 'Consider mentoring colleagues in UDL-aligned assessment design.', why: 'Your demonstrated practice is a teaching resource for the wider unit team.', udlCodes: [] },
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

    const focusInstruction = focus?.trim()
      ? `\n\nFOCUS: The user wants suggestions especially relevant to: ${focus.trim()}. Weight your suggestions toward this focus area without ignoring the gap context entirely.\n\n`
      : ''

    const prompt = `You are a teaching support specialist at Curtin University, advising on UDL (Universal Design for Learning) assessment design in the context of Assessment 2030.${focusInstruction}

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
