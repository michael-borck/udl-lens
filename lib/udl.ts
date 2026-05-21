import udlData from '@/data/udl-checkpoints.json'
import type { CheckpointDef, UdlData, Assessment, AssessmentType } from '@/lib/types'

// Double-cast: TS infers literal types from JSON imports; UdlData uses string-keyed maps.
const data = udlData as unknown as UdlData

export function getCheckpointDef(id: string): CheckpointDef | undefined {
  return data.checkpoints[id]
}

export function getCheckpointIdsForAssessments(assessments: Assessment[]): string[] {
  const ids = new Set<string>()
  for (const a of assessments) {
    const mapped = data.assessmentTypes[a.type] ?? []
    for (const id of mapped) ids.add(id)
  }
  return Array.from(ids)
}

export function getAssessmentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    interactive_oral: 'Interactive Oral (Collaborative)',
    field_journal: 'Field Journal with Media Analysis',
  }
  return labels[type] ?? type
}

export const ASSESSMENT_TYPE_OPTIONS = [
  { value: 'interactive_oral', label: 'Interactive Oral (Collaborative)', lane: 'lane1' as const },
  { value: 'field_journal', label: 'Field Journal with Media Analysis', lane: 'lane2' as const },
]

export function getQuestionsForAssessmentType(type: AssessmentType): { checkpointId: string; question: string }[] {
  const ids = data.assessmentTypes[type] ?? []
  return ids
    .map(id => {
      const def = data.checkpoints[id]
      if (!def?.question) return null
      return { checkpointId: id, question: def.question }
    })
    .filter((q): q is { checkpointId: string; question: string } => q !== null)
}
