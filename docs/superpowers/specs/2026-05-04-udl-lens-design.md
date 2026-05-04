# UDL Lens — Design Spec

**Date:** 2026-05-04  
**Author:** Michael Borck  
**Context:** Prototype for iSoLT grant collaboration with Luke (Curtin University). Standalone tool separate from curriculum-curator.

---

## Overview

UDL Lens is a standalone web tool that helps Curtin academics audit their unit assessments against the UDL Guidelines 3.0, framed around the Assessment 2030 (A2030) initiative. It is designed for two overlapping audiences: individual unit coordinators doing self-directed reflection, and teaching support staff (e.g., Jolyon) facilitating conversations with academics.

The core interaction is AI-assisted: Claude pre-fills a UDL checkpoint rating for each assessment based on the uploaded brief or description, then the user verifies or overrides each rating. This reduces blank-slate fatigue while keeping the educator in control and ensuring they engage with the harmful/helpful practice descriptions — which is where the awareness-building happens.

No login, no database. Session state only. The only persistence is a downloadable PDF report.

---

## Goals

1. Make Curtin staff more familiar with UDL guidelines in the context of their own assessments
2. Identify where their curriculum already demonstrates good UDL practice
3. Surface concrete gaps with actionable next steps
4. Generate a shareable PDF report suitable for a teaching support conversation or professional development evidence

---

## Audiences

- **Unit coordinator (academic)**: Uses the tool independently. May have limited UDL knowledge. Needs clear scaffolding and plain language throughout.
- **Teaching support staff**: Uses the tool as a facilitation instrument in a conversation with a unit coordinator. More UDL-literate. Needs the tool to be navigable at pace.

Both audiences use the same interface — no mode switching needed.

---

## User Flow

### Step 1 — Select Assessments

User describes the assessments in their unit (typically 3):

- Assessment name / type (picked from a predefined list)
- A2030 lane:
  - **Lane 1 — Secure** (e.g., Interactive Oral, Invigilated Exam)
  - **Lane 2 — Non-secure** (e.g., Field Journal, Portfolio, Written Report)
- Optional: paste a description or upload the assignment brief (PDF or DOCX)

If a file is uploaded, it is sent to Claude via `/api/extract` which returns a structured plain-text description. This description is used as the AI's context for checkpoint pre-filling. If no file is uploaded, the AI falls back to the assessment type alone — producing weaker but still useful pre-fills.

Multiple assessments are added before proceeding. A unit with 3 assessments is the common case.

### Step 2 — Review Checkpoints

For each UDL checkpoint relevant to the selected assessment types:

- The checkpoint is shown with its UDL principle category (Representation / Engagement / Expression + Action)
- The harmful and helpful practice descriptions (sourced from Luke's A2030/UDL prototype and the UDL Guidelines 3.0) are displayed
- Claude's pre-filled rating is shown with a brief reasoning note
- The user selects their rating: **Not yet / Partially / Met**
- If the user's choice differs from Claude's, it is marked as "overridden"

Navigation:
- Sticky left panel lists all checkpoints with status dots (grey pending / amber partial / green met / red gap)
- Filter tabs allow viewing checkpoints by assessment
- Progress bar shows overall completion

### Step 3 — Your Results

Displayed once all checkpoints are reviewed:

- **Hero summary**: unit name, overall UDL alignment percentage, grade label
- **Radar / spider chart**: 6 UDL dimensions visualised (Representation, Engagement, Expression, Accessibility, Flexibility, Equity)
- **Dimension breakdown bars**: score per dimension
- **Checkpoint table**: all checkpoints with principle tag, assessment name, and final status — AI-badge on AI-suggested ratings
- **Quick wins**: 2–4 immediately actionable suggestions (AI-generated from gap checkpoints)
- **Longer-term improvements**: 2–3 deeper structural suggestions
- **PDF download**: full report including all of the above
- **Edit responses** link: returns to Step 2 without clearing data

---

## Data Architecture

### UDL Checkpoint Data (`/data/udl-checkpoints.json`)

The core knowledge asset of the tool. A curated JSON file mapping:

```
assessment_type → checkpoint_ids[]
checkpoint_id → {
  code,           // e.g. "8.3"
  principle,      // "Engagement"
  dimension,      // "Sustaining Effort and Persistence"
  title,          // "Foster collaboration, interdependence..."
  description,    // Full guideline text
  harmful[],      // Concrete harmful practice examples
  helpful[]       // Concrete helpful practice examples
}
```

Seeded from Luke's A2030/UDL prototype document and the UDL Guidelines 3.0 website. Designed to be extended by adding checkpoint entries and updating the assessment→checkpoint mapping without touching application code.

### Session State (React, in-memory)

```typescript
interface SessionState {
  assessments: Assessment[]       // Step 1 output
  checkpoints: CheckpointResult[] // Step 2 output (AI + user ratings)
  suggestions: Suggestions | null // Step 3 AI output
}

interface Assessment {
  id: string
  name: string
  type: string
  lane: 'lane1' | 'lane2'
  description: string             // Extracted from upload or typed
}

interface CheckpointResult {
  checkpointId: string
  assessmentId: string
  aiRating: 'not_yet' | 'partial' | 'met'
  aiReasoning: string
  userRating: 'not_yet' | 'partial' | 'met' | null  // null = not yet reviewed
  overridden: boolean
}
```

---

## API Routes

All Claude calls are server-side — the API key never reaches the browser.

### `POST /api/extract`

Accepts a file upload (PDF or DOCX). Returns a plain-text description of the assessment extracted by Claude. Used in Step 1 when a brief is uploaded.

**Input:** `FormData` with `file`  
**Output:** `{ description: string }`

### `POST /api/prefill`

Accepts the list of assessments with descriptions and the relevant checkpoint IDs. Returns AI ratings and reasoning for each checkpoint.

**Input:** `{ assessments: Assessment[], checkpointIds: string[] }`  
**Output:** `{ checkpointId: string, assessmentId: string, rating: Rating, reasoning: string }[]`

### `POST /api/suggestions`

Accepts the verified checkpoint results. Returns quick wins and longer-term improvements.

**Input:** `{ checkpoints: CheckpointResult[], assessments: Assessment[] }`  
**Output:** `{ quickWins: string[], longerTerm: string[] }`

---

## Technical Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 14 (App Router) | Single codebase, API routes, deploys anywhere as Node.js |
| Language | TypeScript | Type safety, consistent with author's existing projects |
| Styling | Tailwind CSS (custom theme) | Utility-first, no component library lock-in |
| Charts | Recharts | Radar chart support, React-native, lightweight |
| PDF | `@react-pdf/renderer` | Client-side generation, no server dependency |
| AI | Claude API via `@anthropic-ai/sdk` | claude-sonnet-4-6, server-side only |
| Fonts | Fraunces (display) + Plus Jakarta Sans (UI) | Warm, editorial, distinctive — avoids generic SaaS feel |

---

## Design Direction

**Aesthetic**: Editorial warmth. Warm cream background (`#FAF7F2`), deep teal primary (`#1B3A4B`), terracotta accent (`#C96B2F`). Fraunces serif for display headings, Plus Jakarta Sans for UI. Feels like a considered Curtin publication — authoritative but approachable.

**Not**: Generic SaaS, purple gradients, shadcn defaults, dashboard-grey.

The tool is itself a demonstration of accessible, considered design — appropriate for a UDL-focused grant proposal.

---

## Deployment

```bash
# Local
npm run dev

# Production (any Node.js host / VPS)
npm run build
npm start

# Environment variable required:
ANTHROPIC_API_KEY=sk-ant-...
```

No database. No migrations. No user accounts. One environment variable.

---

## Error Handling

- **File upload fails**: Inline error, user falls back to manual description. Never blocks progress.
- **Claude API fails on prefill**: Skip AI pre-fill, user starts from blank ratings. Show notice.
- **Claude API fails on suggestions**: Retry once, then show "suggestions temporarily unavailable" — results page still renders.
- **Malformed API response**: Fall back to blank ratings, log to console.
- **PDF generation fails**: Offer plain-text clipboard fallback.
- **All checkpoints Met**: Show congratulatory results, suggestions section reframes to "maintaining strong UDL alignment."
- **User returns to Step 1 from Step 3**: Warn via modal that checkpoint responses will be cleared, then reset.

---

## Out of Scope (for prototype)

- Authentication / user accounts
- Saving or comparing sessions over time
- Institution-level analytics across multiple users
- Generic (non-A2030) UDL mode
- Mobile-optimised layout (desktop-first for the prototype)
- Automated test suite
