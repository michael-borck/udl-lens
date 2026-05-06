'use client'

import { useState } from 'react'
import type { Assessment, AssessmentType, AssessmentDocument } from '@/lib/types'
import { ASSESSMENT_TYPE_OPTIONS } from '@/lib/udl'
import { TypedDocumentSlots } from '@/components/TypedDocumentSlots'
import { QuestionnaireForm } from '@/components/QuestionnaireForm'

interface Props {
  initial?: Partial<Assessment>
  onSave: (assessment: Omit<Assessment, 'id'> & { id?: string }) => void
  onCancel: () => void
}

export function AssessmentForm({ initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<AssessmentType>(initial?.type ?? 'interactive_oral')
  const [lane, setLane] = useState<'lane1' | 'lane2'>(initial?.lane ?? 'lane1')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [documents, setDocuments] = useState<AssessmentDocument[]>(initial?.documents ?? [])
  const [responses, setResponses] = useState<Record<string, string>>(initial?.responses ?? {})

  const selectedTypeOption = ASSESSMENT_TYPE_OPTIONS.find(o => o.value === type)

  function handleTypeChange(value: AssessmentType) {
    setType(value)
    const opt = ASSESSMENT_TYPE_OPTIONS.find(o => o.value === value)
    if (opt) setLane(opt.lane)
    setResponses({})
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onSave({ id: initial?.id, name: name.trim(), type, lane, description, documents, responses })
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
          onChange={e => handleTypeChange(e.target.value as AssessmentType)}
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
                {l === 'lane1' ? 'Lane 1 - Secure' : 'Lane 2 - Non-secure'}
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
        <label className="block text-sm font-medium text-teal mb-2">
          Documents
          <span className="ml-1 text-teal/50 font-normal">(optional - helps the AI)</span>
        </label>
        <TypedDocumentSlots documents={documents} onChange={setDocuments} />
      </div>

      <div>
        <label className="block text-sm font-medium text-teal mb-1">
          Description (optional)
          <span className="ml-1 text-teal/50 font-normal">- extra context not captured by uploads</span>
        </label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Anything else the AI should know about how this assessment is delivered…"
          rows={3}
          className="w-full rounded-lg border border-sand px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/40 bg-white resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-teal mb-1">
          Quick self-report
          <span className="ml-1 text-teal/50 font-normal">- some UDL practices live in delivery, not the brief</span>
        </label>
        <QuestionnaireForm
          assessmentType={type}
          responses={responses}
          onChange={setResponses}
        />
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
