import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { extractText } from 'unpdf'
import { UdlReport, type PdfDownloadButtonProps } from '@/components/PdfReport'

// Mode B: prove cleanMarkdown is actually *called* on every model-derived
// string that reaches the PDF. We feed nasty markdown into the fields the
// report renders (suggestion text/why, audit notes), render the real document,
// extract its text, and assert no literal artefact survives.
//
// react-pdf compresses streams AND encodes text as hex per-glyph TJ arrays, so
// raw byte searches don't work; `unpdf` properly reconstructs readable text.

const NASTY = '**Bold** idea with a [link](https://x.com) and `code`\n# Header\n- bullet\n1. numbered'

const props: PdfDownloadButtonProps = {
  checkpoints: [
    { checkpointId: 'io-4-1', assessmentId: 'a1', aiRating: 'partial', aiReasoning: '', userRating: null, acceptedAI: false },
  ],
  assessments: [
    { id: 'a1', name: 'TestUnit101', type: 'interactive_oral', lane: 'lane1', documents: [], rubricInBrief: false, description: '', responses: {} },
  ],
  principleScores: [
    { principle: 'Engagement', label: 'Engagement', score: 1, total: 2, percentage: 50 },
  ],
  overallScore: 50,
  gradeLabel: 'Developing UDL Alignment',
  suggestions: {
    quickWins: [{ id: 's1', text: NASTY, why: NASTY, udlCodes: ['8.1'] }],
    longerTerm: [],
  },
  auditNotes: NASTY,
}

describe('UdlReport PDF render', () => {
  it('does not leak literal markdown into the rendered PDF text', async () => {
    const buf = await renderToBuffer(createElement(UdlReport, props))
    const { text } = await extractText(new Uint8Array(buf), { mergePages: true })

    // Self-check: the unit name must be extractable - otherwise extraction is
    // broken and the "no artefact" assertions below would pass vacuously.
    expect(text).toContain('TestUnit101')

    // No literal markdown survived cleanMarkdown into the rendered report.
    expect(text).not.toContain('**')
    expect(text).not.toContain('](')
    expect(text).not.toContain('# Header')
  }, 20000)
})
