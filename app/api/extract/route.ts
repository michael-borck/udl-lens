import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import mammoth from 'mammoth'

const client = new Anthropic()
const MODEL = process.env.EXTRACT_MODEL ?? process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let extractedText = ''

    const fileName = file.name.toLowerCase()

    if (fileName.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer })
      extractedText = result.value
    } else if (fileName.endsWith('.pdf')) {
      // Send PDF natively to Claude as a document block
      const base64 = buffer.toString('base64')
      type MessageParam = Parameters<typeof client.messages.create>[0]['messages'][0]
      const message: MessageParam = {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64,
            },
          },
          {
            type: 'text',
            text: 'Extract a clear, structured plain-text description of this assignment brief. Include: the task type, what students must do, how they will be assessed, any specific constraints or requirements, and the marking criteria. Be concise but complete. Return plain text only, no markdown.',
          },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ] as any,
      }
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        messages: [message],
      })
      const textBlock = response.content.find(b => b.type === 'text')
      extractedText = textBlock && textBlock.type === 'text' ? textBlock.text : ''
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload PDF or DOCX.' },
        { status: 400 }
      )
    }

    if (!extractedText.trim()) {
      return NextResponse.json({ error: 'Could not extract text from file.' }, { status: 422 })
    }

    return NextResponse.json({ description: extractedText.trim() })
  } catch (err) {
    console.error('/api/extract error:', err)
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 })
  }
}
