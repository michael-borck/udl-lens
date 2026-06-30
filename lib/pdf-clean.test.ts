import { describe, it, expect } from 'vitest'
import { cleanMarkdown as clean } from '@/lib/pdf-clean'

// The PDF renders model/user text via @react-pdf <Text>, which has no Markdown
// support - anything not stripped here shows up literally in the report. These
// cases are the corpus of artefacts the model actually emits; each must reduce
// to clean prose. A regression here is a regression in the downloadable report.
describe('cleanMarkdown', () => {
  it('strips inline formatting', () => {
    expect(clean('**bold**')).toBe('bold')
    expect(clean('*italic*')).toBe('italic')
    expect(clean('_under_')).toBe('under')
    expect(clean('`code`')).toBe('code')
  })

  it('strips markdown links, keeping the label', () => {
    expect(clean('[Curtin A2030](https://www.curtin.edu.au/assessment2030/)')).toBe('Curtin A2030')
    expect(clean('see [the guide](https://x.com) for more')).toBe('see the guide for more')
  })

  it('strips headers, blockquotes, and bullets', () => {
    expect(clean('# Heading')).toBe('Heading')
    expect(clean('## Sub')).toBe('Sub')
    expect(clean('> a quoted line')).toBe('a quoted line')
    expect(clean('- bullet')).toBe('bullet')
    expect(clean('* bullet')).toBe('bullet')
    expect(clean('+ bullet')).toBe('bullet')
  })

  it('strips leading list numbering so the PDF bullet is not doubled', () => {
    // The report prepends its own "{n}." before each suggestion, so a model
    // "1. foo" must become "foo" - otherwise it renders as "1. 1. foo".
    expect(clean('1. first')).toBe('first')
    expect(clean('2) second')).toBe('second')
    expect(clean('10. tenth')).toBe('tenth')
  })

  it('does not strip inline numbers or hashtags', () => {
    expect(clean('see checkpoint 8.1')).toBe('see checkpoint 8.1')
    expect(clean('issue #42')).toBe('issue #42')
  })

  it('collapses whitespace and trims', () => {
    expect(clean('  multiple   spaces  ')).toBe('multiple spaces')
    expect(clean('a\n\n\n\nb')).toBe('a\n\nb')
    expect(clean('\n  trimmed\n')).toBe('trimmed')
  })

  it('handles a realistic compound suggestion', () => {
    const nasty = '**Add** a [rubric](https://x.com) explaining criteria - see #8.1\n\n- point one\n- point two'
    expect(clean(nasty)).toBe('Add a rubric explaining criteria - see #8.1\n\npoint one\npoint two')
  })

  it('is a no-op on already-clean prose', () => {
    const ok = 'Add a marking rubric so students can see how each criterion is assessed.'
    expect(clean(ok)).toBe(ok)
  })
})
