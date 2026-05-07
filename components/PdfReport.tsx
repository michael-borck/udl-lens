'use client'

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  PDFDownloadLink,
} from '@react-pdf/renderer'
import type { CheckpointResult, Assessment, PrincipleScore, Suggestions } from '@/lib/types'
import { getCheckpointDef } from '@/lib/udl'

const styles = StyleSheet.create({
  page: { padding: 48, backgroundColor: '#FFFFFF', fontFamily: 'Helvetica' },
  header: { marginBottom: 32 },
  title: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: '#1B3A4B', marginBottom: 4 },
  subtitle: { fontSize: 10, color: '#6B8899' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#1B3A4B', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#E8E0D0', paddingBottom: 4 },
  hero: { backgroundColor: '#1B3A4B', padding: 20, borderRadius: 8, marginBottom: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLeft: { flex: 1 },
  heroTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', marginBottom: 2 },
  heroSub: { fontSize: 10, color: '#AABBC6' },
  heroScore: { fontSize: 36, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', textAlign: 'right' },
  heroGrade: { fontSize: 10, color: '#AABBC6', textAlign: 'right' },
  bar: { height: 8, borderRadius: 4, marginBottom: 8 },
  barBg: { backgroundColor: '#E8E0D0' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#F3EFE8', padding: 8, marginBottom: 1 },
  tableRow: { flexDirection: 'row', padding: '6 8', borderBottomWidth: 1, borderBottomColor: '#F3EFE8' },
  tableCell: { fontSize: 8, color: '#1B3A4B' },
  suggestionItem: { flexDirection: 'row', marginBottom: 8 },
  bullet: { width: 16, fontSize: 10, color: '#C96B2F', fontFamily: 'Helvetica-Bold' },
  suggestionText: { flex: 1, fontSize: 10, color: '#1B3A4B', lineHeight: 1.4 },
})

const RATING_LABEL: Record<string, string> = { met: 'Met', partial: 'Partial', not_yet: 'Not yet' }

interface ReportProps {
  checkpoints: CheckpointResult[]
  assessments: Assessment[]
  principleScores: PrincipleScore[]
  overallScore: number
  gradeLabel: string
  suggestions: Suggestions | null
  auditNotes: string
}

function UdlReport({ checkpoints, assessments, principleScores, overallScore, gradeLabel, suggestions, auditNotes }: ReportProps) {
  const visibleQuickWins = suggestions?.quickWins.filter(s => !s.dismissed) ?? []
  const visibleLongerTerm = suggestions?.longerTerm.filter(s => !s.dismissed) ?? []
  const unitName = assessments.map(a => a.name).join(', ')
  return (
    <Document title="UDL Lens Report" author="UDL Lens - Curtin University">
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>UDL Lens Report</Text>
          <Text style={styles.subtitle}>Assessment 2030 · UDL Guidelines 3.0 · Curtin University</Text>
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroTitle}>{unitName}</Text>
            <Text style={styles.heroSub}>UDL Audit Results</Text>
          </View>
          <View>
            <Text style={styles.heroScore}>{overallScore}%</Text>
            <Text style={styles.heroGrade}>{gradeLabel}</Text>
          </View>
        </View>

        {/* Audit notes */}
        {auditNotes.trim() && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Audit notes</Text>
            <Text style={{ fontSize: 10, color: '#1B3A4B', lineHeight: 1.5 }}>
              {auditNotes}
            </Text>
          </View>
        )}

        {/* Principle scores */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>UDL Principle Scores</Text>
          {principleScores.map(s => (
            <View key={s.principle} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={{ fontSize: 10, color: '#1B3A4B' }}>{s.label}</Text>
                <Text style={{ fontSize: 10, color: '#6B8899' }}>{s.percentage}%</Text>
              </View>
              <View style={[styles.bar, styles.barBg]}>
                <View style={[styles.bar, {
                  width: `${s.percentage}%` as unknown as number,
                  backgroundColor: s.percentage >= 75 ? '#22c55e' : s.percentage >= 45 ? '#D4A017' : '#C96B2F',
                  marginBottom: 0,
                }]} />
              </View>
            </View>
          ))}
        </View>

        {/* Suggestions */}
        {suggestions && (visibleQuickWins.length > 0 || visibleLongerTerm.length > 0) && (
          <View style={styles.section}>
            {visibleQuickWins.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Quick wins</Text>
                {visibleQuickWins.map((s, i) => (
                  <View key={s.id} style={styles.suggestionItem}>
                    <Text style={styles.bullet}>{i + 1}.</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.suggestionText, s.done ? { textDecoration: 'line-through' as const } : {}]}>
                        {s.text}{s.done ? ' (done)' : ''}{s.userAuthored ? ' (your suggestion)' : ''}
                      </Text>
                      {s.why && (
                        <Text style={{ fontSize: 9, color: '#5A7589', marginTop: 2, lineHeight: 1.4 }}>
                          Why: {s.why}
                        </Text>
                      )}
                      {s.udlCodes.length > 0 && !s.userAuthored && (
                        <Text style={{ fontSize: 8, color: '#1B3A4B', marginTop: 2 }}>
                          UDL {s.udlCodes.join(', ')}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </>
            )}

            {visibleLongerTerm.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, visibleQuickWins.length > 0 ? { marginTop: 16 } : {}]}>Longer-term improvements</Text>
                {visibleLongerTerm.map((s, i) => (
                  <View key={s.id} style={styles.suggestionItem}>
                    <Text style={styles.bullet}>{i + 1}.</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.suggestionText, s.done ? { textDecoration: 'line-through' as const } : {}]}>
                        {s.text}{s.done ? ' (done)' : ''}{s.userAuthored ? ' (your suggestion)' : ''}
                      </Text>
                      {s.why && (
                        <Text style={{ fontSize: 9, color: '#5A7589', marginTop: 2, lineHeight: 1.4 }}>
                          Why: {s.why}
                        </Text>
                      )}
                      {s.udlCodes.length > 0 && !s.userAuthored && (
                        <Text style={{ fontSize: 8, color: '#1B3A4B', marginTop: 2 }}>
                          UDL {s.udlCodes.join(', ')}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </>
            )}

            <Text style={{ fontSize: 8, color: '#6B8899', marginTop: 12 }}>
              Codes refer to UDL Guidelines 3.0 considerations - https://udlguidelines.cast.org/
            </Text>
          </View>
        )}

        {/* Checkpoint table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All Checkpoints</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCell, { flex: 2, fontFamily: 'Helvetica-Bold' }]}>Checkpoint</Text>
            <Text style={[styles.tableCell, { flex: 1.5, fontFamily: 'Helvetica-Bold' }]}>Assessment</Text>
            <Text style={[styles.tableCell, { flex: 0.8, fontFamily: 'Helvetica-Bold' }]}>Status</Text>
          </View>
          {checkpoints.map(c => {
            const def = getCheckpointDef(c.checkpointId)
            const assessment = assessments.find(a => a.id === c.assessmentId)
            const rating = c.userRating ?? c.aiRating
            if (!def) return null
            return (
              <View key={`${c.checkpointId}-${c.assessmentId}`} style={styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 2 }]}>{def.code} {def.title}</Text>
                <Text style={[styles.tableCell, { flex: 1.5, color: '#6B8899' }]}>{assessment?.name ?? '-'}</Text>
                <Text style={[styles.tableCell, { flex: 0.8 }]}>{RATING_LABEL[rating]}</Text>
              </View>
            )
          })}
        </View>

        <Text style={{ fontSize: 8, color: '#AABBC6', textAlign: 'center', marginTop: 24 }}>
          Generated by UDL Lens · Curtin University · Assessment 2030
        </Text>
      </Page>
    </Document>
  )
}

export type PdfDownloadButtonProps = ReportProps

export function PdfDownloadButton(props: PdfDownloadButtonProps) {
  return (
    <PDFDownloadLink
      document={<UdlReport {...props} />}
      fileName="udl-lens-report.pdf"
    >
      {({ loading, error }) => (
        <button
          disabled={loading}
          className="rounded-lg bg-teal text-white px-5 py-2 text-sm font-medium hover:bg-teal-light transition-colors disabled:opacity-60"
        >
          {loading ? 'Preparing PDF…' : error ? 'PDF unavailable - try again' : 'Download PDF report'}
        </button>
      )}
    </PDFDownloadLink>
  )
}
