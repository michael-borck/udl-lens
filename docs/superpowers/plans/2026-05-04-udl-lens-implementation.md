# UDL Lens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build UDL Lens — a three-screen web app where Curtin academics audit unit assessments against UDL Guidelines 3.0, with Claude pre-filling checkpoint ratings from uploaded briefs and exporting a PDF report.

**Architecture:** Next.js 14 App Router with three route segments (`/`, `/review`, `/results`); session state lives in a React Context provider that wraps the whole app; all Claude API calls are confined to `/app/api/` route handlers that never expose the API key to the browser.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS (custom theme), Recharts (radar chart), @react-pdf/renderer (client-side PDF), @anthropic-ai/sdk (claude-sonnet-4-6), mammoth (DOCX extraction), Google Fonts (Fraunces + Plus Jakarta Sans).

> **Note on testing:** The spec explicitly places "Automated test suite" out of scope for this prototype. Each task uses manual verification via `npm run dev` instead of automated tests.

---

## File Map

```
/
├── app/
│   ├── layout.tsx                      # Root layout: fonts, Providers wrapper, metadata
│   ├── page.tsx                        # Step 1 — Assessment entry
│   ├── globals.css                     # CSS reset + Tailwind base + custom vars
│   ├── review/
│   │   └── page.tsx                    # Step 2 — Checkpoint review
│   └── results/
│       └── page.tsx                    # Step 3 — Results screen
│   └── api/
│       ├── extract/route.ts            # POST /api/extract — file → description via Claude
│       ├── prefill/route.ts            # POST /api/prefill — assessments → AI ratings
│       └── suggestions/route.ts       # POST /api/suggestions — gaps → quick wins
├── components/
│   ├── Providers.tsx                   # Client wrapper: SessionContext provider
│   ├── AssessmentCard.tsx              # Read-only assessment summary card (Step 1)
│   ├── AssessmentForm.tsx              # Add/edit assessment modal form (Step 1)
│   ├── ProgressBar.tsx                 # Horizontal progress bar (Step 2)
│   ├── CheckpointNav.tsx               # Sticky left nav with status dots (Step 2)
│   ├── CheckpointCard.tsx              # Checkpoint detail + rating UI (Step 2)
│   ├── ResultsRadarChart.tsx           # Recharts radar chart (Step 3)
│   ├── DimensionBars.tsx               # Per-dimension score bars (Step 3)
│   ├── CheckpointTable.tsx             # Checkpoint summary table (Step 3)
│   ├── SuggestionsList.tsx             # Quick wins + improvements (Step 3)
│   ├── PdfReport.tsx                   # @react-pdf/renderer document (Step 3)
│   └── ResetModal.tsx                  # "Clear data?" confirmation modal
├── context/
│   └── SessionContext.tsx              # SessionState, useReducer, typed actions
├── lib/
│   ├── types.ts                        # All shared TypeScript types
│   ├── udl.ts                          # Helpers: get checkpoints for assessments
│   └── scoring.ts                      # Compute per-dimension scores + overall %
├── data/
│   └── udl-checkpoints.json            # UDL 3.0 checkpoint definitions + assessment mappings
├── .env.example
├── next.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json` (via npx)
- Create: `.env.example`
- Create: `next.config.ts`

- [ ] **Step 1: Scaffold Next.js 14 project**

Run from the repo root (answer prompts as shown):

```bash
npx create-next-app@14 . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir \
  --import-alias "@/*"
```

When prompted about existing files (`README.md`, `CLAUDE.md`), choose **keep existing**.

- [ ] **Step 2: Install additional dependencies**

```bash
npm install @anthropic-ai/sdk recharts @react-pdf/renderer mammoth
npm install -D @types/mammoth
```

- [ ] **Step 3: Create `.env.example`**

```bash
# .env.example
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Copy to `.env.local` and add your real key:

```bash
cp .env.example .env.local
```

- [ ] **Step 4: Update `next.config.ts`**

Replace the generated file:

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['mammoth'],
  },
}

export default nextConfig
```

- [ ] **Step 5: Verify dev server starts**

```bash
npm run dev
```

Expected: Server starts at `http://localhost:3000` with no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js 14 project with dependencies"
```

---

## Task 2: Types + UDL Checkpoint Data + Utilities

**Files:**
- Create: `lib/types.ts`
- Create: `data/udl-checkpoints.json`
- Create: `lib/udl.ts`
- Create: `lib/scoring.ts`

- [ ] **Step 1: Create `lib/types.ts`**

```typescript
export type Rating = 'not_yet' | 'partial' | 'met'
export type Lane = 'lane1' | 'lane2'
export type Dimension =
  | 'representation'
  | 'engagement'
  | 'expression'
  | 'accessibility'
  | 'flexibility'
  | 'equity'

export interface Assessment {
  id: string
  name: string
  type: string
  lane: Lane
  description: string
}

export interface CheckpointDef {
  code: string
  principle: 'Representation' | 'Engagement' | 'Expression'
  dimension: Dimension
  title: string
  description: string
  harmful: string[]
  helpful: string[]
}

export interface CheckpointResult {
  checkpointId: string
  assessmentId: string
  aiRating: Rating
  aiReasoning: string
  userRating: Rating | null
  overridden: boolean
}

export interface Suggestions {
  quickWins: string[]
  longerTerm: string[]
}

export interface SessionState {
  assessments: Assessment[]
  checkpoints: CheckpointResult[]
  suggestions: Suggestions | null
}

export type SessionAction =
  | { type: 'SET_ASSESSMENTS'; assessments: Assessment[] }
  | { type: 'SET_CHECKPOINTS'; checkpoints: CheckpointResult[] }
  | { type: 'UPDATE_CHECKPOINT'; checkpointId: string; assessmentId: string; userRating: Rating }
  | { type: 'SET_SUGGESTIONS'; suggestions: Suggestions }
  | { type: 'RESET' }

export interface UdlData {
  checkpoints: Record<string, CheckpointDef>
  assessmentTypes: Record<string, string[]>
}

export interface DimensionScore {
  dimension: Dimension
  label: string
  score: number
  total: number
  percentage: number
}
```

- [ ] **Step 2: Create `data/udl-checkpoints.json`**

```json
{
  "checkpoints": {
    "r1": {
      "code": "1.1",
      "principle": "Representation",
      "dimension": "representation",
      "title": "Brief available in multiple accessible formats",
      "description": "The assignment brief and instructions are available in more than one format so students can access them in the way that suits them best.",
      "harmful": [
        "Instructions provided as a scanned image PDF with no text layer",
        "Brief only available during a single timetabled session",
        "Dense walls of text with no headings or visual structure"
      ],
      "helpful": [
        "Brief available as both PDF and HTML on the LMS",
        "Clear headings, subheadings, and ample white space throughout",
        "Key dates and requirements presented in a summary table"
      ]
    },
    "r2": {
      "code": "2.1",
      "principle": "Representation",
      "dimension": "representation",
      "title": "Plain-language instructions",
      "description": "Instructions use clear, accessible language and define any discipline-specific or assessment-specific terminology.",
      "harmful": [
        "Instructions assume implicit knowledge of marking conventions",
        "Acronyms used without definition (e.g., 'APA', 'LO', 'A2030')",
        "Passive, bureaucratic language that obscures the actual task"
      ],
      "helpful": [
        "Each task step is written as a direct, active instruction",
        "Technical or discipline terms are defined on first use",
        "A plain-English summary of 'what you need to do' is included"
      ]
    },
    "r3": {
      "code": "3.2",
      "principle": "Representation",
      "dimension": "representation",
      "title": "Explicit success criteria and rubric",
      "description": "Students are given a transparent rubric or marking guide that makes success criteria concrete before they begin.",
      "harmful": [
        "Rubric is withheld until after submission",
        "Criteria are vague (e.g., 'demonstrates understanding') without descriptors",
        "Marking guide uses jargon not defined elsewhere in the brief"
      ],
      "helpful": [
        "A detailed rubric with performance-level descriptors is included in the brief",
        "Criteria directly map to stated learning outcomes",
        "Examples of 'high distinction' and 'pass-level' work are provided"
      ]
    },
    "r4": {
      "code": "3.1",
      "principle": "Representation",
      "dimension": "representation",
      "title": "Examples and exemplars provided",
      "description": "Annotated examples of strong and adequate responses are provided so students understand the standard expected.",
      "harmful": [
        "No examples are provided — students must infer expectations",
        "Only a single 'perfect' exemplar shown, not a range of standards",
        "Exemplars from previous cohorts without contextual annotation"
      ],
      "helpful": [
        "At least two annotated exemplars at different grade bands are available",
        "Exemplars include tutor commentary explaining what works and why",
        "Students are invited to discuss exemplars in a Q&A session"
      ]
    },
    "e1": {
      "code": "7.1",
      "principle": "Engagement",
      "dimension": "engagement",
      "title": "Task connects to authentic real-world contexts",
      "description": "The assessment is framed around genuine professional, community, or disciplinary problems rather than purely academic exercises.",
      "harmful": [
        "Task is purely hypothetical with no connection to professional practice",
        "The 'client' or 'audience' for the work is only the marker",
        "Assessment replicates tasks from textbooks without contextualisation"
      ],
      "helpful": [
        "Task involves a real or simulated industry client, community partner, or dataset",
        "Students produce an artefact that could exist beyond the classroom",
        "Brief explicitly names the professional context that motivates the task"
      ]
    },
    "e2": {
      "code": "7.2",
      "principle": "Engagement",
      "dimension": "engagement",
      "title": "Student choice in topic, framing, or audience",
      "description": "Students have meaningful input into at least one aspect of the assessment — what they explore, how they frame it, or who they address.",
      "harmful": [
        "Every parameter is fixed: topic, format, length, and audience",
        "Choice is offered only in superficial ways (e.g., font or colour)",
        "Students who try to personalise the task are penalised"
      ],
      "helpful": [
        "Students choose their own topic within a defined scope",
        "Students can select the professional audience for their output",
        "A negotiated brief option is available for students with specific interests"
      ]
    },
    "e3": {
      "code": "8.1",
      "principle": "Engagement",
      "dimension": "engagement",
      "title": "Collaboration or peer interaction opportunities",
      "description": "The assessment design includes structured opportunities for students to interact with peers as part of the learning process.",
      "harmful": [
        "All work is strictly individual with no peer engagement permitted",
        "Group work is unstructured with no roles, milestones, or conflict resolution guidance",
        "Peer review is optional and ungraded, so almost no students do it"
      ],
      "helpful": [
        "A structured peer feedback stage is built into the submission timeline",
        "Group assessments include individual accountability mechanisms",
        "Collaborative artefacts include a reflection on individual contribution"
      ]
    },
    "e4": {
      "code": "8.2",
      "principle": "Engagement",
      "dimension": "engagement",
      "title": "Clear feedback loops during the task",
      "description": "Students receive substantive formative feedback before the final submission so they can adjust their approach.",
      "harmful": [
        "Feedback is only provided after final submission as a grade",
        "Draft feedback is generic and does not engage with the student's work",
        "Turnaround time on draft feedback is too slow to act on"
      ],
      "helpful": [
        "A compulsory draft or milestone submission with tutor feedback is included",
        "Students can book a consultation to discuss their approach before submitting",
        "Automated tools (e.g., Turnitin Feedback Studio) provide preliminary guidance"
      ]
    },
    "x1": {
      "code": "5.1",
      "principle": "Expression",
      "dimension": "expression",
      "title": "Multiple response formats accepted",
      "description": "Students can demonstrate their knowledge through more than one medium or format.",
      "harmful": [
        "Only a written essay is accepted with no alternatives",
        "Alternative formats are theoretically permitted but practically penalised in the rubric",
        "Students must seek special permission to submit in a non-standard format"
      ],
      "helpful": [
        "The brief explicitly lists 2–3 accepted formats (e.g., written report, video presentation, annotated artefact)",
        "The rubric is format-agnostic — criteria measure knowledge and argument, not medium",
        "Students who negotiate an alternative format receive equal support"
      ]
    },
    "x2": {
      "code": "4.1",
      "principle": "Expression",
      "dimension": "expression",
      "title": "Technology and assistive tools explicitly permitted",
      "description": "The brief explicitly states that students may use assistive technologies, transcription tools, or productivity software.",
      "harmful": [
        "The brief is silent on technology use, leaving students to assume restrictions",
        "Assistive technologies are not mentioned or are implicitly excluded",
        "Students with disability plans must separately negotiate technology access"
      ],
      "helpful": [
        "The brief explicitly states which technologies are permitted (e.g., screen readers, speech-to-text, reference managers)",
        "AI-assisted tools are addressed transparently with clear guidance on permitted use",
        "Students are encouraged to contact the unit coordinator to discuss technology needs"
      ]
    },
    "x3": {
      "code": "5.2",
      "principle": "Expression",
      "dimension": "expression",
      "title": "Language and communication flexibility",
      "description": "Students are supported to demonstrate knowledge even when English is not their first language.",
      "harmful": [
        "Assessment penalises grammar and expression rather than knowledge and argument",
        "No support for NESB students is mentioned in the brief",
        "The rubric conflates language proficiency with disciplinary understanding"
      ],
      "helpful": [
        "The rubric distinguishes between quality of argument and quality of expression",
        "Brief directs students to Curtin's language support services",
        "Grammar errors that do not impede meaning are not penalised"
      ]
    },
    "x4": {
      "code": "6.3",
      "principle": "Expression",
      "dimension": "expression",
      "title": "Process artefacts valued alongside final product",
      "description": "Students are invited or required to submit evidence of their thinking process, not just the final output.",
      "harmful": [
        "Only the final polished artefact is assessed",
        "Process notes, drafts, or iterations have no assessed value",
        "Students who struggle with the final product have no way to demonstrate understanding"
      ],
      "helpful": [
        "A learning journal, annotated bibliography, or design rationale contributes to the grade",
        "Submission includes a brief reflection on the student's development process",
        "Iterative drafts are part of the assessed portfolio"
      ]
    },
    "a1": {
      "code": "1.3",
      "principle": "Representation",
      "dimension": "accessibility",
      "title": "Digital brief meets basic accessibility standards",
      "description": "The brief and all supporting materials are created with accessibility in mind — readable by screen readers and navigable without a mouse.",
      "harmful": [
        "Brief is a scanned image with no selectable text",
        "Tables and diagrams have no alt text or captions",
        "Colour is used as the only means of conveying information"
      ],
      "helpful": [
        "PDF is tagged and readable by screen readers",
        "All images and diagrams have descriptive alt text",
        "Colour contrast meets WCAG AA minimum ratios"
      ]
    },
    "a2": {
      "code": "4.2",
      "principle": "Expression",
      "dimension": "accessibility",
      "title": "Physical and temporal accommodations documented",
      "description": "The brief acknowledges that students may need physical, temporal, or situational adjustments and explains how to request them.",
      "harmful": [
        "No mention of accommodations or adjustment processes",
        "Students must independently discover the special consideration process",
        "Time extensions are treated as exceptional rather than standard policy"
      ],
      "helpful": [
        "Brief includes a sentence directing students to Curtin's special consideration process",
        "Reasonable adjustments are framed as a normal part of the unit, not an exception",
        "Unit coordinator contact details are provided for accommodation discussions"
      ]
    },
    "a3": {
      "code": "4.3",
      "principle": "Expression",
      "dimension": "accessibility",
      "title": "Technology requirements clearly stated and accessible",
      "description": "Any required technology is explicitly listed and alternatives are provided for students without access.",
      "harmful": [
        "Assumed access to specific software without confirming availability",
        "Required tools are proprietary and not available to all students",
        "No alternatives for students who cannot access the required technology"
      ],
      "helpful": [
        "All required software is available free or via Curtin's student licence",
        "Open-source or web-based alternatives are listed for each tool",
        "Students without home access are directed to on-campus facilities"
      ]
    },
    "f1": {
      "code": "7.3",
      "principle": "Engagement",
      "dimension": "flexibility",
      "title": "Flexible submission windows or extension policy",
      "description": "The assessment includes a grace period or transparent extension policy so students can manage unexpected circumstances.",
      "harmful": [
        "Hard deadline with automatic zero and no extension process described",
        "Extension requests require medical certificates for any reason",
        "Late penalties are so severe that submission after the deadline is not worth attempting"
      ],
      "helpful": [
        "A 24–48 hour grace period is built into the submission window",
        "Extension policy and process are stated clearly in the brief",
        "Late submissions are accepted with a reasonable, proportional penalty"
      ]
    },
    "f2": {
      "code": "6.2",
      "principle": "Expression",
      "dimension": "flexibility",
      "title": "Staged or scaffolded submission milestones",
      "description": "Large assessments are broken into staged checkpoints so students can get feedback and adjust without failing the whole task.",
      "harmful": [
        "Single high-stakes submission with no prior checkpoints",
        "Students receive no structured guidance between the brief release and due date",
        "All marks are contingent on a single final submission"
      ],
      "helpful": [
        "A topic proposal or outline is due early in the teaching period",
        "A draft is due mid-unit with structured feedback before the final submission",
        "Milestones carry small marks that acknowledge progress and engagement"
      ]
    },
    "f3": {
      "code": "7.4",
      "principle": "Engagement",
      "dimension": "flexibility",
      "title": "Topic or focus flexibility within the task",
      "description": "Students can adapt the scope or angle of the task to align with their disciplinary interests or professional context.",
      "harmful": [
        "All students must address an identical case study or topic",
        "Alternative topics are not permitted without formal renegotiation",
        "The brief does not acknowledge that different cohorts may have different professional contexts"
      ],
      "helpful": [
        "Students select from a curated list of topics or case studies",
        "Students in different professional streams can frame the task within their context",
        "A brief proposal stage allows students to pitch a personalised scope"
      ]
    },
    "q1": {
      "code": "9.1",
      "principle": "Engagement",
      "dimension": "equity",
      "title": "Culturally inclusive and representative content",
      "description": "The assessment brief and any embedded content reflect a range of cultural perspectives and do not centre a single dominant viewpoint.",
      "harmful": [
        "All case studies, examples, and references are from a Western/Anglo context",
        "Assessment assumes shared cultural references (idioms, media, history)",
        "Indigenous, non-Western, or global perspectives are absent from the task"
      ],
      "helpful": [
        "Case studies and examples are drawn from diverse cultural and geographic contexts",
        "Indigenous perspectives are included where relevant, in consultation with First Nations staff",
        "Brief explicitly acknowledges that multiple cultural frameworks can inform the response"
      ]
    },
    "q2": {
      "code": "9.2",
      "principle": "Engagement",
      "dimension": "equity",
      "title": "No assumed socioeconomic advantage",
      "description": "The assessment does not implicitly require access to resources, equipment, or experiences that not all students have.",
      "harmful": [
        "Assessment assumes access to personal transport, equipment, or paid software",
        "Field components require travel not covered by the unit",
        "Assessment presupposes access to professional networks or industry contacts"
      ],
      "helpful": [
        "All required resources are available on campus or through Curtin licences at no cost",
        "Field components include on-campus alternatives for students who cannot travel",
        "Students without professional networks are supported through Curtin's industry connections"
      ]
    },
    "q3": {
      "code": "9.3",
      "principle": "Engagement",
      "dimension": "equity",
      "title": "Equitable conditions for all students",
      "description": "The assessment conditions do not disadvantage students based on their circumstances (caring responsibilities, work commitments, disability, cultural obligations).",
      "harmful": [
        "Assessment scheduled during culturally significant dates with no alternative",
        "Timed assessments do not account for students with processing differences",
        "Conditions penalise students who cannot attend at a specific time"
      ],
      "helpful": [
        "Significant cultural and religious dates are checked before scheduling timed assessments",
        "Timed assessments offer a reasonable extended time option for students with access plans",
        "Remote or asynchronous alternatives are available for students with caring responsibilities"
      ]
    }
  },
  "assessmentTypes": {
    "written_report": ["r1", "r2", "r3", "r4", "e1", "e2", "x1", "x2", "x3", "a1", "f1", "f3", "q1", "q2"],
    "portfolio": ["r2", "r3", "r4", "e2", "e3", "x1", "x2", "x3", "x4", "a1", "a3", "f1", "f2", "q1", "q2", "q3"],
    "field_journal": ["r2", "r3", "e1", "e4", "x1", "x3", "x4", "a1", "f1", "f3", "q1", "q2"],
    "invigilated_exam": ["r1", "r2", "r3", "a1", "a2", "a3", "q2", "q3"],
    "interactive_oral": ["r2", "r3", "e1", "e2", "e3", "x1", "x2", "x3", "a1", "a2", "q1", "q2", "q3"]
  },
  "dimensionLabels": {
    "representation": "Representation",
    "engagement": "Engagement",
    "expression": "Expression",
    "accessibility": "Accessibility",
    "flexibility": "Flexibility",
    "equity": "Equity"
  }
}
```

- [ ] **Step 3: Create `lib/udl.ts`**

```typescript
import udlData from '@/data/udl-checkpoints.json'
import type { CheckpointDef, UdlData, Assessment } from '@/lib/types'

const data = udlData as UdlData

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
```

- [ ] **Step 4: Create `lib/scoring.ts`**

```typescript
import type { CheckpointResult, DimensionScore, Dimension } from '@/lib/types'
import { getCheckpointDef } from '@/lib/udl'

const DIMENSION_LABELS: Record<Dimension, string> = {
  representation: 'Representation',
  engagement: 'Engagement',
  expression: 'Expression',
  accessibility: 'Accessibility',
  flexibility: 'Flexibility',
  equity: 'Equity',
}

function ratingValue(rating: CheckpointResult['userRating'] | CheckpointResult['aiRating']): number {
  if (rating === 'met') return 1
  if (rating === 'partial') return 0.5
  return 0
}

export function computeDimensionScores(checkpoints: CheckpointResult[]): DimensionScore[] {
  const dimensions = Object.keys(DIMENSION_LABELS) as Dimension[]
  return dimensions.map(dimension => {
    const relevant = checkpoints.filter(c => {
      const def = getCheckpointDef(c.checkpointId)
      return def?.dimension === dimension
    })
    if (relevant.length === 0) {
      return { dimension, label: DIMENSION_LABELS[dimension], score: 0, total: 0, percentage: 0 }
    }
    const score = relevant.reduce((sum, c) => {
      const rating = c.userRating ?? c.aiRating
      return sum + ratingValue(rating)
    }, 0)
    const percentage = Math.round((score / relevant.length) * 100)
    return { dimension, label: DIMENSION_LABELS[dimension], score, total: relevant.length, percentage }
  })
}

export function computeOverallScore(checkpoints: CheckpointResult[]): number {
  if (checkpoints.length === 0) return 0
  const total = checkpoints.reduce((sum, c) => {
    const rating = c.userRating ?? c.aiRating
    return sum + ratingValue(rating)
  }, 0)
  return Math.round((total / checkpoints.length) * 100)
}

export function getGradeLabel(percentage: number): string {
  if (percentage >= 85) return 'Strong UDL Alignment'
  if (percentage >= 65) return 'Developing UDL Alignment'
  if (percentage >= 40) return 'Emerging UDL Alignment'
  return 'UDL Alignment Needs Attention'
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/udl.ts lib/scoring.ts data/udl-checkpoints.json
git commit -m "feat: add UDL checkpoint data, types, and scoring utilities"
```

---

## Task 3: Tailwind Theme + App Layout

**Files:**
- Modify: `tailwind.config.ts`
- Create: `app/globals.css`
- Create: `app/layout.tsx`

- [ ] **Step 1: Update `tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cream: '#FAF7F2',
        teal: {
          DEFAULT: '#1B3A4B',
          light: '#2E5569',
          dark: '#0F2530',
        },
        terracotta: {
          DEFAULT: '#C96B2F',
          light: '#E08050',
          dark: '#A5551F',
        },
        amber: '#D4A017',
        sand: '#E8E0D0',
      },
      fontFamily: {
        display: ['var(--font-fraunces)', 'Georgia', 'serif'],
        sans: ['var(--font-plus-jakarta)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 2: Create `app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-cream text-teal font-sans;
  }

  h1, h2, h3 {
    @apply font-display;
  }
}

@layer utilities {
  .status-dot-pending  { @apply bg-sand border-2 border-teal/20; }
  .status-dot-partial  { @apply bg-amber; }
  .status-dot-met      { @apply bg-green-500; }
  .status-dot-gap      { @apply bg-red-400; }
}
```

- [ ] **Step 3: Create `app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import { Fraunces, Plus_Jakarta_Sans } from 'next/font/google'
import '@/app/globals.css'
import { Providers } from '@/components/Providers'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
})

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'UDL Lens',
  description: 'Audit your unit assessments against UDL Guidelines 3.0',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${plusJakarta.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

- [ ] **Step 4: Create `components/Providers.tsx`**

```tsx
'use client'

import { SessionProvider } from '@/context/SessionContext'

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
```

- [ ] **Step 5: Verify in browser**

```bash
npm run dev
```

Navigate to `http://localhost:3000`. Expected: cream background, no console errors.

- [ ] **Step 6: Commit**

```bash
git add app/layout.tsx app/globals.css tailwind.config.ts components/Providers.tsx
git commit -m "feat: add tailwind theme, fonts, and app layout"
```

---

## Task 4: Session Context

**Files:**
- Create: `context/SessionContext.tsx`

- [ ] **Step 1: Create `context/SessionContext.tsx`**

```tsx
'use client'

import { createContext, useContext, useReducer, type ReactNode } from 'react'
import type { SessionState, SessionAction, Rating } from '@/lib/types'

const initialState: SessionState = {
  assessments: [],
  checkpoints: [],
  suggestions: null,
}

function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'SET_ASSESSMENTS':
      return { ...state, assessments: action.assessments }
    case 'SET_CHECKPOINTS':
      return { ...state, checkpoints: action.checkpoints }
    case 'UPDATE_CHECKPOINT':
      return {
        ...state,
        checkpoints: state.checkpoints.map(c =>
          c.checkpointId === action.checkpointId && c.assessmentId === action.assessmentId
            ? {
                ...c,
                userRating: action.userRating,
                overridden: action.userRating !== c.aiRating,
              }
            : c
        ),
      }
    case 'SET_SUGGESTIONS':
      return { ...state, suggestions: action.suggestions }
    case 'RESET':
      return initialState
    default:
      return state
  }
}

interface SessionContextValue {
  state: SessionState
  dispatch: React.Dispatch<SessionAction>
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(sessionReducer, initialState)
  return (
    <SessionContext.Provider value={{ state, dispatch }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside SessionProvider')
  return ctx
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add context/SessionContext.tsx
git commit -m "feat: add session context with useReducer"
```

---

## Task 5: Step 1 — Assessment Entry Page

**Files:**
- Create: `app/page.tsx`
- Create: `components/AssessmentForm.tsx`
- Create: `components/AssessmentCard.tsx`

- [ ] **Step 1: Create `components/AssessmentCard.tsx`**

```tsx
import type { Assessment } from '@/lib/types'
import { getAssessmentTypeLabel } from '@/lib/udl'

interface Props {
  assessment: Assessment
  onEdit: () => void
  onRemove: () => void
}

export function AssessmentCard({ assessment, onEdit, onRemove }: Props) {
  const laneLabel = assessment.lane === 'lane1' ? 'Lane 1 — Secure' : 'Lane 2 — Non-secure'
  return (
    <div className="rounded-xl border border-sand bg-white p-5 flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="font-display text-lg font-semibold text-teal">{assessment.name}</p>
        <p className="text-sm text-teal/70 mt-0.5">
          {getAssessmentTypeLabel(assessment.type)} · {laneLabel}
        </p>
        {assessment.description && (
          <p className="text-sm text-teal/60 mt-2 line-clamp-2">{assessment.description}</p>
        )}
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={onEdit}
          className="text-sm text-teal/60 hover:text-teal underline"
        >
          Edit
        </button>
        <button
          onClick={onRemove}
          className="text-sm text-terracotta hover:text-terracotta-dark underline"
        >
          Remove
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `components/AssessmentForm.tsx`**

```tsx
'use client'

import { useState, useRef } from 'react'
import type { Assessment } from '@/lib/types'
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
    setType(value)
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
```

- [ ] **Step 3: Create `app/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/context/SessionContext'
import { AssessmentCard } from '@/components/AssessmentCard'
import { AssessmentForm } from '@/components/AssessmentForm'
import type { Assessment } from '@/lib/types'

type FormMode = { mode: 'add' } | { mode: 'edit'; assessment: Assessment } | null

export default function SetupPage() {
  const router = useRouter()
  const { state, dispatch } = useSession()
  const [formMode, setFormMode] = useState<FormMode>(null)

  function handleSave(data: Omit<Assessment, 'id'> & { id?: string }) {
    if (data.id) {
      dispatch({
        type: 'SET_ASSESSMENTS',
        assessments: state.assessments.map(a =>
          a.id === data.id ? { ...data, id: data.id } : a
        ),
      })
    } else {
      dispatch({
        type: 'SET_ASSESSMENTS',
        assessments: [
          ...state.assessments,
          { ...data, id: crypto.randomUUID() },
        ],
      })
    }
    setFormMode(null)
  }

  function handleRemove(id: string) {
    dispatch({
      type: 'SET_ASSESSMENTS',
      assessments: state.assessments.filter(a => a.id !== id),
    })
  }

  function handleProceed() {
    router.push('/review')
  }

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-sand bg-teal text-white px-8 py-5">
        <h1 className="font-display text-2xl">UDL Lens</h1>
        <p className="text-sm text-white/70 mt-0.5">Assessment 2030 · UDL Guidelines 3.0 Audit</p>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8 text-sm">
          <span className="rounded-full bg-teal text-white w-6 h-6 flex items-center justify-center text-xs font-bold">1</span>
          <span className="font-medium text-teal">Select Assessments</span>
          <span className="text-teal/30 mx-1">›</span>
          <span className="text-teal/40">Review Checkpoints</span>
          <span className="text-teal/30 mx-1">›</span>
          <span className="text-teal/40">Your Results</span>
        </div>

        <h2 className="font-display text-3xl text-teal mb-2">What assessments are in your unit?</h2>
        <p className="text-teal/60 mb-8">
          Add each assessment separately. For each one, you can upload the assignment brief and Claude will pre-fill the UDL checkpoint ratings for you to verify.
        </p>

        {/* Assessment list */}
        <div className="space-y-3 mb-6">
          {state.assessments.map(a => (
            <AssessmentCard
              key={a.id}
              assessment={a}
              onEdit={() => setFormMode({ mode: 'edit', assessment: a })}
              onRemove={() => handleRemove(a.id)}
            />
          ))}
        </div>

        {/* Add form or button */}
        {formMode ? (
          <div className="rounded-xl border border-teal/20 bg-white p-6 mb-6">
            <h3 className="font-display text-lg text-teal mb-4">
              {formMode.mode === 'edit' ? 'Edit assessment' : 'Add assessment'}
            </h3>
            <AssessmentForm
              initial={formMode.mode === 'edit' ? formMode.assessment : undefined}
              onSave={handleSave}
              onCancel={() => setFormMode(null)}
            />
          </div>
        ) : (
          <button
            onClick={() => setFormMode({ mode: 'add' })}
            className="w-full rounded-xl border-2 border-dashed border-teal/20 text-teal/60 hover:border-teal/40 hover:text-teal py-4 text-sm transition-colors"
          >
            + Add assessment
          </button>
        )}

        {/* Proceed */}
        {state.assessments.length > 0 && !formMode && (
          <div className="mt-8 pt-8 border-t border-sand">
            <p className="text-sm text-teal/60 mb-4">
              {state.assessments.length} assessment{state.assessments.length !== 1 ? 's' : ''} added.
              Claude will pre-fill UDL ratings for each one — you'll verify and adjust them in the next step.
            </p>
            <button
              onClick={handleProceed}
              className="rounded-lg bg-terracotta text-white px-8 py-3 font-medium hover:bg-terracotta-dark transition-colors"
            >
              Review UDL checkpoints →
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Verify in browser**

```bash
npm run dev
```

Navigate to `http://localhost:3000`. Expected:
- Cream background, teal header with "UDL Lens"
- Step indicator shows Step 1 active
- Click "+ Add assessment" → form appears
- Fill in name, select type, click "Add assessment" → card appears
- Proceed button appears when at least one assessment added

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx components/AssessmentCard.tsx components/AssessmentForm.tsx
git commit -m "feat: add Step 1 assessment entry page"
```

---

## Task 6: API Route — `/api/extract`

**Files:**
- Create: `app/api/extract/route.ts`

- [ ] **Step 1: Create `app/api/extract/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import mammoth from 'mammoth'

const client = new Anthropic()

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let extractedText = ''

    if (file.name.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer })
      extractedText = result.value
    } else if (file.name.endsWith('.pdf')) {
      // Use Claude's native PDF document support
      const base64 = buffer.toString('base64')
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: base64,
                },
              } as Parameters<typeof client.messages.create>[0]['messages'][0]['content'][0],
              {
                type: 'text',
                text: 'Extract a clear, structured plain-text description of this assignment brief. Include: the task type, what students must do, how they will be assessed, any specific constraints or requirements, and the marking criteria. Be concise but complete. Return plain text only, no markdown.',
              },
            ],
          },
        ],
      })
      const textBlock = response.content.find(b => b.type === 'text')
      extractedText = textBlock && textBlock.type === 'text' ? textBlock.text : ''
    } else {
      return NextResponse.json({ error: 'Unsupported file type. Please upload PDF or DOCX.' }, { status: 400 })
    }

    if (!extractedText.trim()) {
      return NextResponse.json({ error: 'Could not extract text from file.' }, { status: 422 })
    }

    return NextResponse.json({ description: extractedText.trim() })
  } catch (err) {
    console.error('/api/extract error:', err)
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Test file upload via the UI**

Start the dev server, go to `http://localhost:3000`, add an assessment, click "Or upload brief (PDF / DOCX)", upload a test PDF or DOCX.

Expected: Description field populates with extracted text.

Expected (if no file available): Upload fails gracefully with the inline error message, user can type description manually.

- [ ] **Step 3: Commit**

```bash
git add app/api/extract/route.ts
git commit -m "feat: add /api/extract route for PDF/DOCX brief extraction"
```

---

## Task 7: API Route — `/api/prefill`

**Files:**
- Create: `app/api/prefill/route.ts`

- [ ] **Step 1: Create `app/api/prefill/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { Assessment, CheckpointResult, Rating } from '@/lib/types'
import { getCheckpointDef, getCheckpointIdsForAssessments } from '@/lib/udl'

const client = new Anthropic()

interface PrefillRequest {
  assessments: Assessment[]
  checkpointIds: string[]
}

interface PrefillItem {
  checkpointId: string
  assessmentId: string
  rating: Rating
  reasoning: string
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as PrefillRequest
    const { assessments, checkpointIds } = body

    if (!assessments?.length || !checkpointIds?.length) {
      return NextResponse.json({ error: 'Missing assessments or checkpointIds' }, { status: 400 })
    }

    const checkpointContext = checkpointIds
      .map(id => {
        const def = getCheckpointDef(id)
        if (!def) return null
        return `Checkpoint ${id} (${def.code} — ${def.title}):
Dimension: ${def.dimension}
Harmful practices: ${def.harmful.join('; ')}
Helpful practices: ${def.helpful.join('; ')}`
      })
      .filter(Boolean)
      .join('\n\n')

    const assessmentContext = assessments
      .map(a => `Assessment ID: ${a.id}
Name: ${a.name}
Type: ${a.type}
Lane: ${a.lane}
Description: ${a.description || '(no description provided — use assessment type as context)'}`)
      .join('\n\n')

    const prompt = `You are a UDL (Universal Design for Learning) expert helping a university educator audit their assessments.

ASSESSMENTS:
${assessmentContext}

UDL CHECKPOINTS TO RATE:
${checkpointContext}

For each combination of assessment and checkpoint, rate how well the assessment addresses that checkpoint.

Ratings:
- "not_yet": The assessment shows no evidence of this UDL principle based on the description
- "partial": The assessment partially addresses this principle
- "met": The assessment clearly demonstrates this principle

For each assessment, rate EVERY checkpoint listed. Return a JSON array with this exact structure:
[
  {
    "checkpointId": "r1",
    "assessmentId": "assessment-uuid-here",
    "rating": "not_yet" | "partial" | "met",
    "reasoning": "One sentence explaining the rating based on the description."
  }
]

Important:
- Base ratings on the description provided. If no description, use the assessment type as context.
- Be realistic — most assessments will have a mix of "not_yet" and "partial" with a few "met".
- Keep reasoning to one sentence.
- Return ONLY the JSON array, no other text.`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = response.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    let items: PrefillItem[]
    try {
      const jsonText = textBlock.text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '')
      items = JSON.parse(jsonText)
    } catch {
      throw new Error('Failed to parse Claude response as JSON')
    }

    const checkpointResults: CheckpointResult[] = items.map(item => ({
      checkpointId: item.checkpointId,
      assessmentId: item.assessmentId,
      aiRating: item.rating,
      aiReasoning: item.reasoning,
      userRating: null,
      overridden: false,
    }))

    return NextResponse.json(checkpointResults)
  } catch (err) {
    console.error('/api/prefill error:', err)
    return NextResponse.json({ error: 'Prefill failed' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/prefill/route.ts
git commit -m "feat: add /api/prefill route for AI checkpoint ratings"
```

---

## Task 8: Step 2 — Checkpoint Review Page

**Files:**
- Create: `components/ProgressBar.tsx`
- Create: `components/CheckpointNav.tsx`
- Create: `components/CheckpointCard.tsx`
- Create: `app/review/page.tsx`

- [ ] **Step 1: Create `components/ProgressBar.tsx`**

```tsx
interface Props {
  completed: number
  total: number
}

export function ProgressBar({ completed, total }: Props) {
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100)
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-sand overflow-hidden">
        <div
          className="h-full bg-teal transition-all duration-300 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm text-teal/60 tabular-nums shrink-0">
        {completed}/{total}
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Create `components/CheckpointNav.tsx`**

```tsx
import type { CheckpointResult } from '@/lib/types'
import { getCheckpointDef } from '@/lib/udl'

interface Props {
  checkpoints: CheckpointResult[]
  activeIndex: number
  onSelect: (index: number) => void
  filterAssessmentId: string | null
}

function statusClass(result: CheckpointResult): string {
  const rating = result.userRating ?? null
  if (rating === null) return 'status-dot-pending'
  if (rating === 'met') return 'status-dot-met'
  if (rating === 'partial') return 'status-dot-partial'
  return 'status-dot-gap'
}

export function CheckpointNav({ checkpoints, activeIndex, onSelect, filterAssessmentId }: Props) {
  const visible = filterAssessmentId
    ? checkpoints.filter(c => c.assessmentId === filterAssessmentId)
    : checkpoints

  return (
    <nav className="space-y-1">
      {visible.map((result, idx) => {
        const def = getCheckpointDef(result.checkpointId)
        const globalIdx = checkpoints.indexOf(result)
        const isActive = globalIdx === activeIndex
        return (
          <button
            key={`${result.checkpointId}-${result.assessmentId}`}
            onClick={() => onSelect(globalIdx)}
            className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive ? 'bg-teal text-white' : 'text-teal/70 hover:bg-sand'
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusClass(result)}`} />
            <span className="truncate">{def?.code} {def?.title}</span>
          </button>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 3: Create `components/CheckpointCard.tsx`**

```tsx
import type { CheckpointResult, CheckpointDef, Rating, Assessment } from '@/lib/types'

interface Props {
  result: CheckpointResult
  def: CheckpointDef
  assessment: Assessment
  onRate: (rating: Rating) => void
}

const RATING_OPTIONS: { value: Rating; label: string; color: string }[] = [
  { value: 'not_yet', label: 'Not yet', color: 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100' },
  { value: 'partial', label: 'Partially', color: 'border-amber text-teal bg-amber/10 hover:bg-amber/20' },
  { value: 'met', label: 'Met', color: 'border-green-400 text-green-800 bg-green-50 hover:bg-green-100' },
]

const SELECTED: Record<Rating, string> = {
  not_yet: 'border-red-400 bg-red-100 text-red-800 font-semibold ring-2 ring-red-300',
  partial: 'border-amber bg-amber/30 text-teal font-semibold ring-2 ring-amber/50',
  met: 'border-green-500 bg-green-100 text-green-900 font-semibold ring-2 ring-green-300',
}

export function CheckpointCard({ result, def, assessment, onRate }: Props) {
  const effectiveRating = result.userRating ?? null
  return (
    <div className="bg-white rounded-2xl border border-sand p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="inline-block text-xs font-medium bg-teal/10 text-teal rounded px-2 py-0.5 mb-2">
            {def.principle} · {def.dimension}
          </span>
          <h2 className="font-display text-xl text-teal">{def.code} — {def.title}</h2>
          <p className="text-sm text-teal/60 mt-1">Assessment: <strong>{assessment.name}</strong></p>
        </div>
      </div>

      <p className="text-sm text-teal/80 leading-relaxed">{def.description}</p>

      {/* Harmful / Helpful */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-red-50 border border-red-100 p-4">
          <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">Harmful practices</p>
          <ul className="space-y-1.5">
            {def.harmful.map((h, i) => (
              <li key={i} className="text-xs text-red-800 flex gap-1.5">
                <span className="shrink-0 mt-0.5">✗</span>
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg bg-green-50 border border-green-100 p-4">
          <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">Helpful practices</p>
          <ul className="space-y-1.5">
            {def.helpful.map((h, i) => (
              <li key={i} className="text-xs text-green-800 flex gap-1.5">
                <span className="shrink-0 mt-0.5">✓</span>
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* AI pre-fill */}
      <div className="rounded-lg bg-teal/5 border border-teal/10 p-4">
        <p className="text-xs font-semibold text-teal/70 uppercase tracking-wide mb-1">
          AI pre-fill {result.overridden && <span className="text-terracotta">(overridden by you)</span>}
        </p>
        <p className="text-sm text-teal">
          <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold mr-2 ${
            result.aiRating === 'met' ? 'bg-green-100 text-green-800' :
            result.aiRating === 'partial' ? 'bg-amber/30 text-teal' :
            'bg-red-100 text-red-700'
          }`}>
            {result.aiRating === 'met' ? 'Met' : result.aiRating === 'partial' ? 'Partially' : 'Not yet'}
          </span>
          {result.aiReasoning}
        </p>
      </div>

      {/* Rating buttons */}
      <div>
        <p className="text-sm font-medium text-teal mb-3">Your rating:</p>
        <div className="flex gap-3">
          {RATING_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onRate(opt.value)}
              className={`flex-1 rounded-lg border-2 py-2.5 text-sm transition-all ${
                effectiveRating === opt.value ? SELECTED[opt.value] : opt.color
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `app/review/page.tsx`**

```tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/context/SessionContext'
import { getCheckpointIdsForAssessments, getCheckpointDef, getAssessmentTypeLabel } from '@/lib/udl'
import { ProgressBar } from '@/components/ProgressBar'
import { CheckpointNav } from '@/components/CheckpointNav'
import { CheckpointCard } from '@/components/CheckpointCard'
import type { Rating, CheckpointResult } from '@/lib/types'

export default function ReviewPage() {
  const router = useRouter()
  const { state, dispatch } = useSession()
  const [activeIndex, setActiveIndex] = useState(0)
  const [filterAssessmentId, setFilterAssessmentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [prefillError, setPrefillError] = useState<string | null>(null)

  const { assessments, checkpoints } = state

  useEffect(() => {
    if (assessments.length === 0) {
      router.replace('/')
    }
  }, [assessments, router])

  const runPrefill = useCallback(async () => {
    if (checkpoints.length > 0) return
    const checkpointIds = getCheckpointIdsForAssessments(assessments)
    if (checkpointIds.length === 0) return
    setLoading(true)
    setPrefillError(null)
    try {
      const res = await fetch('/api/prefill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessments, checkpointIds }),
      })
      if (!res.ok) throw new Error('Prefill request failed')
      const data = await res.json() as CheckpointResult[]
      dispatch({ type: 'SET_CHECKPOINTS', checkpoints: data })
    } catch {
      setPrefillError('AI pre-fill is temporarily unavailable. You can still rate checkpoints manually.')
      // Create blank checkpoints so user can proceed
      const blank: CheckpointResult[] = []
      for (const a of assessments) {
        const ids = getCheckpointIdsForAssessments([a])
        for (const id of ids) {
          blank.push({
            checkpointId: id,
            assessmentId: a.id,
            aiRating: 'not_yet',
            aiReasoning: 'AI pre-fill unavailable.',
            userRating: null,
            overridden: false,
          })
        }
      }
      dispatch({ type: 'SET_CHECKPOINTS', checkpoints: blank })
    } finally {
      setLoading(false)
    }
  }, [assessments, checkpoints.length, dispatch])

  useEffect(() => {
    runPrefill()
  }, [runPrefill])

  const visibleCheckpoints = filterAssessmentId
    ? checkpoints.filter(c => c.assessmentId === filterAssessmentId)
    : checkpoints

  const completedCount = checkpoints.filter(c => c.userRating !== null).length
  const allComplete = completedCount === checkpoints.length && checkpoints.length > 0

  function handleRate(rating: Rating) {
    const active = checkpoints[activeIndex]
    if (!active) return
    dispatch({
      type: 'UPDATE_CHECKPOINT',
      checkpointId: active.checkpointId,
      assessmentId: active.assessmentId,
      userRating: rating,
    })
    if (activeIndex < checkpoints.length - 1) {
      setTimeout(() => setActiveIndex(i => i + 1), 250)
    }
  }

  const activeCheckpoint = checkpoints[activeIndex]
  const activeDef = activeCheckpoint ? getCheckpointDef(activeCheckpoint.checkpointId) : null
  const activeAssessment = activeCheckpoint
    ? assessments.find(a => a.id === activeCheckpoint.assessmentId)
    : null

  if (assessments.length === 0) return null

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-sand bg-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl text-teal">UDL Lens</h1>
          <div className="flex items-center gap-2 mt-1 text-sm">
            <span className="text-teal/40">Select Assessments</span>
            <span className="text-teal/30">›</span>
            <span className="font-medium text-teal">Review Checkpoints</span>
            <span className="text-teal/30">›</span>
            <span className="text-teal/40">Your Results</span>
          </div>
        </div>
        {allComplete && (
          <button
            onClick={() => router.push('/results')}
            className="rounded-lg bg-terracotta text-white px-6 py-2 text-sm font-medium hover:bg-terracotta-dark transition-colors"
          >
            See results →
          </button>
        )}
      </header>

      {prefillError && (
        <div className="bg-amber/20 border-b border-amber px-6 py-3 text-sm text-teal">
          {prefillError}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-teal/20 border-t-teal rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-teal/60">Claude is pre-filling checkpoint ratings…</p>
          </div>
        </div>
      ) : (
        <div className="flex h-[calc(100vh-73px)]">
          {/* Left nav */}
          <aside className="w-72 border-r border-sand bg-white flex flex-col overflow-hidden shrink-0">
            <div className="p-4 border-b border-sand">
              <ProgressBar completed={completedCount} total={checkpoints.length} />
            </div>
            {/* Assessment filter tabs */}
            <div className="flex gap-1 px-3 pt-3 pb-2 overflow-x-auto">
              <button
                onClick={() => setFilterAssessmentId(null)}
                className={`rounded-full px-3 py-1 text-xs whitespace-nowrap transition-colors ${
                  !filterAssessmentId ? 'bg-teal text-white' : 'text-teal/60 hover:bg-sand'
                }`}
              >
                All
              </button>
              {assessments.map(a => (
                <button
                  key={a.id}
                  onClick={() => setFilterAssessmentId(a.id === filterAssessmentId ? null : a.id)}
                  className={`rounded-full px-3 py-1 text-xs whitespace-nowrap transition-colors ${
                    filterAssessmentId === a.id ? 'bg-teal text-white' : 'text-teal/60 hover:bg-sand'
                  }`}
                >
                  {a.name}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <CheckpointNav
                checkpoints={checkpoints}
                activeIndex={activeIndex}
                onSelect={setActiveIndex}
                filterAssessmentId={filterAssessmentId}
              />
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 overflow-y-auto p-8">
            {activeCheckpoint && activeDef && activeAssessment ? (
              <div className="max-w-2xl mx-auto">
                <CheckpointCard
                  result={activeCheckpoint}
                  def={activeDef}
                  assessment={activeAssessment}
                  onRate={handleRate}
                />
                {/* Prev/Next navigation */}
                <div className="flex justify-between mt-6">
                  <button
                    onClick={() => setActiveIndex(i => Math.max(0, i - 1))}
                    disabled={activeIndex === 0}
                    className="text-sm text-teal/60 hover:text-teal disabled:opacity-30 transition-colors"
                  >
                    ← Previous
                  </button>
                  <span className="text-xs text-teal/40">
                    {activeIndex + 1} of {checkpoints.length}
                  </span>
                  <button
                    onClick={() => setActiveIndex(i => Math.min(checkpoints.length - 1, i + 1))}
                    disabled={activeIndex === checkpoints.length - 1}
                    className="text-sm text-teal/60 hover:text-teal disabled:opacity-30 transition-colors"
                  >
                    Next →
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-teal/40">
                No checkpoints to show
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 5: Verify Step 2 in browser**

After adding an assessment in Step 1 and clicking "Review UDL checkpoints →":
- Loading spinner shows while Claude prefills ratings
- Left nav shows checkpoint list with status dots
- Main area shows checkpoint card with harmful/helpful practices
- Clicking a rating button advances to next checkpoint
- Progress bar updates
- "See results →" button appears when all rated

- [ ] **Step 6: Commit**

```bash
git add app/review/page.tsx components/ProgressBar.tsx components/CheckpointNav.tsx components/CheckpointCard.tsx
git commit -m "feat: add Step 2 checkpoint review page"
```

---

## Task 9: API Route — `/api/suggestions`

**Files:**
- Create: `app/api/suggestions/route.ts`

- [ ] **Step 1: Create `app/api/suggestions/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { CheckpointResult, Assessment, Suggestions } from '@/lib/types'
import { getCheckpointDef } from '@/lib/udl'

const client = new Anthropic()

interface SuggestionsRequest {
  checkpoints: CheckpointResult[]
  assessments: Assessment[]
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as SuggestionsRequest
    const { checkpoints, assessments } = body

    const allMet = checkpoints.every(c => (c.userRating ?? c.aiRating) === 'met')

    if (allMet) {
      return NextResponse.json({
        quickWins: [
          'All checkpoints are rated Met — outstanding UDL alignment across your unit.',
          'Consider sharing your assessment design as an exemplar with colleagues.',
          'Document your approach for your teaching portfolio as evidence of UDL practice.',
        ],
        longerTerm: [
          'Explore UDL Guidelines 3.0 checkpoints beyond the ones audited here to deepen your practice.',
          'Consider mentoring colleagues in UDL-aligned assessment design.',
        ],
      } satisfies Suggestions)
    }

    const gapContext = checkpoints
      .filter(c => (c.userRating ?? c.aiRating) !== 'met')
      .map(c => {
        const def = getCheckpointDef(c.checkpointId)
        const assessment = assessments.find(a => a.id === c.assessmentId)
        const rating = c.userRating ?? c.aiRating
        return `[${rating === 'not_yet' ? 'GAP' : 'PARTIAL'}] Assessment "${assessment?.name}" — ${def?.code} ${def?.title} (${def?.dimension})`
      })
      .join('\n')

    const prompt = `You are a teaching support specialist at Curtin University, advising on UDL (Universal Design for Learning) assessment design in the context of Assessment 2030.

The following UDL checkpoints have not been fully met in this unit's assessments:

${gapContext}

Generate:
1. QUICK WINS: 2–4 specific, immediately actionable suggestions. These should be changes the unit coordinator could make before the next study period — concrete edits to briefs, rubrics, or policies. Be specific and practical.
2. LONGER TERM: 2–3 deeper structural suggestions that would require more planning or curriculum redesign. Frame these as aspirational next steps.

Return JSON in this exact format:
{
  "quickWins": ["suggestion 1", "suggestion 2", ...],
  "longerTerm": ["suggestion 1", "suggestion 2", ...]
}

Be direct and specific. Reference the actual assessment names and checkpoints. No generic advice.`

    let attempts = 0
    let lastError: unknown
    while (attempts < 2) {
      try {
        const response = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        })
        const textBlock = response.content.find(b => b.type === 'text')
        if (!textBlock || textBlock.type !== 'text') throw new Error('No text response')
        const jsonText = textBlock.text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '')
        const suggestions = JSON.parse(jsonText) as Suggestions
        return NextResponse.json(suggestions)
      } catch (err) {
        lastError = err
        attempts++
      }
    }

    console.error('/api/suggestions failed after retries:', lastError)
    return NextResponse.json({ error: 'Suggestions temporarily unavailable' }, { status: 503 })
  } catch (err) {
    console.error('/api/suggestions error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/suggestions/route.ts
git commit -m "feat: add /api/suggestions route for quick wins and improvements"
```

---

## Task 10: Step 3 — Results Screen

**Files:**
- Create: `components/ResultsRadarChart.tsx`
- Create: `components/DimensionBars.tsx`
- Create: `components/CheckpointTable.tsx`
- Create: `components/SuggestionsList.tsx`
- Create: `app/results/page.tsx`

- [ ] **Step 1: Create `components/ResultsRadarChart.tsx`**

```tsx
'use client'

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import type { DimensionScore } from '@/lib/types'

interface Props {
  scores: DimensionScore[]
}

export function ResultsRadarChart({ scores }: Props) {
  const data = scores.map(s => ({
    subject: s.label,
    score: s.percentage,
    fullMark: 100,
  }))

  return (
    <ResponsiveContainer width="100%" height={320}>
      <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke="#E8E0D0" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fontSize: 12, fill: '#1B3A4B', fontFamily: 'var(--font-plus-jakarta)' }}
        />
        <Radar
          name="UDL Alignment"
          dataKey="score"
          stroke="#1B3A4B"
          fill="#1B3A4B"
          fillOpacity={0.25}
          strokeWidth={2}
        />
        <Tooltip
          formatter={(value: number) => [`${value}%`, 'Alignment']}
          contentStyle={{
            background: '#FAF7F2',
            border: '1px solid #E8E0D0',
            borderRadius: 8,
            fontSize: 12,
          }}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 2: Create `components/DimensionBars.tsx`**

```tsx
import type { DimensionScore } from '@/lib/types'

interface Props {
  scores: DimensionScore[]
}

export function DimensionBars({ scores }: Props) {
  return (
    <div className="space-y-3">
      {scores.map(s => (
        <div key={s.dimension}>
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-sm font-medium text-teal">{s.label}</span>
            <span className="text-xs text-teal/50 tabular-nums">{s.percentage}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-sand overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                s.percentage >= 75 ? 'bg-green-500' :
                s.percentage >= 45 ? 'bg-amber' :
                'bg-terracotta'
              }`}
              style={{ width: `${s.percentage}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create `components/CheckpointTable.tsx`**

```tsx
import type { CheckpointResult, Assessment } from '@/lib/types'
import { getCheckpointDef } from '@/lib/udl'

interface Props {
  checkpoints: CheckpointResult[]
  assessments: Assessment[]
}

const RATING_BADGE: Record<string, string> = {
  met: 'bg-green-100 text-green-800',
  partial: 'bg-amber/30 text-teal',
  not_yet: 'bg-red-100 text-red-700',
}
const RATING_LABEL: Record<string, string> = {
  met: 'Met',
  partial: 'Partial',
  not_yet: 'Not yet',
}

export function CheckpointTable({ checkpoints, assessments }: Props) {
  return (
    <div className="overflow-x-auto rounded-xl border border-sand">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-sand/50 text-teal/60 text-xs font-medium uppercase tracking-wide">
            <th className="text-left px-4 py-3">Checkpoint</th>
            <th className="text-left px-4 py-3">Assessment</th>
            <th className="text-left px-4 py-3">Principle</th>
            <th className="text-left px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-sand">
          {checkpoints.map(c => {
            const def = getCheckpointDef(c.checkpointId)
            const assessment = assessments.find(a => a.id === c.assessmentId)
            const rating = c.userRating ?? c.aiRating
            if (!def) return null
            return (
              <tr key={`${c.checkpointId}-${c.assessmentId}`} className="hover:bg-sand/30 transition-colors">
                <td className="px-4 py-3 text-teal font-medium">
                  {def.code} {def.title}
                </td>
                <td className="px-4 py-3 text-teal/60">{assessment?.name ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className="rounded px-2 py-0.5 text-xs bg-teal/10 text-teal">{def.principle}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${RATING_BADGE[rating]}`}>
                    {RATING_LABEL[rating]}
                  </span>
                  {!c.userRating && (
                    <span className="ml-1 text-xs text-teal/40 italic">AI</span>
                  )}
                  {c.overridden && (
                    <span className="ml-1 text-xs text-terracotta italic">edited</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: Create `components/SuggestionsList.tsx`**

```tsx
import type { Suggestions } from '@/lib/types'

interface Props {
  suggestions: Suggestions
}

export function SuggestionsList({ suggestions }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-xl text-teal mb-3">Quick wins</h3>
        <ul className="space-y-3">
          {suggestions.quickWins.map((win, i) => (
            <li key={i} className="flex gap-3 bg-white rounded-xl border border-sand p-4">
              <span className="shrink-0 w-6 h-6 rounded-full bg-terracotta text-white text-xs flex items-center justify-center font-bold">
                {i + 1}
              </span>
              <p className="text-sm text-teal leading-relaxed">{win}</p>
            </li>
          ))}
        </ul>
      </div>
      {suggestions.longerTerm.length > 0 && (
        <div>
          <h3 className="font-display text-xl text-teal mb-3">Longer-term improvements</h3>
          <ul className="space-y-3">
            {suggestions.longerTerm.map((item, i) => (
              <li key={i} className="flex gap-3 bg-white rounded-xl border border-sand p-4">
                <span className="shrink-0 w-6 h-6 rounded-full bg-teal text-white text-xs flex items-center justify-center font-bold">
                  {i + 1}
                </span>
                <p className="text-sm text-teal/80 leading-relaxed">{item}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Create `app/results/page.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useSession } from '@/context/SessionContext'
import { computeDimensionScores, computeOverallScore, getGradeLabel } from '@/lib/scoring'
import { ResultsRadarChart } from '@/components/ResultsRadarChart'
import { DimensionBars } from '@/components/DimensionBars'
import { CheckpointTable } from '@/components/CheckpointTable'
import { SuggestionsList } from '@/components/SuggestionsList'
import { ResetModal } from '@/components/ResetModal'
import type { Suggestions } from '@/lib/types'

const PdfDownloadButton = dynamic(
  () => import('@/components/PdfReport').then(m => m.PdfDownloadButton),
  { ssr: false, loading: () => (
    <button disabled className="rounded-lg border border-sand text-teal/40 px-5 py-2 text-sm">
      Preparing PDF…
    </button>
  )}
)

export default function ResultsPage() {
  const router = useRouter()
  const { state, dispatch } = useSession()
  const [showResetModal, setShowResetModal] = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [suggestionsError, setSuggestionsError] = useState(false)

  const { assessments, checkpoints, suggestions } = state

  useEffect(() => {
    if (assessments.length === 0) router.replace('/')
  }, [assessments, router])

  useEffect(() => {
    if (suggestions || checkpoints.length === 0) return
    setLoadingSuggestions(true)
    setSuggestionsError(false)
    fetch('/api/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkpoints, assessments }),
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: Suggestions) => dispatch({ type: 'SET_SUGGESTIONS', suggestions: data }))
      .catch(() => setSuggestionsError(true))
      .finally(() => setLoadingSuggestions(false))
  }, [suggestions, checkpoints, assessments, dispatch])

  function handleReset() {
    dispatch({ type: 'RESET' })
    router.push('/')
  }

  if (assessments.length === 0) return null

  const dimensionScores = computeDimensionScores(checkpoints)
  const overallScore = computeOverallScore(checkpoints)
  const gradeLabel = getGradeLabel(overallScore)
  const unitName = assessments.map(a => a.name).join(', ')

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-sand bg-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl text-teal">UDL Lens</h1>
          <div className="flex items-center gap-2 mt-1 text-sm">
            <span className="text-teal/40">Select Assessments</span>
            <span className="text-teal/30">›</span>
            <span className="text-teal/40">Review Checkpoints</span>
            <span className="text-teal/30">›</span>
            <span className="font-medium text-teal">Your Results</span>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/review')}
            className="text-sm text-teal/60 underline hover:text-teal"
          >
            Edit responses
          </button>
          <button
            onClick={() => setShowResetModal(true)}
            className="text-sm text-terracotta underline hover:text-terracotta-dark"
          >
            Start over
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12 space-y-12">
        {/* Hero */}
        <div className="rounded-2xl bg-teal text-white p-8 flex items-center justify-between">
          <div>
            <p className="text-white/60 text-sm mb-1">UDL audit for</p>
            <h2 className="font-display text-3xl mb-2">{unitName}</h2>
            <p className="text-white/70">{gradeLabel}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-6xl font-bold">{overallScore}%</p>
            <p className="text-white/50 text-sm mt-1">overall UDL alignment</p>
          </div>
        </div>

        {/* Radar + dimension bars */}
        <div className="grid grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl border border-sand p-6">
            <h3 className="font-display text-xl text-teal mb-4">UDL Dimensions</h3>
            <ResultsRadarChart scores={dimensionScores} />
          </div>
          <div className="bg-white rounded-2xl border border-sand p-6">
            <h3 className="font-display text-xl text-teal mb-4">Breakdown</h3>
            <DimensionBars scores={dimensionScores} />
          </div>
        </div>

        {/* Suggestions */}
        <div>
          <h2 className="font-display text-2xl text-teal mb-6">Recommendations</h2>
          {loadingSuggestions ? (
            <div className="flex items-center gap-3 text-teal/60">
              <div className="w-5 h-5 border-2 border-teal/20 border-t-teal rounded-full animate-spin" />
              <span className="text-sm">Claude is generating recommendations…</span>
            </div>
          ) : suggestionsError ? (
            <p className="text-sm text-terracotta">
              Suggestions are temporarily unavailable. The checkpoint data above is still accurate.
            </p>
          ) : suggestions ? (
            <SuggestionsList suggestions={suggestions} />
          ) : null}
        </div>

        {/* Checkpoint table */}
        <div>
          <h2 className="font-display text-2xl text-teal mb-4">All Checkpoints</h2>
          <CheckpointTable checkpoints={checkpoints} assessments={assessments} />
        </div>

        {/* Download */}
        <div className="pt-4 border-t border-sand flex items-center gap-4">
          <PdfDownloadButton
            checkpoints={checkpoints}
            assessments={assessments}
            dimensionScores={dimensionScores}
            overallScore={overallScore}
            gradeLabel={gradeLabel}
            suggestions={suggestions}
          />
          <p className="text-xs text-teal/40">
            PDF includes all checkpoints, ratings, and recommendations.
          </p>
        </div>
      </div>

      {showResetModal && (
        <ResetModal
          onConfirm={handleReset}
          onCancel={() => setShowResetModal(false)}
        />
      )}
    </main>
  )
}
```

- [ ] **Step 6: Verify Step 3 in browser**

Complete Steps 1 and 2 in the app. On the results page, expected:
- Hero card with overall score and grade label
- Radar chart with 6 dimensions
- Dimension bars
- Loading spinner then suggestions appear
- Checkpoint table with all entries
- "Edit responses" and "Start over" links

- [ ] **Step 7: Commit**

```bash
git add app/results/page.tsx components/ResultsRadarChart.tsx components/DimensionBars.tsx components/CheckpointTable.tsx components/SuggestionsList.tsx
git commit -m "feat: add Step 3 results page with radar chart and suggestions"
```

---

## Task 11: PDF Report

**Files:**
- Create: `components/PdfReport.tsx`

- [ ] **Step 1: Create `components/PdfReport.tsx`**

```tsx
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
  row: { flexDirection: 'row', marginBottom: 6 },
  label: { fontSize: 10, color: '#1B3A4B', fontFamily: 'Helvetica-Bold', width: 120 },
  value: { fontSize: 10, color: '#4A6070', flex: 1 },
  bar: { height: 8, borderRadius: 4, marginBottom: 8 },
  barBg: { backgroundColor: '#E8E0D0' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#F3EFE8', padding: 8, marginBottom: 1 },
  tableRow: { flexDirection: 'row', padding: '6 8', borderBottomWidth: 1, borderBottomColor: '#F3EFE8' },
  tableCell: { fontSize: 8, color: '#1B3A4B' },
  badge: { borderRadius: 3, padding: '1 4', marginRight: 4 },
  badgeText: { fontSize: 7, fontFamily: 'Helvetica-Bold' },
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

interface ButtonProps extends ReportProps {}

export function PdfDownloadButton(props: ButtonProps) {
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
```

- [ ] **Step 2: Verify PDF download**

On the results page, click "Download PDF report". Expected:
- PDF downloads with correct filename `udl-lens-report.pdf`
- PDF contains: unit name, overall score, dimension bars, suggestions, checkpoint table
- If PDF generation fails, button shows error message (not crash)

- [ ] **Step 3: Commit**

```bash
git add components/PdfReport.tsx
git commit -m "feat: add PDF report with @react-pdf/renderer"
```

---

## Task 12: Reset Modal + Navigation Guards + Error Polish

**Files:**
- Create: `components/ResetModal.tsx`
- Modify: `app/results/page.tsx` (already wired in Task 10)

- [ ] **Step 1: Create `components/ResetModal.tsx`**

```tsx
interface Props {
  onConfirm: () => void
  onCancel: () => void
}

export function ResetModal({ onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-teal/30 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl border border-sand shadow-xl p-8 max-w-sm w-full mx-4">
        <h2 className="font-display text-xl text-teal mb-2">Start over?</h2>
        <p className="text-sm text-teal/60 mb-6">
          This will clear all assessments and checkpoint responses. Your data is not saved anywhere, so this cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-terracotta text-white py-2 text-sm font-medium hover:bg-terracotta-dark transition-colors"
          >
            Yes, start over
          </button>
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-sand text-teal py-2 text-sm hover:bg-sand transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Final TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors. Fix any type errors before proceeding.

- [ ] **Step 3: Full build check**

```bash
npm run build
```

Expected: Build completes successfully. Address any build errors.

- [ ] **Step 4: End-to-end smoke test**

```bash
npm run dev
```

Walk through the complete flow:
1. `http://localhost:3000` — add 2 assessments, one with a description
2. Click "Review UDL checkpoints →"
3. Wait for prefill — verify checkpoints load with AI ratings and reasoning
4. Rate all checkpoints — verify progress bar updates and "See results →" appears
5. Click "See results →"
6. Verify hero score, radar chart, dimension bars appear
7. Wait for suggestions to load — verify they're specific to the assessments
8. Verify checkpoint table shows all entries with correct status badges
9. Click "Download PDF report" — verify PDF downloads correctly
10. Click "Edit responses" — verify returns to Step 2 without clearing data
11. Click "Start over" — verify modal appears, confirm — verify redirects to Step 1

- [ ] **Step 5: Commit**

```bash
git add components/ResetModal.tsx
git commit -m "feat: add reset modal and complete end-to-end flow"
```

---

## Self-Review Against Spec

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| Step 1: Assessment name, type, lane, optional file upload | Task 5 |
| `/api/extract` — PDF/DOCX → description | Task 6 |
| Step 2: Harmful/helpful practices, AI rating + reasoning | Task 8 |
| Step 2: User rating — Not yet / Partially / Met | Task 8 |
| Step 2: Override tracking | SessionContext + CheckpointCard |
| Step 2: Sticky left nav with status dots | Task 8 |
| Step 2: Filter tabs by assessment | Task 8 |
| Step 2: Progress bar | Task 8 |
| Step 3: Overall % + grade label | Task 10 |
| Step 3: Radar chart (6 dimensions) | Task 10 |
| Step 3: Dimension breakdown bars | Task 10 |
| Step 3: Checkpoint table with AI badge | Task 10 |
| Step 3: Quick wins + longer-term improvements | Task 9 + 10 |
| Step 3: PDF download | Task 11 |
| Step 3: "Edit responses" link | Task 10 |
| Error: File upload fails → inline error | AssessmentForm.tsx |
| Error: Claude API fails on prefill → blank ratings + notice | review/page.tsx |
| Error: Claude API fails on suggestions → error message + results still render | results/page.tsx |
| Error: PDF fails → error state in button | PdfReport.tsx |
| Error: "Start over" modal | Task 12 |
| All checkpoints Met → special suggestions text | suggestions/route.ts |
| No auth, no database, one env var | Throughout |
| Fonts: Fraunces + Plus Jakarta Sans | Task 3 |
| Tailwind custom theme | Task 3 |
| Claude API server-side only | Tasks 6, 7, 9 |

**Confirmed gaps — none found.** All spec requirements are covered.
