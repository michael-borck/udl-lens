import type { Assessment, CheckpointDef, CheckpointResult } from '@/lib/types'

// Pure prompt construction. Domain inputs in, prompt strings out - no model
// calls, no data-file imports (callers pass the checkpoint defs / a resolver),
// so every builder is snapshot-testable in isolation.
//
// Each builder returns the cacheable static prefix (`system`) separately from
// the per-call variable part (`prompt`). That split is what prompt caching
// needs. It is NOT currently active: Sonnet 4.6 only caches a prefix of
// ~2048 tokens or more, and the curated checkpoint set (3 per assessment type)
// yields a ~700-token system block - well under the floor, so a cache_control
// marker would be a silent no-op. We keep the split (the cacheable content is
// already isolated) but leave the breakpoint OFF until the checkpoint set grows
// past the floor. Flip CACHE_SYSTEM to true when it does, then verify with
// usage.cache_read_input_tokens.
const CACHE_SYSTEM = false

export interface SystemBlock {
  text: string
  cache: boolean
}

export interface BuiltPrompt {
  system: SystemBlock
  prompt: string
}

// A checkpoint definition paired with its id (the id is the JSON key, not a
// field on CheckpointDef, but the prompt needs to name it).
export interface CheckpointForPrompt {
  id: string
  def: CheckpointDef
}

function renderCheckpointContext(checkpoints: CheckpointForPrompt[]): string {
  return checkpoints
    .map(({ id, def }) => `Checkpoint ${id} (UDL 3.0 ${def.code} - ${def.title}):
Principle: ${def.principle} · Guideline: ${def.guideline}
Harmful practices: ${def.harmful.join('; ')}
Helpful practices: ${def.helpful.join('; ')}`)
    .join('\n\n')
}

function renderAssessmentContext(a: Assessment): string {
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
    : responseEntries.map(([id, ans]) => `  ${id}: ${ans}`).join('\n')

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
}

// Rate one assessment against a set of checkpoints. The framing, checkpoint
// definitions, rating scale, and output format are identical for any assessment
// of the same type (the cacheable system block); the assessment's own documents
// and self-report are the per-call user prompt.
export function buildPrefillPrompt(
  assessment: Assessment,
  checkpoints: CheckpointForPrompt[],
): BuiltPrompt {
  const system = `You are a UDL (Universal Design for Learning) expert helping a university educator audit their assessments.

You will be given ONE assessment - its documents and the teacher's self-report - and must rate it against the UDL checkpoints below.

UDL CHECKPOINTS TO RATE:
${renderCheckpointContext(checkpoints)}

The teacher has uploaded documents (typed as Brief, Rubric, or Exemplar) and answered short self-report questions about classroom delivery. The self-report key matches the checkpoint ID. Weight the self-report heavily for checkpoints whose practice lives in delivery rather than in documents (collaboration, biases in language, joy and play). For checkpoints clearly evidenced by the documents (e.g. multiple tools, methods of response), corroborate the self-report with the document text.

For each checkpoint, rate how well the assessment addresses that checkpoint.

Ratings:
- "not_yet": The assessment shows no evidence of this UDL principle based on the available evidence
- "partial": The assessment partially addresses this principle
- "met": The assessment clearly demonstrates this principle

Rate EVERY checkpoint listed. Return a JSON array with this exact structure:
[
  {
    "checkpointId": "r1",
    "assessmentId": "assessment-uuid-here",
    "rating": "not_yet" | "partial" | "met",
    "reasoning": "One sentence explaining the rating, citing the specific document text or self-report answer that supports it, or noting where evidence was absent."
  }
]

Important:
- Rate strictly against the evidence actually provided in the documents, self-report answers, and extra notes. A checkpoint is "met" ONLY where that evidence clearly demonstrates the practice; "partial" where there is some evidence; "not_yet" where the evidence is silent or absent.
- Do NOT infer "met" from the assessment type or name alone - e.g. an interactive oral does not automatically satisfy collaboration or language-access checkpoints. When evidence is missing, rate down ("not_yet" or "partial"), never up.
- Keep reasoning to one sentence.
- Return ONLY the JSON array, no other text.`

  const prompt = `ASSESSMENT:
${renderAssessmentContext(assessment)}`

  return { system: { text: system, cache: CACHE_SYSTEM }, prompt }
}

// Suggest improvements for the not-yet-met checkpoints. The Curtin/A2030 framing
// and output format are static (system); the actual gaps, provided documents,
// and optional focus are per-call (prompt).
export function buildSuggestionsPrompt(
  checkpoints: CheckpointResult[],
  assessments: Assessment[],
  getDef: (id: string) => CheckpointDef | undefined,
  focus?: string,
): BuiltPrompt {
  const system = `You are a teaching support specialist at Curtin University, advising on UDL (Universal Design for Learning) assessment design in the context of Assessment 2030.

You will be given the UDL checkpoints that are not yet fully met in a unit's assessments, plus the documents the coordinator actually provided. Suggest concrete improvements.

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

IMPORTANT - do not invent artifacts: Only recommend edits to a rubric or exemplar if one was actually provided for that assessment (see the documents list), or if the rubric is noted as embedded in the brief. If no rubric was provided, do not claim its contents or recommend specific rubric wording changes; instead suggest creating/adding rubric criteria, or focus the advice on the brief and delivery. Never reference a document the coordinator did not provide as though you have read it.

Be direct and specific. Reference the actual assessment names and checkpoints. No generic advice.`

  const gapContext = checkpoints
    .filter(c => (c.userRating ?? c.aiRating) !== 'met')
    .map(c => {
      const def = getDef(c.checkpointId)
      const assessment = assessments.find(a => a.id === c.assessmentId)
      const rating = c.userRating ?? c.aiRating
      return `[${rating === 'not_yet' ? 'GAP' : 'PARTIAL'}] Assessment "${assessment?.name}" - UDL ${def?.code} ${def?.title} (${def?.principle})`
    })
    .join('\n')

  const docsContext = assessments
    .map(a => {
      const have = a.documents.map(d => d.type)
      const provided = have.length ? have.join(', ') : 'none'
      const rubricNote = a.rubricInBrief
        ? ' (rubric criteria are embedded in the brief, not a separate file)'
        : ''
      return `- "${a.name}": provided ${provided}${rubricNote}`
    })
    .join('\n')

  const focusInstruction = focus?.trim()
    ? `FOCUS: The user wants suggestions especially relevant to: ${focus.trim()}. Weight your suggestions toward this focus area without ignoring the gap context entirely.\n\n`
    : ''

  const prompt = `${focusInstruction}The following UDL checkpoints have not been fully met in this unit's assessments:

${gapContext}

Documents the coordinator actually provided for each assessment:

${docsContext}`

  return { system: { text: system, cache: CACHE_SYSTEM }, prompt }
}

function extractInstruction(docType: string | null): string {
  if (docType === 'rubric') {
    return `You are extracting marking rubrics from a document. Find every rubric or marking-criteria block in the document. For each, return a "title" (e.g. "Rubric for Final Report" or the assessment name if labelled) and "content" (the rubric text itself: criteria, performance descriptors, weights). If the document does not appear to contain a rubric, return an empty array.`
  }
  if (docType === 'exemplar') {
    return `You are extracting student-work exemplars from a document. Find every exemplar, sample student response, or worked example. For each, return a "title" (e.g. "High Distinction example" or the assessment name) and "content" (the exemplar text or annotated commentary). If the document does not appear to contain an exemplar, return an empty array.`
  }
  // Default: brief
  return `You are extracting assessment briefs from a document. Find every distinct assessment task in the document. For each, return a "title" (the assessment name) and "content" (the brief: task description, requirements, deliverables, due dates - everything a student would need). If the document only contains one assessment, return an array with one entry. If the document is itself an assessment brief (not a unit outline), return one entry with the document treated as a single brief. If the document contains no assessment information at all, return an empty array - do not invent one.`
}

// Extraction instructions for a document type. The document itself is supplied
// by the caller as the user prompt (text) or a PDF attachment, so this builder
// only produces the static system block.
export function buildExtractPrompt(docType: string | null): SystemBlock {
  const text = `${extractInstruction(docType)}

Return JSON only, no other text:
{
  "candidates": [
    {"title": "...", "content": "..."}
  ]
}`
  return { text, cache: CACHE_SYSTEM }
}
