import { describe, it, expect } from 'vitest'
import { buildPrefillPrompt, buildSuggestionsPrompt, buildExtractPrompt } from '@/lib/prompts'
import type { Assessment, CheckpointDef, CheckpointResult } from '@/lib/types'

const def: CheckpointDef = {
  code: '4.1',
  principle: 'Action & Expression',
  guideline: 'Interaction',
  title: 'Vary and honor the methods for response',
  harmful: ['Enforce a one-size-fits-all classroom'],
  helpful: ['Allow students to adjust their environment'],
}

const assessment: Assessment = {
  id: 'a1',
  name: 'Interactive Oral',
  type: 'interactive_oral',
  lane: 'lane1',
  description: 'group debate',
  documents: [{ type: 'brief', filename: 'brief.pdf', extractedText: 'Debate the topic.' }],
  responses: { 'io-4-1': 'students may sit or stand' },
}

describe('buildPrefillPrompt', () => {
  const { system, prompt } = buildPrefillPrompt(assessment, [{ id: 'io-4-1', def }])

  it('puts the checkpoint definitions and rating scale in the cacheable system block', () => {
    expect(system.text).toContain('io-4-1')
    expect(system.text).toContain('UDL 3.0 4.1')
    expect(system.text).toContain('"not_yet"')
    expect(system.text).toContain('Return ONLY the JSON array')
  })

  it('puts the per-assessment data in the user prompt, not the system block', () => {
    expect(prompt).toContain('Interactive Oral')
    expect(prompt).toContain('students may sit or stand')
    expect(prompt).toContain('Debate the topic.')
    expect(system.text).not.toContain('Interactive Oral')
  })

  it('keeps the cache breakpoint off (system block is under the Sonnet floor)', () => {
    expect(system.cache).toBe(false)
  })
})

describe('buildSuggestionsPrompt', () => {
  const checkpoints: CheckpointResult[] = [
    { checkpointId: 'io-2-4', assessmentId: 'a1', aiRating: 'not_yet', aiReasoning: '', userRating: null, acceptedAI: false },
  ]
  const getDef = (id: string): CheckpointDef | undefined =>
    id === 'io-2-4'
      ? { code: '2.4', principle: 'Representation', guideline: 'Language & Symbols', title: 'Address biases', harmful: [], helpful: [] }
      : undefined

  it('puts the static framing and JSON structure in the system block', () => {
    const { system } = buildSuggestionsPrompt(checkpoints, [assessment], getDef)
    expect(system.text).toContain('teaching support specialist at Curtin University')
    expect(system.text).toContain('"quickWins"')
  })

  it('puts the gap context in the user prompt', () => {
    const { prompt } = buildSuggestionsPrompt(checkpoints, [assessment], getDef)
    expect(prompt).toContain('[GAP]')
    expect(prompt).toContain('Interactive Oral')
    expect(prompt).toContain('UDL 2.4')
  })

  it('threads an optional focus into the user prompt', () => {
    const { system, prompt } = buildSuggestionsPrompt(checkpoints, [assessment], getDef, 'group work')
    expect(prompt).toContain('FOCUS:')
    expect(prompt).toContain('group work')
    expect(system.text).not.toContain('group work')
  })
})

describe('buildExtractPrompt', () => {
  it('produces type-specific instructions plus the JSON envelope', () => {
    expect(buildExtractPrompt('rubric').text).toContain('extracting marking rubrics')
    expect(buildExtractPrompt('exemplar').text).toContain('extracting student-work exemplars')
    expect(buildExtractPrompt('brief').text).toContain('extracting assessment briefs')
    expect(buildExtractPrompt(null).text).toContain('extracting assessment briefs') // default
    expect(buildExtractPrompt('brief').text).toContain('Return JSON only')
  })
})
