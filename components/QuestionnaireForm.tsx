'use client'

import type { AssessmentType } from '@/lib/types'
import { getQuestionsForAssessmentType } from '@/lib/udl'

// 5-point scale: a graded gradient (Yes → Sometimes → Rarely → Not yet) plus
// "Not sure" as a non-graded escape. The answer string is passed verbatim to the
// AI prefill as self-report context; it is not used in scoring.ts.
const ANSWER_OPTIONS = ['Yes', 'Sometimes', 'Rarely', 'Not yet', 'Not sure'] as const

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
          <p id={`q-${q.checkpointId}`} className="text-sm text-teal mb-2 leading-relaxed">
            <span className="text-teal/70 mr-1">{idx + 1}.</span>
            {q.question}
          </p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby={`q-${q.checkpointId}`}>
            {ANSWER_OPTIONS.map(opt => (
              <button
                key={opt}
                type="button"
                role="radio"
                aria-checked={responses[q.checkpointId] === opt}
                onClick={() => setAnswer(q.checkpointId, opt)}
                className={`rounded-md border px-3 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/60 ${
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
