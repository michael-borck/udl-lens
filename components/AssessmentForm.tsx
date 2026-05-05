'use client'

import { useState, useRef } from 'react'
import type { Assessment, AssessmentType } from '@/lib/types'
import { ASSESSMENT_TYPE_OPTIONS } from '@/lib/udl'

interface Props {
  initial?: Partial<Assessment>
  onSave: (assessment: Omit<Assessment, 'id'> & { id?: string }) => void
  onCancel: () => void
}

export function AssessmentForm({ initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState(initial?.type ?? 'written_report')
  const [lane, setLane] = useState<'lane1' | 'lane2'>(initial?.lane ?? 'lane2')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedTypeOption = ASSESSMENT_TYPE_OPTIONS.find(o => o.value === type)

  function handleTypeChange(value: string) {
    setType(value as AssessmentType)
    const opt = ASSESSMENT_TYPE_OPTIONS.find(o => o.value === value)
    if (opt) setLane(opt.lane)
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/extract', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json() as { description: string }
      setDescription(data.description)
    } catch {
      setUploadError('Could not extract text from file. Please type a description instead.')
    } finally {
      setUploading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onSave({ id: initial?.id, name: name.trim(), type, lane, description })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-teal mb-1">Assessment name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Research Report, Final Exam"
          required
          className="w-full rounded-lg border border-sand px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/40 bg-white"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-teal mb-1">Assessment type</label>
        <select
          value={type}
          onChange={e => handleTypeChange(e.target.value)}
          className="w-full rounded-lg border border-sand px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/40 bg-white"
        >
          {ASSESSMENT_TYPE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-teal mb-1">A2030 Lane</label>
        <div className="flex gap-3">
          {(['lane1', 'lane2'] as const).map(l => (
            <label key={l} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="lane"
                value={l}
                checked={lane === l}
                onChange={() => setLane(l)}
                className="accent-teal"
              />
              <span className="text-sm text-teal">
                {l === 'lane1' ? 'Lane 1 — Secure' : 'Lane 2 — Non-secure'}
              </span>
            </label>
          ))}
        </div>
        {selectedTypeOption && (
          <p className="text-xs text-teal/50 mt-1">
            Default for {selectedTypeOption.label}: {selectedTypeOption.lane === 'lane1' ? 'Lane 1' : 'Lane 2'}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-teal mb-1">
          Assessment description
          <span className="ml-1 text-teal/50 font-normal">(optional — helps AI give better ratings)</span>
        </label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Describe the assessment task, requirements, and marking criteria..."
          rows={4}
          className="w-full rounded-lg border border-sand px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/40 bg-white resize-none"
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-sm text-teal underline hover:text-teal-light disabled:opacity-50"
          >
            {uploading ? 'Extracting…' : 'Or upload brief (PDF / DOCX)'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
        {uploadError && (
          <p className="mt-1 text-sm text-terracotta">{uploadError}</p>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          className="rounded-lg bg-teal text-white px-5 py-2 text-sm font-medium hover:bg-teal-light transition-colors"
        >
          {initial?.id ? 'Save changes' : 'Add assessment'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-sand text-teal px-5 py-2 text-sm hover:bg-sand transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
