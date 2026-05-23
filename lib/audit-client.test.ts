import { describe, it, expect, vi, afterEach } from 'vitest'
import { prefill, suggestions, extractDocument, AuditClientError } from '@/lib/audit-client'

interface FakeResponse {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

let lastUrl: string | undefined
let lastInit: RequestInit | undefined

function stubFetch(res: FakeResponse) {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    lastUrl = url
    lastInit = init
    return res as unknown as Response
  }))
}

afterEach(() => {
  vi.unstubAllGlobals()
  lastUrl = undefined
  lastInit = undefined
})

describe('audit-client', () => {
  it('prefill posts JSON to the route and returns the parsed array', async () => {
    stubFetch({ ok: true, status: 200, json: async () => [{ checkpointId: 'io-4-1', assessmentId: 'a1' }] })
    const out = await prefill({ assessments: [], checkpointIds: ['io-4-1'] })
    expect(out).toEqual([{ checkpointId: 'io-4-1', assessmentId: 'a1' }])
    expect(lastUrl).toBe('/api/prefill')
    expect(lastInit?.method).toBe('POST')
    expect(JSON.parse(lastInit?.body as string)).toEqual({ assessments: [], checkpointIds: ['io-4-1'] })
  })

  it('suggestions returns the parsed object', async () => {
    stubFetch({ ok: true, status: 200, json: async () => ({ quickWins: [], longerTerm: [] }) })
    expect(await suggestions({ checkpoints: [], assessments: [] })).toEqual({ quickWins: [], longerTerm: [] })
  })

  it('throws AuditClientError carrying the status and server message on a non-ok response', async () => {
    stubFetch({ ok: false, status: 429, json: async () => ({ error: 'Too many requests.' }) })
    let thrown: unknown
    try {
      await suggestions({ checkpoints: [], assessments: [] })
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(AuditClientError)
    const err = thrown as AuditClientError
    expect(err.status).toBe(429)
    expect(err.serverMessage).toBe('Too many requests.')
  })

  it('leaves serverMessage undefined when the error body is not JSON', async () => {
    stubFetch({ ok: false, status: 500, json: async () => { throw new Error('not json') } })
    let thrown: unknown
    try {
      await prefill({ assessments: [], checkpointIds: [] })
    } catch (e) {
      thrown = e
    }
    expect((thrown as AuditClientError).status).toBe(500)
    expect((thrown as AuditClientError).serverMessage).toBeUndefined()
  })

  it('extractDocument sends multipart form data and returns the response', async () => {
    stubFetch({ ok: true, status: 200, json: async () => ({ extractedText: 'x', documentType: 'brief', candidates: [] }) })
    const file = new File(['hello'], 'brief.txt', { type: 'text/plain' })
    const out = await extractDocument(file, 'brief')
    expect(out).toEqual({ extractedText: 'x', documentType: 'brief', candidates: [] })
    expect(lastUrl).toBe('/api/extract')
    expect(lastInit?.body).toBeInstanceOf(FormData)
    expect((lastInit?.body as FormData).get('documentType')).toBe('brief')
  })
})
