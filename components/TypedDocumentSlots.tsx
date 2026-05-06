'use client'

import { useRef, useState } from 'react'
import type { AssessmentDocument, DocumentType } from '@/lib/types'

interface SlotConfig {
  type: DocumentType
  label: string
  hint: string
  required: boolean
}

const SLOTS: SlotConfig[] = [
  { type: 'brief', label: 'Brief', hint: 'The assignment task instructions students see', required: true },
  { type: 'rubric', label: 'Rubric', hint: 'Marking criteria, performance descriptors', required: false },
  { type: 'exemplar', label: 'Exemplar', hint: 'Sample student work or worked example', required: false },
]

interface Props {
  documents: AssessmentDocument[]
  onChange: (documents: AssessmentDocument[]) => void
}

export function TypedDocumentSlots({ documents, onChange }: Props) {
  const [uploadingType, setUploadingType] = useState<DocumentType | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputs = useRef<Record<DocumentType, HTMLInputElement | null>>({
    brief: null, rubric: null, exemplar: null,
  })

  function getDoc(type: DocumentType): AssessmentDocument | undefined {
    return documents.find(d => d.type === type)
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
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json() as { extractedText?: string; assessments?: { title: string; description: string }[] }
      const extractedText = data.extractedText ?? data.assessments?.[0]?.description ?? ''
      const next = documents.filter(d => d.type !== type)
      next.push({ type, filename: file.name, extractedText })
      onChange(next)
    } catch {
      setUploadError(`Could not extract text from the ${type}. You can still continue without it.`)
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
                  disabled={isUploading}
                  className="rounded-md border border-teal/30 hover:border-teal/60 hover:bg-teal/5 px-3 py-1 text-xs font-medium text-teal disabled:opacity-60 transition-colors flex items-center gap-1.5"
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
          </div>
        )
      })}
      {uploadError && <p className="text-sm text-terracotta">{uploadError}</p>}
    </div>
  )
}
