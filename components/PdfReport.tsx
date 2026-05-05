'use client'

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  PDFDownloadLink,
} from '@react-pdf/renderer'
import type { CheckpointResult, Assessment, DimensionScore, Suggestions } from '@/lib/types'
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
  dimensionScores: DimensionScore[]
  overallScore: number
  gradeLabel: string
  suggestions: Suggestions | null
}

function UdlReport({ checkpoints, assessments, dimensionScores, overallScore, gradeLabel, suggestions }: ReportProps) {
  const unitName = assessments.map(a => a.name).join(', ')
  return (
    <Document title="UDL Lens Report" author="UDL Lens — Curtin University">
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

        {/* Dimension scores */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>UDL Dimension Scores</Text>
          {dimensionScores.map(s => (
            <View key={s.dimension} style={{ marginBottom: 8 }}>
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
        {suggestions && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recommendations</Text>
            <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#1B3A4B', marginBottom: 6 }}>Quick Wins</Text>
            {suggestions.quickWins.map((win, i) => (
              <View key={i} style={styles.suggestionItem}>
                <Text style={styles.bullet}>{i + 1}.</Text>
                <Text style={styles.suggestionText}>{win}</Text>
              </View>
            ))}
            {suggestions.longerTerm.length > 0 && (
              <>
                <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#1B3A4B', marginTop: 10, marginBottom: 6 }}>Longer-term Improvements</Text>
                {suggestions.longerTerm.map((item, i) => (
                  <View key={i} style={styles.suggestionItem}>
                    <Text style={styles.bullet}>{i + 1}.</Text>
                    <Text style={styles.suggestionText}>{item}</Text>
                  </View>
                ))}
              </>
            )}
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
                <Text style={[styles.tableCell, { flex: 1.5, color: '#6B8899' }]}>{assessment?.name ?? '—'}</Text>
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

export interface PdfDownloadButtonProps extends ReportProps {}

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
          {loading ? 'Preparing PDF…' : error ? 'PDF unavailable — try again' : 'Download PDF report'}
        </button>
      )}
    </PDFDownloadLink>
  )
}
