# Pass 2 — Multi-Document Upload & Pre-Prefill Questionnaire Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address Luke's two architectural concerns from feedback round 1 — (a) brief, rubric, and exemplar are different artefacts and should be uploaded as typed slots so the AI gets structured context, and (b) several UDL 3.0 checkpoints can't be inferred from a document alone (classroom delivery, comms) so the user needs to self-report before AI prefill runs.

**Architecture:** Per-assessment data model expands from a single `description` string + single optional brief to (1) up to three typed `documents` (brief / rubric / exemplar) each with extracted text, and (2) a `responses` map of `checkpointId → answer` collected via a short questionnaire. Both are passed to the prefill API so Claude has structured context. The Review screen still shows the same 6 checkpoints curated by Luke — the change is in the *quality of the AI suggestion*, not in the rating workflow.

**Tech Stack:** Next.js 14 (App Router) + TypeScript, Tailwind, existing `/api/extract` and `/api/prefill` route handlers, Anthropic SDK. No new dependencies.

**Scope notes:**
- **Doc-type-specific checkpoint subsets are deferred.** Luke's full vision (each document type evaluated against its own UDL subset) requires him to curate those subsets. We build the data plumbing here so it's ready when he provides them; we do *not* invent subsets ourselves.
- **No automated tests.** This codebase has no test infrastructure. Verification is TypeScript typecheck (`npx tsc --noEmit`) plus manual smoke testing in the dev server (`npm run dev`).
- **Question wording is drafted from Luke's harmful/helpful practices** in `data/udl-checkpoints.json`. Luke should review the questions before the questionnaire is shown to other Curtin academics.

---

## File Structure

| File | Responsibility | Status |
|---|---|---|
| `lib/types.ts` | Add `AssessmentDocument`, `DocumentType`, extend `Assessment` with `documents[]` and `responses{}`, add `question` to `CheckpointDef` | Modify |
| `data/udl-checkpoints.json` | Add `question` field to each of the 6 checkpoints | Modify |
| `lib/udl.ts` | Helper for getting the questions relevant to an assessment type | Modify |
| `context/SessionContext.tsx` | New reducer cases for documents and responses | Modify |
| `components/TypedDocumentSlots.tsx` | Three typed upload slots (brief / rubric / exemplar) | Create |
| `components/QuestionnaireForm.tsx` | Renders the per-checkpoint self-report questions | Create |
| `components/AssessmentForm.tsx` | Replace single brief upload with `TypedDocumentSlots`; insert `QuestionnaireForm` below | Modify |
| `app/api/extract/route.ts` | Optionally accept document type in the form body so the response can be tagged | Modify |
| `app/api/prefill/route.ts` | Pass typed document context + questionnaire responses to Claude in the prompt | Modify |
| `app/about/page.tsx` | One paragraph explaining why some checkpoints have a self-report question | Modify |

---

## Phase 1 — Data model

### Task 1: Extend types

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Add document type definitions and extend `Assessment`**

Replace the existing `Assessment` interface and add new types directly above it:

```typescript
export type DocumentType = 'brief' | 'rubric' | 'exemplar'

export interface AssessmentDocument {
  type: DocumentType
  filename: string
  extractedText: string
}

export interface Assessment {
  id: string
  name: string
  type: AssessmentType
  lane: Lane
  description: string
  documents: AssessmentDocument[]
  responses: Record<string, string>
}
```

`responses` maps checkpoint ID (e.g. `'io-4-1'`) to the user's answer string. We store the literal answer text rather than a code so Luke can change the answer wording later without a migration.

- [ ] **Step 2: Add `question` to `CheckpointDef`**

Modify `CheckpointDef` in the same file:

```typescript
export interface CheckpointDef {
  code: string
  principle: Principle
  guideline: string
  title: string
  description?: string
  question?: string
  harmful: string[]
  helpful: string[]
}
```

`question` is optional so checkpoints that *can* be reliably inferred from documents alone don't need a self-report. For Pass 2 all six of Luke's checkpoints will get a question because they all involve classroom practice the AI can't see in a brief.

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: many errors in components and API routes that haven't been updated yet — that's fine, we're tracking them. Specifically, errors should appear in `context/SessionContext.tsx`, `app/audit/page.tsx`, `components/AssessmentForm.tsx`, `app/api/prefill/route.ts`, and `app/api/extract/route.ts`. List them so the next tasks can address each.

- [ ] **Step 4: No commit yet**

This task ends without commit because the project is in a broken state. Next task fixes the existing code paths.

---

### Task 2: Migrate existing Assessment construction sites to the new shape

**Files:**
- Modify: `context/SessionContext.tsx`
- Modify: `app/audit/page.tsx`
- Modify: `components/AssessmentForm.tsx`

- [ ] **Step 1: Find every place an `Assessment` is constructed**

Run: `grep -rn "type: 'lane\|name: '" app/ components/ context/ --include="*.ts" --include="*.tsx"` and `grep -rn "Omit<Assessment" app/ components/ context/`
Expected output: at least three sites — `app/audit/page.tsx` (when the form saves), `components/AssessmentForm.tsx` (the `onSave` typing), and `context/SessionContext.tsx` if it constructs assessments on RESET.

- [ ] **Step 2: Update `AssessmentForm`'s onSave signature so callers pass documents and responses**

In `components/AssessmentForm.tsx`, change the `onSave` prop type:

```typescript
onSave: (assessment: Omit<Assessment, 'id' | 'documents' | 'responses'> & { id?: string }) => void
```

Then in `handleSubmit`, the form is responsible for passing only the existing fields; documents and responses are stored separately in component state and merged at the audit-page level. (Phase 1 just makes the type compile — Phase 2 wires the new fields in.)

- [ ] **Step 3: Update `app/audit/page.tsx` to set empty arrays on save**

Find the function that handles saving the form (likely called `handleSave` or similar). When constructing the new `Assessment` (or updating an existing one), default the new fields:

```typescript
const newAssessment: Assessment = {
  id: existing?.id ?? crypto.randomUUID(),
  name: form.name,
  type: form.type,
  lane: form.lane,
  description: form.description,
  documents: existing?.documents ?? [],
  responses: existing?.responses ?? {},
}
```

If the existing code path destructures the form object directly, change it to spread plus default the new fields explicitly. The point is every `Assessment` instance in state must have `documents: []` and `responses: {}` at minimum.

- [ ] **Step 4: Verify typecheck passes**

Run: `npx tsc --noEmit`
Expected: clean — no errors. If errors remain, they belong to Tasks 4–8 and should be addressed there, not here. Make a note of which files still error and flag in commit.

- [ ] **Step 5: Smoke test the dev server**

Run: `npm run dev` and click through Add assessment → Name + type → Save. Verify the assessment appears in the list and the typecheck is still clean. The flow should look identical to before — we've only added empty arrays under the hood.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts context/SessionContext.tsx app/audit/page.tsx components/AssessmentForm.tsx
git commit -m "$(cat <<'EOF'
feat(types): extend Assessment with documents and questionnaire responses

Foundation for Pass 2. Adds AssessmentDocument and DocumentType, extends
Assessment with documents[] and responses{}, and adds optional question
field on CheckpointDef. All construction sites default the new fields to
empty so existing flows are unchanged.
EOF
)"
```

---

### Task 3: Add `question` field to all 6 checkpoints in the JSON

**Files:**
- Modify: `data/udl-checkpoints.json`

- [ ] **Step 1: Draft the six questions from Luke's harmful/helpful practices**

These are draft wordings derived from each checkpoint's existing `harmful`/`helpful` lists. Luke should review before the questionnaire ships to other academics, but they are good-enough to develop against.

| Checkpoint | Question |
|---|---|
| `io-4-1` | "For this assessment, do you allow students to adjust their physical environment (seating, position, lighting) and provide flexibility in pace and timing — including extra time for students with adjustment plans?" |
| `io-2-4` | "Do you actively acknowledge cultural and language differences in delivery — for example recognising students presenting in a second language, enabling closed captioning, and avoiding ableist language?" |
| `io-8-3` | "Do you establish group agreements, team roles, and structured collaborative learning goals — and explicitly tell students how they can ask for help?" |
| `fj-3-3` | "Do you make scaffolding explicit (chunked information, progressive disclosure) and integrate Indigenous and other holistic knowledge systems where relevant?" |
| `fj-5-2` | "Are students free to use a diversity of analytical and reflective tools, including generative AI with explicit responsible-use guidance?" |
| `fj-7-3` | "Do you build in time for imagination, experimentation, and play — and accept a diverse range of artistic and media expressions (music, film, visual, digital, AI-generated)?" |

- [ ] **Step 2: Add `question` field to each checkpoint**

Open `data/udl-checkpoints.json` and add the `question` key inside each of the six checkpoint objects, between `title` and `harmful`. For example, `io-4-1` becomes:

```json
"io-4-1": {
  "code": "4.1",
  "principle": "Action & Expression",
  "guideline": "Interaction",
  "title": "Vary and honor the methods for response, navigation, and movement",
  "question": "For this assessment, do you allow students to adjust their physical environment (seating, position, lighting) and provide flexibility in pace and timing — including extra time for students with adjustment plans?",
  "harmful": [...],
  "helpful": [...]
}
```

Repeat for `io-2-4`, `io-8-3`, `fj-3-3`, `fj-5-2`, `fj-7-3` using the table above.

- [ ] **Step 3: Verify JSON is valid and typecheck passes**

Run: `node -e "console.log(JSON.parse(require('fs').readFileSync('data/udl-checkpoints.json', 'utf8')).checkpoints['io-4-1'].question)"`
Expected: prints the io-4-1 question text.

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add data/udl-checkpoints.json
git commit -m "feat(data): add self-report question to each UDL checkpoint

Drafted from harmful/helpful practices. To be reviewed by Luke before
the questionnaire is exposed to other Curtin academics."
```

---

### Task 4: Add `getQuestionsForAssessmentType` helper

**Files:**
- Modify: `lib/udl.ts`

- [ ] **Step 1: Add the helper at the bottom of `lib/udl.ts`**

```typescript
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
```

This returns the ordered list of self-report questions for a given assessment type. The Review and Audit pages use it to render the questionnaire.

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add lib/udl.ts
git commit -m "feat(udl): add helper for assessment-type questionnaire"
```

---

## Phase 2 — Multi-document upload UI

### Task 5: Build the `TypedDocumentSlots` component

**Files:**
- Create: `components/TypedDocumentSlots.tsx`

- [ ] **Step 1: Write the component**

```typescript
'use client'

import { useRef, useState } from 'react'
import type { AssessmentDocument, DocumentType } from '@/lib/types'

interface SlotConfig {
  type: DocumentType
  label: string
  hint: string
  required: boolean
}

const SLOTS: SlotConfig[] = [
  { type: 'brief', label: 'Brief', hint: 'The assignment task instructions students see', required: true },
  { type: 'rubric', label: 'Rubric', hint: 'Marking criteria, performance descriptors', required: false },
  { type: 'exemplar', label: 'Exemplar', hint: 'Sample student work or worked example', required: false },
]

interface Props {
  documents: AssessmentDocument[]
  onChange: (documents: AssessmentDocument[]) => void
}

export function TypedDocumentSlots({ documents, onChange }: Props) {
  const [uploadingType, setUploadingType] = useState<DocumentType | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputs = useRef<Record<DocumentType, HTMLInputElement | null>>({
    brief: null, rubric: null, exemplar: null,
  })

  function getDoc(type: DocumentType): AssessmentDocument | undefined {
    return documents.find(d => d.type === type)
  }

  async function handleFileUpload(type: DocumentType, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingType(type)
    setUploadError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('documentType', type)
      const res = await fetch('/api/extract', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json() as { extractedText: string; assessments?: { title: string; description: string }[] }
      const extractedText = data.extractedText ?? data.assessments?.[0]?.description ?? ''
      const next = documents.filter(d => d.type !== type)
      next.push({ type, filename: file.name, extractedText })
      onChange(next)
    } catch {
      setUploadError(`Could not extract text from the ${type}. You can still continue without it.`)
    } finally {
      setUploadingType(null)
      const input = fileInputs.current[type]
      if (input) input.value = ''
    }
  }

  function handleRemove(type: DocumentType) {
    onChange(documents.filter(d => d.type !== type))
  }

  return (
    <div className="space-y-2">
      {SLOTS.map(slot => {
        const doc = getDoc(slot.type)
        const isUploading = uploadingType === slot.type
        return (
          <div key={slot.type} className="rounded-lg border border-sand bg-white">
            <div className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-teal">{slot.label}</span>
                  {slot.required && <span className="text-xs text-terracotta">recommended</span>}
                </div>
                <p className="text-xs text-teal/50 truncate">{doc ? doc.filename : slot.hint}</p>
              </div>
              {doc ? (
                <button
                  type="button"
                  onClick={() => handleRemove(slot.type)}
                  className="text-xs text-teal/60 hover:text-terracotta underline"
                >
                  Remove
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputs.current[slot.type]?.click()}
                  disabled={isUploading}
                  className="rounded-md border border-teal/30 hover:border-teal/60 hover:bg-teal/5 px-3 py-1 text-xs font-medium text-teal disabled:opacity-60 transition-colors flex items-center gap-1.5"
                >
                  {isUploading ? (
                    <>
                      <span className="w-3 h-3 border-2 border-teal/30 border-t-teal rounded-full animate-spin" aria-hidden="true" />
                      Extracting…
                    </>
                  ) : (
                    'Upload'
                  )}
                </button>
              )}
              <input
                ref={el => { fileInputs.current[slot.type] = el }}
                type="file"
                accept=".pdf,.docx,.txt,.md"
                onChange={e => handleFileUpload(slot.type, e)}
                className="hidden"
              />
            </div>
          </div>
        )
      })}
      {uploadError && <p className="text-sm text-terracotta">{uploadError}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/TypedDocumentSlots.tsx
git commit -m "feat(ui): typed document slots component (brief, rubric, exemplar)"
```

---

### Task 6: Update the extract API to accept and surface a document type

**Files:**
- Modify: `app/api/extract/route.ts`

- [ ] **Step 1: Inspect the current route to understand the response shape**

Read `app/api/extract/route.ts` from top to bottom and note:
- What it currently returns (likely `{ assessments: [{ title, description }] }`)
- Where the extracted text comes from in the flow

- [ ] **Step 2: Extend the route to also return `extractedText`**

Without breaking the existing assessments-list response (used by the multi-assessment picker), add an `extractedText` field at the top level whenever a single document is uploaded. Keep backward compatibility:

```typescript
// After computing the extracted full text from the file:
return NextResponse.json({
  extractedText: fullText,
  assessments: detectedAssessments, // existing field
  documentType: formData.get('documentType') ?? null, // echo back if provided
})
```

The new `TypedDocumentSlots` component uses `extractedText`. The existing audit-page upload (which we will replace in Task 7) still uses `assessments`. Both shapes coexist for one task only.

- [ ] **Step 3: Verify typecheck and smoke test**

Run: `npx tsc --noEmit` — expected clean.
Run: `npm run dev`, upload a brief through the existing flow, confirm in browser devtools that the response now also includes `extractedText`.

- [ ] **Step 4: Commit**

```bash
git add app/api/extract/route.ts
git commit -m "feat(api): include extractedText and documentType in extract response"
```

---

### Task 7: Replace single-upload UI with `TypedDocumentSlots` in `AssessmentForm`

**Files:**
- Modify: `components/AssessmentForm.tsx`

**Trade-off note.** The current `AssessmentForm` supports a "multi-assessment-from-one-upload" picker: if a user uploads a unit outline that the extractor detects as containing multiple assessments, a modal lets them pick one. With typed slots that workflow no longer fits — the brief slot is for *this* assessment's brief, not a unit-wide document. We're removing that flow. If users with multi-assessment unit outlines need a bulk-create path, add it as a separate "Unit outline import" feature in a later pass.

- [ ] **Step 1: Add documents state and remove single-upload state**

In the existing component, replace these state hooks:

```typescript
const [uploading, setUploading] = useState(false)
const [uploadError, setUploadError] = useState<string | null>(null)
const [pickerAssessments, setPickerAssessments] = useState<ExtractedAssessment[] | null>(null)
const fileInputRef = useRef<HTMLInputElement>(null)
```

with:

```typescript
const [documents, setDocuments] = useState<AssessmentDocument[]>(initial?.documents ?? [])
```

Remove the now-unused `handleFileUpload`, `applyExtracted`, the `pickerAssessments` state, the `AssessmentPickerModal` import and JSX, and `fileInputRef`. Also remove the `ExtractedAssessment` interface from this file — it's only used by the picker. The `AssessmentPickerModal.tsx` file itself can stay in the repo for now (no consumer means it's dead code; clean up in a follow-up commit if desired).

- [ ] **Step 2: Replace the single-upload JSX with `<TypedDocumentSlots>`**

Find the block beginning `<label ...>Assessment description ...</label>` and the surrounding upload button. Replace the whole block (label, textarea, upload button, picker modal) with:

```tsx
<div>
  <label className="block text-sm font-medium text-teal mb-2">
    Documents
    <span className="ml-1 text-teal/50 font-normal">(optional — helps the AI)</span>
  </label>
  <TypedDocumentSlots documents={documents} onChange={setDocuments} />
</div>

<div>
  <label className="block text-sm font-medium text-teal mb-1">
    Description (optional)
    <span className="ml-1 text-teal/50 font-normal">— extra context not captured by uploads</span>
  </label>
  <textarea
    value={description}
    onChange={e => setDescription(e.target.value)}
    placeholder="Anything else the AI should know about how this assessment is delivered…"
    rows={3}
    className="w-full rounded-lg border border-sand px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/40 bg-white resize-none"
  />
</div>
```

- [ ] **Step 3: Update `handleSubmit` to pass documents through `onSave`**

Change the existing call:

```typescript
onSave({ id: initial?.id, name: name.trim(), type, lane, description })
```

to:

```typescript
onSave({ id: initial?.id, name: name.trim(), type, lane, description, documents, responses: initial?.responses ?? {} })
```

The form now passes documents through; questionnaire responses stay defaulted (Phase 3 wires them).

- [ ] **Step 4: Update the `onSave` prop type** in the same file:

```typescript
onSave: (assessment: Omit<Assessment, 'id'> & { id?: string }) => void
```

- [ ] **Step 5: Update `app/audit/page.tsx` to pass and persist documents**

Wherever the audit page receives a saved assessment, persist `documents` and `responses` (default to existing values when editing; default to empty when creating). Replace any object-spread that drops these fields.

- [ ] **Step 6: Smoke test the dev server**

Run: `npm run dev` and:
- Add an assessment, upload a brief — confirm the slot shows the filename and "Remove" button.
- Upload a rubric — confirm both slots show their files.
- Remove a slot — confirm the slot returns to the upload state.
- Save the assessment, then edit it — confirm the documents are still there.

- [ ] **Step 7: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add components/AssessmentForm.tsx app/audit/page.tsx
git commit -m "feat(ui): replace single-upload with typed document slots in assessment form"
```

---

## Phase 3 — Pre-prefill questionnaire

### Task 8: Build the `QuestionnaireForm` component

**Files:**
- Create: `components/QuestionnaireForm.tsx`

- [ ] **Step 1: Write the component**

```typescript
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
```

The four-option Likert ("Yes / Sometimes / Not yet / Not sure") is intentional: "Not sure" is provided so users don't feel forced into a guess, and it tells the AI to weight the document context more heavily for that checkpoint.

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/QuestionnaireForm.tsx
git commit -m "feat(ui): pre-prefill questionnaire component"
```

---

### Task 9: Wire `QuestionnaireForm` into `AssessmentForm`

**Files:**
- Modify: `components/AssessmentForm.tsx`

- [ ] **Step 1: Add responses state**

Near the top of the component, alongside `documents`:

```typescript
const [responses, setResponses] = useState<Record<string, string>>(initial?.responses ?? {})
```

When the assessment type changes, clear stale responses (keys won't match the new type's checkpoints):

```typescript
function handleTypeChange(value: AssessmentType) {
  setType(value)
  const opt = ASSESSMENT_TYPE_OPTIONS.find(o => o.value === value)
  if (opt) setLane(opt.lane)
  setResponses({})
}
```

- [ ] **Step 2: Render the questionnaire below the description textarea**

Add the `QuestionnaireForm` import at the top:

```typescript
import { QuestionnaireForm } from '@/components/QuestionnaireForm'
```

Below the description textarea block, add:

```tsx
<div>
  <label className="block text-sm font-medium text-teal mb-1">
    Quick self-report
    <span className="ml-1 text-teal/50 font-normal">— some UDL practices live in delivery, not the brief</span>
  </label>
  <QuestionnaireForm
    assessmentType={type}
    responses={responses}
    onChange={setResponses}
  />
</div>
```

- [ ] **Step 3: Pass `responses` through `onSave`**

```typescript
onSave({ id: initial?.id, name: name.trim(), type, lane, description, documents, responses })
```

- [ ] **Step 4: Smoke test**

Run: `npm run dev`. Add a new assessment with type Interactive Oral. Verify:
- Three questionnaire questions appear matching `io-4-1`, `io-2-4`, `io-8-3`.
- Clicking an answer chip selects it (teal background, white text).
- Switching the type to Field Journal swaps the questions to `fj-3-3`, `fj-5-2`, `fj-7-3` and clears prior selections.
- Saving and re-opening the assessment preserves both the documents and the answers.

- [ ] **Step 5: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add components/AssessmentForm.tsx
git commit -m "feat(ui): wire questionnaire into assessment form"
```

---

## Phase 4 — Wire to AI prefill

### Task 10: Pass typed documents and questionnaire responses to the prefill API

**Files:**
- Modify: `app/api/prefill/route.ts`
- Modify: `app/review/page.tsx` (where prefill is called)

- [ ] **Step 1: Update the assessment-context block in the prefill prompt**

In `app/api/prefill/route.ts`, find the existing `assessmentContext` builder:

```typescript
const assessmentContext = assessments
  .map(a => `Assessment ID: ${a.id}
Name: ${a.name}
Type: ${a.type}
Lane: ${a.lane}
Description: ${a.description || '(no description provided — use assessment type as context)'}`)
  .join('\n\n')
```

Replace it with a richer builder that includes typed documents and responses:

```typescript
const assessmentContext = assessments
  .map(a => {
    const docs = a.documents.length === 0
      ? '(no documents uploaded)'
      : a.documents
          .map(d => `--- ${d.type.toUpperCase()} (${d.filename}) ---\n${d.extractedText}`)
          .join('\n\n')
    const responses = Object.keys(a.responses).length === 0
      ? '(no self-report answers provided)'
      : Object.entries(a.responses)
          .map(([id, ans]) => `  ${id}: ${ans}`)
          .join('\n')
    return `Assessment ID: ${a.id}
Name: ${a.name}
Type: ${a.type}
Lane: ${a.lane}
${a.description ? `Extra notes: ${a.description}\n` : ''}Documents:
${docs}

Teacher's self-report (per checkpoint ID):
${responses}`
  })
  .join('\n\n========\n\n')
```

- [ ] **Step 2: Update the prompt instructions to reference the new context**

Find the line in the prompt that says something like *"Read the assessment description and rate..."*. Add the following sentence directly above it:

```
The teacher has uploaded documents (typed as Brief, Rubric, or Exemplar) and answered short self-report questions about classroom delivery. The self-report key matches the checkpoint ID. Weight the self-report heavily for checkpoints whose practice lives in delivery rather than in documents (collaboration, biases in language, joy and play). For checkpoints clearly evidenced by the documents (e.g. multiple tools, methods of response), corroborate the self-report with the document text.
```

- [ ] **Step 3: Verify the call site sends the right shape**

In `app/review/page.tsx`, find where it calls `fetch('/api/prefill', ...)`. The `assessments` array is already passed as part of `body`. Confirm that the assessments now include the `documents` and `responses` fields (they should, since they're on `Assessment` directly). No code change unless TypeScript complains.

- [ ] **Step 4: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: End-to-end smoke test**

Run: `npm run dev`. Walk the full flow:
1. Add an Interactive Oral assessment.
2. Upload a brief PDF.
3. Answer the three self-report questions (e.g. one Yes, one Sometimes, one Not yet).
4. Proceed to review.
5. Confirm the AI suggestions appear and the reasoning *references* the self-report and the brief content (e.g. "Based on your self-report that you sometimes…"). If the reasoning is generic, refine the prompt instructions in Step 2.

If the reasoning doesn't reflect the new inputs, iterate on the prompt before committing.

- [ ] **Step 6: Commit**

```bash
git add app/api/prefill/route.ts app/review/page.tsx
git commit -m "feat(prefill): include typed documents and questionnaire in AI context"
```

---

### Task 11: Update the About page

**Files:**
- Modify: `app/about/page.tsx`

- [ ] **Step 1: Add a paragraph explaining the questionnaire and typed uploads**

In the "How UDL Lens works" section (numbered 1–3), expand step 1's body. Find:

```
Describe each assessment in your unit — name, type, and A2030 lane. Optionally
upload the assignment brief (PDF or DOCX) so the AI has full context.
```

Replace with:

```
Describe each assessment in your unit — name, type, and A2030 lane. You can
optionally upload up to three documents (brief, rubric, exemplar) and answer
a short self-report about classroom delivery. Several UDL 3.0 practices live
in how you teach rather than in any document, so the self-report fills that
gap and helps the AI give a more honest pre-fill.
```

- [ ] **Step 2: Verify typecheck and dev server renders the page**

Run: `npx tsc --noEmit` — expected clean.
Run: `npm run dev`, navigate to `/about`, confirm the new paragraph reads naturally.

- [ ] **Step 3: Commit**

```bash
git add app/about/page.tsx
git commit -m "docs(about): explain typed documents and self-report questionnaire"
```

---

## Final verification

- [ ] **Step 1: Run full typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 2: Build the production bundle**

Run: `npm run build`
Expected: builds clean. If any warnings appear in newly-touched files, address them.

- [ ] **Step 3: Walk a full session in the dev server with two assessments**

Add one Interactive Oral and one Field Journal. Upload a brief to each. Answer three questions for each. Run prefill, review every checkpoint, look at the results page. Verify:
- The whole-of-unit banner does *not* appear (two assessments, principles likely non-zero).
- The radar shows triangle with all three principles.
- The AI reasoning references the self-report.
- PDF download works and includes the new context implicitly.

---

## Open questions for Luke (capture before shipping to other academics)

1. **Question wording.** All six questions are drafted by us from your harmful/helpful practices. Read them in the form (`/audit` → Add assessment) and edit anything that doesn't sound like how a Curtin academic would phrase it. The text is in `data/udl-checkpoints.json`.
2. **Answer scale.** Currently four options: Yes / Sometimes / Not yet / Not sure. Do you want a different scale (e.g. five-point Likert, free text) for any specific question?
3. **Document-type-specific checkpoint subsets.** Pass 3 territory. When you have time, sketch which UDL 3.0 considerations should specifically apply to a brief, a rubric, or an exemplar (you mentioned 8.1, 7.2, 9.1, 3.1 etc. for exemplars in the original feedback). We'll wire those subsets when you provide them.

---

## Self-review notes

- **Spec coverage:** Pass 2's two named items (multi-doc upload, pre-prefill questionnaire) each have dedicated phases with concrete tasks. The Pass 3 item "doc-type-specific subsets" is explicitly deferred and surfaced in the open questions.
- **Type consistency:** `AssessmentDocument`, `DocumentType`, `Assessment.documents`, `Assessment.responses`, `CheckpointDef.question` are the new names; they appear consistently in tasks 1, 4, 5, 7, 8, 9, 10.
- **No placeholders:** All code blocks contain literal code; no "TBD" or "fill in" strings.
- **File paths:** Every task lists the exact file(s) it touches.
