'use client'

import { useRef, useState } from 'react'
import type { AssessmentDocument, DocumentType } from '@/lib/types'
import { AssessmentPickerModal, type Candidate } from '@/components/AssessmentPickerModal'

interface SlotConfig {
  type: DocumentType
  label: string
  hint: string
  required: boolean
  note?: string
}

const SLOTS: SlotConfig[] = [
  { type: 'brief', label: 'Brief', hint: 'The assignment task instructions students see', required: true },
  { type: 'rubric', label: 'Rubric', hint: 'Marking criteria, performance descriptors', required: false },
  {
    type: 'exemplar',
    label: 'Exemplar',
    hint: 'Sample student work or worked example',
    required: false,
    note: 'Rough, partial, or imperfect examples are fine - it is read only as a signal of what you expect, never graded or judged. Remove any student names first; nothing is stored.',
  },
]

interface Props {
  documents: AssessmentDocument[]
  onChange: (documents: AssessmentDocument[]) => void
}

export function TypedDocumentSlots({ documents, onChange }: Props) {
  const [uploadingType, setUploadingType] = useState<DocumentType | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [pickerState, setPickerState] = useState<{ type: DocumentType; candidates: Candidate[] } | null>(null)
  const pendingFilename = useRef<Record<DocumentType, string>>({ brief: '', rubric: '', exemplar: '' })
  const fileInputs = useRef<Record<DocumentType, HTMLInputElement | null>>({
    brief: null, rubric: null, exemplar: null,
  })

  function getDoc(type: DocumentType): AssessmentDocument | undefined {
    return documents.find(d => d.type === type)
  }

  function finishUpload(type: DocumentType, filename: string, content: string) {
    const next = documents.filter(d => d.type !== type)
    next.push({ type, filename, extractedText: content })
    onChange(next)
  }

  async function handleFileUpload(type: DocumentType, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingType(type)
    setUploadError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('documentType', type)
      const res = await fetch('/api/extract', { method: 'POST', body: fd })
      if (!res.ok) {
        // Surface actionable server errors (file too large, rate limited) verbatim;
        // fall through to the generic message for everything else.
        if (res.status === 413 || res.status === 429) {
          const serverError = await res.json().then(d => d?.error).catch(() => null)
          setUploadError(serverError ?? 'Upload could not be processed. Please try again.')
          return
        }
        throw new Error('Upload failed')
      }
      const data = await res.json() as { extractedText?: string; candidates?: Candidate[] }
      const candidates = data.candidates ?? []
      const fallback = data.extractedText ?? ''

      if (candidates.length === 0) {
        if (type === 'brief' && fallback) {
          finishUpload(type, file.name, fallback)
        } else if (type === 'brief') {
          setUploadError(
            'No readable text could be extracted from this brief. The AI cannot rate this ' +
            'assessment from the brief - ratings would be generic guesses based only on the ' +
            'assessment type. Upload a text-based PDF or DOCX (not a scan/image), or paste the ' +
            'task details into the Description box below.'
          )
        } else {
          setUploadError(`Could not find ${type === 'exemplar' ? 'an' : 'a'} ${type} in that document. Try uploading a different file.`)
        }
        return
      }

      if (candidates.length === 1) {
        finishUpload(type, file.name, candidates[0].content)
        return
      }

      pendingFilename.current[type] = file.name
      setPickerState({ type, candidates })
    } catch {
      setUploadError(
        type === 'brief'
          ? 'Extraction failed for this brief. Without the brief text the AI rates this ' +
            'assessment only from its type, so the results will be generic. Try a different ' +
            'file, or paste the task details into the Description box below before continuing.'
          : `Could not extract text from the ${type}. You can continue without it - the AI will note it was not provided.`
      )
    } finally {
      setUploadingType(null)
      const input = fileInputs.current[type]
      if (input) input.value = ''
    }
  }

  function handleRemove(type: DocumentType) {
    onChange(documents.filter(d => d.type !== type))
  }

  return (
    <div className="space-y-2">
      {SLOTS.map(slot => {
        const doc = getDoc(slot.type)
        const isUploading = uploadingType === slot.type
        const isBusy = uploadingType !== null || pickerState !== null
        return (
          <div key={slot.type} className="rounded-lg border border-sand bg-white">
            <div className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-teal">{slot.label}</span>
                  {slot.required && <span className="text-xs text-terracotta">recommended</span>}
                </div>
                <p className="text-xs text-teal/50 truncate">{doc ? doc.filename : slot.hint}</p>
              </div>
              {doc ? (
                <button
                  type="button"
                  onClick={() => handleRemove(slot.type)}
                  className="text-xs text-teal/60 hover:text-terracotta underline"
                >
                  Remove
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputs.current[slot.type]?.click()}
                  disabled={isBusy}
                  className="rounded-md border border-teal/30 hover:border-teal/60 hover:bg-teal/5 px-3 py-1 text-xs font-medium text-teal disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                >
                  {isUploading ? (
                    <>
                      <span className="w-3 h-3 border-2 border-teal/30 border-t-teal rounded-full animate-spin" aria-hidden="true" />
                      Extracting…
                    </>
                  ) : (
                    'Upload'
                  )}
                </button>
              )}
              <input
                ref={el => { fileInputs.current[slot.type] = el }}
                type="file"
                accept=".pdf,.docx,.txt,.md"
                onChange={e => handleFileUpload(slot.type, e)}
                className="hidden"
              />
            </div>
            {slot.note && !doc && (
              <p className="px-3 pb-2 text-xs text-teal/55 leading-relaxed">{slot.note}</p>
            )}
          </div>
        )
      })}
      {pickerState && (
        <AssessmentPickerModal
          candidates={pickerState.candidates}
          title={
            pickerState.type === 'brief' ? 'Pick which assessment this is' :
            pickerState.type === 'rubric' ? 'Pick which rubric to use' :
            'Pick which exemplar to use'
          }
          onSelect={c => {
            finishUpload(pickerState.type, pendingFilename.current[pickerState.type], c.content)
            setPickerState(null)
          }}
          onClose={() => setPickerState(null)}
        />
      )}
      {uploadError && (
        <div
          role="alert"
          className="rounded-lg border border-terracotta/50 bg-terracotta/10 px-3 py-2 text-sm text-terracotta-dark leading-relaxed flex gap-2"
        >
          <span aria-hidden="true" className="font-bold shrink-0">!</span>
          <span>{uploadError}</span>
        </div>
      )}
    </div>
  )
}
