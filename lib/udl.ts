import udlData from '@/data/udl-checkpoints.json'
import type { CheckpointDef, UdlData, Assessment } from '@/lib/types'

// Double-cast: TS infers literal types from JSON imports; UdlData uses string-keyed maps.
const data = udlData as unknown as UdlData

export function getCheckpointDef(id: string): CheckpointDef | undefined {
  return data.checkpoints[id]
}

export function getAllCheckpointIds(): string[] {
  return Object.keys(data.checkpoints)
}

export function getCheckpointIdsForAssessments(assessments: Assessment[]): string[] {
  const ids = new Set<string>()
  for (const a of assessments) {
    const mapped = data.assessmentTypes[a.type] ?? []
    for (const id of mapped) ids.add(id)
  }
  return Array.from(ids)
}

export function getCheckpointDefsForAssessments(assessments: Assessment[]): CheckpointDef[] {
  return getCheckpointIdsForAssessments(assessments)
    .map(id => data.checkpoints[id])
    .filter((c): c is CheckpointDef => c !== undefined)
}

export function getAssessmentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    written_report: 'Written Report',
    portfolio: 'Portfolio',
    field_journal: 'Field Journal',
    invigilated_exam: 'Invigilated Exam',
    interactive_oral: 'Interactive Oral',
  }
  return labels[type] ?? type
}

export const ASSESSMENT_TYPE_OPTIONS = [
  { value: 'written_report', label: 'Written Report', lane: 'lane2' as const },
  { value: 'portfolio', label: 'Portfolio', lane: 'lane2' as const },
  { value: 'field_journal', label: 'Field Journal', lane: 'lane2' as const },
  { value: 'invigilated_exam', label: 'Invigilated Exam', lane: 'lane1' as const },
  { value: 'interactive_oral', label: 'Interactive Oral', lane: 'lane1' as const },
]
