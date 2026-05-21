import { NextResponse } from 'next/server'
import mammoth from 'mammoth'
import { getClient, resolveModel, parseJsonResponse, getResponseText } from '@/lib/llm'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

// Files are read fully into memory (arrayBuffer) before going to the model, so
// cap the size to protect server RAM and token cost. Briefs are well under this.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB

interface Candidate {
  title: string
  content: string
}

function promptForDocumentType(docType: string | null): string {
  if (docType === 'rubric') {
    return `You are extracting marking rubrics from a document. Find every rubric or marking-criteria block in the document. For each, return a "title" (e.g. "Rubric for Final Report" or the assessment name if labelled) and "content" (the rubric text itself: criteria, performance descriptors, weights). If the document does not appear to contain a rubric, return an empty array.`
  }
  if (docType === 'exemplar') {
    return `You are extracting student-work exemplars from a document. Find every exemplar, sample student response, or worked example. For each, return a "title" (e.g. "High Distinction example" or the assessment name) and "content" (the exemplar text or annotated commentary). If the document does not appear to contain an exemplar, return an empty array.`
  }
  // Default: brief
  return `You are extracting assessment briefs from a document. Find every distinct assessment task in the document. For each, return a "title" (the assessment name) and "content" (the brief: task description, requirements, deliverables, due dates - everything a student would need). If the document only contains one assessment, return an array with one entry. If the document is itself an assessment brief (not a unit outline), return one entry with the document treated as a single brief. If the document contains no assessment information at all, return an empty array - do not invent one.`
}

function buildPrompt(docType: string | null): string {
  return `${promptForDocumentType(docType)}

Return JSON only, no other text:
{
  "candidates": [
    {"title": "...", "content": "..."}
  ]
}`
}

function isCandidate(c: unknown): c is Candidate {
  if (!c || typeof c !== 'object') return false
  const obj = c as Record<string, unknown>
  return typeof obj.title === 'string' && typeof obj.content === 'string'
}

function parseCandidates(raw: string): Candidate[] {
  const parsed = parseJsonResponse(raw)
  if (!parsed || typeof parsed !== 'object') return []
  const list = (parsed as Record<string, unknown>).candidates
  if (!Array.isArray(list)) return []
  return list.filter(isCandidate)
}

async function extractWithAI(text: string, documentType: string | null): Promise<Candidate[]> {
  const prompt = buildPrompt(documentType)
  const response = await getClient().messages.create({
    model: resolveModel('extract'),
    max_tokens: 2048,
    messages: [{ role: 'user', content: `${prompt}\n\nDOCUMENT:\n${text}` }],
  })
  return parseCandidates(getResponseText(response.content))
}

async function extractPdfWithAI(base64: string, documentType: string | null): Promise<Candidate[]> {
  const client = getClient()
  const prompt = buildPrompt(documentType)
  type MessageParam = Parameters<typeof client.messages.create>[0]['messages'][0]
  const message: MessageParam = {
    role: 'user',
    content: [
      {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64 },
      },
      { type: 'text', text: prompt },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any,
  }
  const response = await client.messages.create({
    model: resolveModel('extract'),
    max_tokens: 2048,
    messages: [message],
  })
  return parseCandidates(getResponseText(response.content))
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
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `File is too large. Maximum size is ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.` },
        { status: 413 },
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const fileName = file.name.toLowerCase()

    const documentTypeRaw = formData.get('documentType')
    const documentType: string | null =
      documentTypeRaw === null ? null : String(documentTypeRaw)

    let candidates: Candidate[]
    let extractedText = ''

    if (fileName.endsWith('.pdf')) {
      // PDFs are sent to Claude as a binary document; there is no plain-text
      // source the assessment detection runs against. Leave extractedText
      // empty so the client can fall back to candidates[0].content.
      candidates = await extractPdfWithAI(buffer.toString('base64'), documentType)
    } else if (fileName.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer })
      extractedText = result.value
      candidates = await extractWithAI(extractedText, documentType)
    } else if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
      extractedText = buffer.toString('utf-8')
      candidates = await extractWithAI(extractedText, documentType)
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload PDF, DOCX, TXT, or MD.' },
        { status: 400 }
      )
    }

    return NextResponse.json({ extractedText, documentType, candidates })
  } catch (err) {
    console.error('/api/extract error:', err)
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 })
  }
}
