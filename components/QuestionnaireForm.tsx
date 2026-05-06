'use client'

import type { AssessmentType } from '@/lib/types'
import { getQuestionsForAssessmentType } from '@/lib/udl'

const ANSWER_OPTIONS = ['Yes', 'Sometimes', 'Not yet', 'Not sure'] as const

interface Props {
  assessmentType: AssessmentType
  responses: Record<string, string>
  onChange: (responses: Record<string, string>) => void
}

export function QuestionnaireForm({ assessmentType, responses, onChange }: Props) {
  const questions = getQuestionsForAssessmentType(assessmentType)
  if (questions.length === 0) return null

  function setAnswer(checkpointId: string, answer: string) {
    onChange({ ...responses, [checkpointId]: answer })
  }

  return (
    <div className="space-y-3">
      {questions.map((q, idx) => (
        <div key={q.checkpointId} className="rounded-lg border border-sand bg-white p-3">
          <p className="text-sm text-teal mb-2 leading-relaxed">
            <span className="text-teal/40 mr-1">{idx + 1}.</span>
            {q.question}
          </p>
          <div className="flex flex-wrap gap-2">
            {ANSWER_OPTIONS.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => setAnswer(q.checkpointId, opt)}
                className={`rounded-md border px-3 py-1 text-xs transition-colors ${
                  responses[q.checkpointId] === opt
                    ? 'border-teal bg-teal text-white'
                    : 'border-sand text-teal/70 hover:border-teal/40 hover:bg-teal/5'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
