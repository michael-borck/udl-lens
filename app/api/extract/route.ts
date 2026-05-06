import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import mammoth from 'mammoth'

const client = new Anthropic()
const MODEL = process.env.EXTRACT_MODEL ?? process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6'

const EXTRACT_PROMPT = `This document may contain one or more assessment briefs or a unit outline listing multiple assessments.

Identify each distinct assessment described. For each one extract:
- title: the name or title of the assessment (e.g. "Research Report", "Final Examination")
- description: a structured plain-text summary including task type, what students must do, how they are assessed, any constraints or requirements, and marking criteria. Be concise but complete.

Return JSON only, no other text:
{
  "assessments": [
    {"title": "...", "description": "..."}
  ]
}

If the document is a single assessment brief, return one entry. If it is a unit outline or contains multiple assessments, return each separately.`

interface ExtractedAssessment {
  title: string
  description: string
}

async function extractWithAI(text: string): Promise<ExtractedAssessment[]> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [{ role: 'user', content: `${EXTRACT_PROMPT}\n\nDOCUMENT:\n${text}` }],
  })
  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') throw new Error('No text response')
  const json = textBlock.text.trim()
    .replace(/^```(?:json)?\n?/, '')
    .replace(/\n?```$/, '')
  const parsed = JSON.parse(json) as { assessments: ExtractedAssessment[] }
  return parsed.assessments
}

async function extractPdfWithAI(base64: string): Promise<ExtractedAssessment[]> {
  type MessageParam = Parameters<typeof client.messages.create>[0]['messages'][0]
  const message: MessageParam = {
    role: 'user',
    content: [
      {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64 },
      },
      { type: 'text', text: EXTRACT_PROMPT },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any,
  }
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [message],
  })
  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') throw new Error('No text response')
  const json = textBlock.text.trim()
    .replace(/^```(?:json)?\n?/, '')
    .replace(/\n?```$/, '')
  const parsed = JSON.parse(json) as { assessments: ExtractedAssessment[] }
  return parsed.assessments
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const fileName = file.name.toLowerCase()

    let assessments: ExtractedAssessment[]

    if (fileName.endsWith('.pdf')) {
      assessments = await extractPdfWithAI(buffer.toString('base64'))
    } else if (fileName.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer })
      assessments = await extractWithAI(result.value)
    } else if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
      assessments = await extractWithAI(buffer.toString('utf-8'))
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload PDF, DOCX, TXT, or MD.' },
        { status: 400 }
      )
    }

    if (!assessments?.length) {
      return NextResponse.json({ error: 'Could not extract assessment details from file.' }, { status: 422 })
    }

    return NextResponse.json({ assessments })
  } catch (err) {
    console.error('/api/extract error:', err)
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 })
  }
}
