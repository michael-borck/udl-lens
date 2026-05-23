import { NextResponse } from 'next/server'
import mammoth from 'mammoth'
import type { Candidate } from '@/lib/types'
import { runExtract } from '@/lib/audit'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

// Files are read fully into memory (arrayBuffer) before going to the model, so
// cap the size to protect server RAM and token cost. Briefs are well under this.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB

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

    const buffer = Buffer.from(await file.arrayBuffer())
    const fileName = file.name.toLowerCase()

    const documentTypeRaw = formData.get('documentType')
    const documentType: string | null =
      documentTypeRaw === null ? null : String(documentTypeRaw)

    let candidates: Candidate[]
    let extractedText = ''

    if (fileName.endsWith('.pdf')) {
      // PDFs go to the model as a binary document; there is no plain-text source
      // the assessment detection runs against. Leave extractedText empty so the
      // client can fall back to candidates[0].content.
      candidates = await runExtract({ base64: buffer.toString('base64') }, documentType)
    } else if (fileName.endsWith('.docx')) {
      extractedText = (await mammoth.extractRawText({ buffer })).value
      candidates = await runExtract({ text: extractedText }, documentType)
    } else if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
      extractedText = buffer.toString('utf-8')
      candidates = await runExtract({ text: extractedText }, documentType)
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload PDF, DOCX, TXT, or MD.' },
        { status: 400 },
      )
    }

    return NextResponse.json({ extractedText, documentType, candidates })
  } catch (err) {
    // ModelCallError (retries exhausted) or file parsing failure -> 500.
    console.error('/api/extract error:', err)
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 })
  }
}
