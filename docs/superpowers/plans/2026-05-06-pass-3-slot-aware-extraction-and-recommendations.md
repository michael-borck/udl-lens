# Pass 3 - Slot-Aware Extraction, Recommendations Polish, View Cleanup

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three independent improvements to UDL Lens after Pass 2: (1) make `/api/extract` slot-aware so the document type the user picked tells Claude what to look for - including detecting multiple assessments in a unit outline and reinstating the picker; (2) enrich AI recommendations with reasoning, related UDL guideline codes, and a link to the CAST source; (3) remove the "All Checkpoints" panel from the results page (Luke called it low-value), keeping the same data in the PDF report.

**Architecture:** Phase 1 branches `/api/extract` per `documentType` form field (added in Pass 2), changes the response from `{ assessments }` to a uniform `{ candidates }` array regardless of slot, and reinstates `AssessmentPickerModal` from inside `TypedDocumentSlots` whenever `candidates.length > 1`. Phase 2 changes the `Suggestions` shape from `string[]` to a structured `Suggestion[]` with `text`, `why`, and `udlCodes`, then updates the AI prompt and both render targets (web + PDF). Phase 3 deletes one section from `app/results/page.tsx`; the underlying `CheckpointTable` component stays because the PDF still uses it.

**Tech Stack:** Next.js 14 (App Router), TypeScript strict, Tailwind, Anthropic SDK, `@react-pdf/renderer`. No new dependencies.

**Scope notes:**
- **Doc-type-specific checkpoint subsets are still deferred.** Awaiting Luke's curation of which UDL 3.0 considerations should specifically apply to a brief vs a rubric vs an exemplar. Pass 3 plumbing makes that future work easy: each document already has a `type`, and the prefill API already iterates documents.
- **External links use a single CAST root URL.** UDL 3.0 doesn't expose stable per-consideration URLs we can derive from a code, so each suggestion shows its UDL codes as chips and the suggestions section gets a single "Read more on UDL Guidelines 3.0" link below. Curated per-resource links (Curtin Teaching Support, Indigenous Knowledge resources) are out of scope; can be added later if Luke provides URLs.
- **No tests.** Codebase has no test framework; the prior plan opted out and we keep that. Verification is `npx tsc --noEmit` plus manual smoke testing.
- **Commit style.** Match existing: `feat(scope): subject` or `fix(scope): subject`, with the `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer that other commits use.

---

## File Structure

| File | Responsibility | Status |
|---|---|---|
| `app/api/extract/route.ts` | Branch on `documentType`; produce a `candidates` array per slot | Modify |
| `components/TypedDocumentSlots.tsx` | Consume new response shape; show `AssessmentPickerModal` when multiple candidates returned | Modify |
| `components/AssessmentPickerModal.tsx` | Confirm prop shape works for all three slot types; tweak title only if needed | Modify (light) |
| `lib/types.ts` | Replace `Suggestions = { quickWins: string[]; longerTerm: string[] }` with structured `Suggestion[]` shape | Modify |
| `app/api/suggestions/route.ts` | Update the AI prompt to produce the new shape; update fallback in the catch path | Modify |
| `components/SuggestionsList.tsx` | Render the new `Suggestion` shape with UDL chips, "why" line, and a CAST link below | Modify |
| `components/PdfReport.tsx` | Render the new `Suggestion` shape in the PDF | Modify |
| `app/results/page.tsx` | Delete the "All Checkpoints" section; keep PDF flow | Modify |

---

## Phase 1 - Slot-aware extraction + multi-pick reinstatement

### Task 1: Slot-aware extract API

**Files:**
- Modify: `app/api/extract/route.ts`

- [ ] **Step 1: Read the current route end-to-end**

Read `/Users/michael/Projects/udl-lens/app/api/extract/route.ts` so you understand:
- How `documentType` is read from the FormData (Pass 2 added this).
- The current `extractWithAI(text)` and `extractPdfWithAI(base64)` helpers (they currently produce `{title, description}` per detected assessment).
- The existing response shape: `{ extractedText, assessments, documentType }`.

- [ ] **Step 2: Define a unified `Candidate` shape and update the extraction helpers**

Inside the route file (or as a small private interface block at the top), add:

```typescript
interface Candidate {
  title: string    // For brief: the assessment name; for rubric: 'Rubric for ...' or similar; for exemplar: 'Exemplar for ...'
  content: string  // The relevant slice of text for this slot
}
```

The helpers `extractWithAI` and `extractPdfWithAI` should now return `Candidate[]` instead of `ExtractedAssessment[]`. The legacy `ExtractedAssessment` interface in this file can be removed once the helpers no longer reference it.

- [ ] **Step 3: Branch the prompt per `documentType`**

Each helper composes a different prompt depending on the slot. Use this prompt builder pattern:

```typescript
function promptForDocumentType(docType: string | null): string {
  if (docType === 'rubric') {
    return `You are extracting marking rubrics from a document. Find every rubric or marking-criteria block in the document. For each, return a "title" (e.g. "Rubric for Final Report" or the assessment name if labelled) and "content" (the rubric text itself: criteria, performance descriptors, weights). If the document does not appear to contain a rubric, return an empty array.`
  }
  if (docType === 'exemplar') {
    return `You are extracting student-work exemplars from a document. Find every exemplar, sample student response, or worked example. For each, return a "title" (e.g. "High Distinction example" or the assessment name) and "content" (the exemplar text or annotated commentary). If the document does not appear to contain an exemplar, return an empty array.`
  }
  // Default: brief
  return `You are extracting assessment briefs from a document. Find every distinct assessment task in the document. For each, return a "title" (the assessment name) and "content" (the brief: task description, requirements, deliverables, due dates - everything a student would need). If the document only contains one assessment, return an array with one entry. If the document is itself an assessment brief (not a unit outline), return one entry with the document treated as a single brief.`
}
```

The Anthropic call asks Claude to return JSON matching `{ candidates: Candidate[] }`. Use the same JSON-fenced output pattern the existing helpers use; just swap the prompt and return shape.

For the **PDF helper** (`extractPdfWithAI`), pass the same prompt as the system text but include the binary PDF as a `document` content block as it does today.

For the **text helper** (`extractWithAI`), pass the same prompt and include the extracted text as a user message.

- [ ] **Step 4: Update the response**

Replace the existing response builder so the route returns:

```typescript
return NextResponse.json({
  extractedText,         // unchanged - empty string for PDFs as documented
  documentType: documentTypeValue,  // unchanged
  candidates,            // NEW: Candidate[]
})
```

The legacy `assessments` field is removed because nothing else consumes it after Pass 2 (only `TypedDocumentSlots`, which we update in Task 2). Confirm by `grep -rn "data\.assessments\|\.json() as.*assessments" components/ app/ lib/`. If anything else still consumes `assessments`, stop and report - this plan assumed only `TypedDocumentSlots` reads the field.

- [ ] **Step 5: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: clean. (`TypedDocumentSlots.tsx` was loose-typed against `assessments?: [...]` so it won't break the typecheck even though it'll need updating in Task 2.)

- [ ] **Step 6: Commit**

```bash
git add app/api/extract/route.ts
git commit -m "$(cat <<'EOF'
feat(api): slot-aware extraction with per-type prompts

Branches /api/extract on documentType. Brief returns one or more
detected assessments; rubric extracts marking criteria from a doc
(standalone or embedded in a brief); exemplar extracts sample work.
Response shape consolidates to candidates: Candidate[].

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Reinstate the picker in TypedDocumentSlots

**Files:**
- Modify: `components/TypedDocumentSlots.tsx`
- Modify: `components/AssessmentPickerModal.tsx` (light - title text and prop name)

- [ ] **Step 1: Read both current components**

- `components/TypedDocumentSlots.tsx` to see the upload handler.
- `components/AssessmentPickerModal.tsx` to confirm props. Currently it expects `assessments: ExtractedAssessment[]` and an `onSelect(assessment)` callback. We will rename to a generic `candidates: Candidate[]`.

- [ ] **Step 2: Make `AssessmentPickerModal` slot-agnostic**

In `components/AssessmentPickerModal.tsx`:
- Replace the local `ExtractedAssessment` interface with an import-or-redeclare of `Candidate` matching the API: `interface Candidate { title: string; content: string }`. Re-export it so `TypedDocumentSlots` can import it from this file (or move both to a small shared `lib/api-shapes.ts` if you prefer; either is fine).
- Rename the prop from `assessments` to `candidates`.
- Make the modal title configurable via a new `title?: string` prop, defaulting to "Multiple items found".
- Make each row render `c.title` as a heading and `c.content` as a truncated preview underneath (e.g. first 200 chars + ellipsis).

The list rendering loop becomes:

```tsx
{candidates.map((c, i) => (
  <button
    key={i}
    onClick={() => onSelect(c)}
    className="..."  // existing button classes
  >
    <p className="font-medium text-teal">{c.title}</p>
    <p className="text-xs text-teal/60 mt-1 line-clamp-2">
      {c.content.length > 200 ? `${c.content.slice(0, 200)}...` : c.content}
    </p>
  </button>
))}
```

- [ ] **Step 3: Update `TypedDocumentSlots` to consume candidates and show the picker**

In `components/TypedDocumentSlots.tsx`:

- Add state for the candidate list waiting on a pick:

```typescript
const [pickerState, setPickerState] = useState<{ type: DocumentType; candidates: Candidate[] } | null>(null)
```

- Add the import: `import { AssessmentPickerModal, type Candidate } from '@/components/AssessmentPickerModal'`. (If you put `Candidate` somewhere else, adjust the import.)

- Update the response parsing in `handleFileUpload`:

```typescript
const data = await res.json() as { extractedText?: string; candidates?: Candidate[] }
const candidates = data.candidates ?? []
const fallback = data.extractedText ?? ''

if (candidates.length === 0) {
  // Slot-specific: brief is a soft fallback (use raw text); rubric/exemplar is hard error.
  if (type === 'brief' && fallback) {
    finishUpload(type, file.name, fallback)
  } else {
    setUploadError(`Could not find a ${type} in that document. Try uploading a different file.`)
  }
  return
}

if (candidates.length === 1) {
  finishUpload(type, file.name, candidates[0].content)
  return
}

// Multi-candidate: store filename in a ref and let the picker complete the upload
pendingFilename.current[type] = file.name
setPickerState({ type, candidates })
```

You'll need a small ref to remember the filename across the picker await:

```typescript
const pendingFilename = useRef<Record<DocumentType, string>>({ brief: '', rubric: '', exemplar: '' })
```

Add a small helper inside the component:

```typescript
function finishUpload(type: DocumentType, filename: string, content: string) {
  const next = documents.filter(d => d.type !== type)
  next.push({ type, filename, extractedText: content })
  onChange(next)
}
```

- Render the picker conditionally at the bottom of the JSX (above the existing `{uploadError && ...}` line):

```tsx
{pickerState && (
  <AssessmentPickerModal
    candidates={pickerState.candidates}
    title={
      pickerState.type === 'brief' ? 'Pick which assessment this is' :
      pickerState.type === 'rubric' ? 'Pick which rubric to use' :
      'Pick which exemplar to use'
    }
    onSelect={c => {
      finishUpload(pickerState.type, pendingFilename.current[pickerState.type], c.content)
      setPickerState(null)
    }}
    onClose={() => setPickerState(null)}
  />
)}
```

- [ ] **Step 4: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Smoke-test by reading code paths**

Walk through these mental cases - confirm the logic handles each:
1. User uploads a single-assessment brief PDF to brief slot → API returns 1 candidate → applies directly.
2. User uploads a unit outline PDF with 3 assessments to brief slot → API returns 3 candidates → picker opens → user picks one → applied.
3. User uploads a rubric DOCX to rubric slot → API returns 1 candidate (the rubric content) → applies directly.
4. User uploads a brief PDF that contains an embedded rubric to rubric slot → API extracts the rubric portion → 1 candidate → applies directly.
5. User uploads a non-rubric document to rubric slot → API returns 0 candidates → uploadError is shown.
6. User opens the picker, then closes it without selecting → `pendingFilename.current[type]` retains its value but no document is set. Acceptable since it'll be overwritten on the next upload to the same slot.

- [ ] **Step 6: Commit**

```bash
git add components/TypedDocumentSlots.tsx components/AssessmentPickerModal.tsx
git commit -m "$(cat <<'EOF'
feat(ui): reinstate multi-candidate picker for typed document slots

When the extract API returns multiple candidates (e.g. a unit outline
with three assessment briefs uploaded to the brief slot), open the
picker so the user can choose which one belongs to this assessment.
The picker is generic across all three slot types with slot-specific
titles. Zero candidates produces a soft fallback for briefs and an
explicit error for rubrics and exemplars.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 - Recommendations polish

### Task 3: Suggestion type + API prompt + parser

**Files:**
- Modify: `lib/types.ts`
- Modify: `app/api/suggestions/route.ts`

- [ ] **Step 1: Add the Suggestion type**

In `lib/types.ts`, replace the existing `Suggestions` interface:

```typescript
export interface Suggestion {
  text: string         // The suggestion itself, written as an actionable statement.
  why: string          // One short sentence on why this would help.
  udlCodes: string[]   // Related UDL 3.0 consideration codes, e.g. ['8.3', '7.3'].
}

export interface Suggestions {
  quickWins: Suggestion[]
  longerTerm: Suggestion[]
}
```

- [ ] **Step 2: Update the AI prompt in the suggestions route**

In `app/api/suggestions/route.ts`, find the prompt template. Replace the existing JSON-shape spec block with this updated version:

```text
Return JSON in EXACTLY this structure (no extra fields, no prose around the JSON):

{
  "quickWins": [
    { "text": "...", "why": "...", "udlCodes": ["..."] }
  ],
  "longerTerm": [
    { "text": "...", "why": "...", "udlCodes": ["..."] }
  ]
}

Field guidance:
- "text": Write each suggestion as a concrete, actionable statement (under 30 words). Reference the assessment name when it helps clarity.
- "why": One short sentence (under 25 words) explaining what improves for students and why it advances UDL alignment.
- "udlCodes": List the UDL 3.0 consideration codes this suggestion addresses, e.g. ["8.3"] or ["7.3", "9.1"]. Use only codes you can justify from the suggestion content.

QUICK WINS: 2-4 specific, immediately actionable suggestions the unit coordinator could make before the next study period - concrete edits to briefs, rubrics, or policies.
LONGER TERM: 2-3 deeper structural suggestions that would require more planning or curriculum redesign. Frame as aspirational next steps.
```

- [ ] **Step 3: Update the JSON parser**

The existing `JSON.parse(jsonText) as Suggestions` already typechecks against the new shape because we updated the type. Confirm the runtime shape too: defensively narrow each entry. Add a small validator helper near the top of the file:

```typescript
function isSuggestion(s: unknown): s is Suggestion {
  if (!s || typeof s !== 'object') return false
  const obj = s as Record<string, unknown>
  return typeof obj.text === 'string'
    && typeof obj.why === 'string'
    && Array.isArray(obj.udlCodes)
    && obj.udlCodes.every(c => typeof c === 'string')
}

function sanitizeSuggestions(parsed: unknown): Suggestions {
  if (!parsed || typeof parsed !== 'object') return { quickWins: [], longerTerm: [] }
  const obj = parsed as Record<string, unknown>
  const quickWins = Array.isArray(obj.quickWins) ? obj.quickWins.filter(isSuggestion) : []
  const longerTerm = Array.isArray(obj.longerTerm) ? obj.longerTerm.filter(isSuggestion) : []
  return { quickWins, longerTerm }
}
```

Replace the previous `const suggestions = JSON.parse(jsonText) as Suggestions` with `const suggestions = sanitizeSuggestions(JSON.parse(jsonText))`.

- [ ] **Step 4: Update the fallback in the catch block**

Find the existing fallback `Suggestions` returned when AI fails. Update to use the new shape:

```typescript
return NextResponse.json({
  quickWins: [
    { text: 'Add a plain-English summary of what the assessment requires at the top of the brief.', why: 'Reduces cognitive load and supports students new to academic English.', udlCodes: ['2.1', '1.2'] },
    { text: 'Document your approach to assessment delivery for your teaching portfolio.', why: 'Captures the UDL-aligned practices you already use as evidence for review.', udlCodes: [] },
  ],
  longerTerm: [
    { text: 'Audit your unit\'s assessments together to see how they balance the three UDL principles across the semester.', why: 'UDL is read across the whole unit; gaps in one assessment can be addressed by another.', udlCodes: [] },
  ],
} satisfies Suggestions)
```

- [ ] **Step 5: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: errors in `components/SuggestionsList.tsx` and `components/PdfReport.tsx` (they still iterate `Suggestions` as `string[]`). Tasks 4 and 5 fix those. No need to commit yet.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts app/api/suggestions/route.ts
git commit -m "$(cat <<'EOF'
feat(suggestions): structured Suggestion shape with text/why/udlCodes

Replaces string[] with Suggestion[] across the API. Each suggestion now
carries a one-line "why this helps" and a list of related UDL 3.0
consideration codes. Adds a runtime sanitiser so a malformed AI
response degrades to an empty list rather than throwing.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

The downstream renderers will be broken at this point; Tasks 4 and 5 fix them. The build will not be runnable end-to-end until both land.

---

### Task 4: SuggestionsList renders the new shape

**Files:**
- Modify: `components/SuggestionsList.tsx`

- [ ] **Step 1: Replace the component implementation**

Replace the entire content of `components/SuggestionsList.tsx` with:

```typescript
import type { Suggestions, Suggestion } from '@/lib/types'

interface Props {
  suggestions: Suggestions
}

const CAST_URL = 'https://udlguidelines.cast.org/'

export function SuggestionsList({ suggestions }: Props) {
  return (
    <div className="space-y-6">
      <Section
        title="Quick wins"
        items={suggestions.quickWins}
        badge="terracotta"
      />
      {suggestions.longerTerm.length > 0 && (
        <Section
          title="Longer-term improvements"
          items={suggestions.longerTerm}
          badge="teal"
        />
      )}
      <p className="text-xs text-teal/50">
        Codes refer to UDL Guidelines 3.0 considerations.{' '}
        <a
          href={CAST_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-teal"
        >
          Read more on UDL Guidelines 3.0 (CAST) →
        </a>
      </p>
    </div>
  )
}

function Section({ title, items, badge }: { title: string; items: Suggestion[]; badge: 'terracotta' | 'teal' }) {
  if (items.length === 0) return null
  const badgeColor = badge === 'terracotta' ? 'bg-terracotta' : 'bg-teal'
  return (
    <div>
      <h3 className="font-display text-xl text-teal mb-3">{title}</h3>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3 bg-white rounded-xl border border-sand p-4">
            <span className={`shrink-0 w-6 h-6 rounded-full ${badgeColor} text-white text-xs flex items-center justify-center font-bold`}>
              {i + 1}
            </span>
            <div className="flex-1 space-y-2">
              <p className="text-sm text-teal leading-relaxed">{item.text}</p>
              {item.why && (
                <p className="text-xs text-teal/60 leading-relaxed">
                  <span className="font-medium text-teal/70">Why: </span>{item.why}
                </p>
              )}
              {item.udlCodes.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {item.udlCodes.map(code => (
                    <span
                      key={code}
                      className="text-[10px] font-medium bg-teal/10 text-teal rounded px-1.5 py-0.5"
                    >
                      UDL {code}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: still one error in `components/PdfReport.tsx` (Task 5 fixes it).

- [ ] **Step 3: Commit**

```bash
git add components/SuggestionsList.tsx
git commit -m "$(cat <<'EOF'
feat(ui): suggestions render with why-line, UDL chips, CAST link

Each suggestion now shows the actionable text, a "Why" rationale line,
and small chips for the related UDL 3.0 consideration codes. Section
ends with a single link out to the CAST guidelines page.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: PdfReport renders the new shape

**Files:**
- Modify: `components/PdfReport.tsx`

- [ ] **Step 1: Inspect the current PDF suggestion rendering**

Read `components/PdfReport.tsx`. Find the `{/* Suggestions */}` comment block. The current code likely iterates `suggestions.quickWins` and `suggestions.longerTerm` as `string[]`. Replace each iteration so it renders the structured shape.

- [ ] **Step 2: Replace the suggestions block**

Find the existing block that renders quick wins and longer-term lists. Replace with:

```tsx
{suggestions && (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>Quick wins</Text>
    {suggestions.quickWins.map((s, i) => (
      <View key={i} style={styles.suggestionItem}>
        <Text style={styles.bullet}>{i + 1}.</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.suggestionText}>{s.text}</Text>
          {s.why && (
            <Text style={{ fontSize: 9, color: '#5A7589', marginTop: 2, lineHeight: 1.4 }}>
              Why: {s.why}
            </Text>
          )}
          {s.udlCodes.length > 0 && (
            <Text style={{ fontSize: 8, color: '#1B3A4B', marginTop: 2 }}>
              UDL {s.udlCodes.join(', ')}
            </Text>
          )}
        </View>
      </View>
    ))}

    {suggestions.longerTerm.length > 0 && (
      <>
        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Longer-term improvements</Text>
        {suggestions.longerTerm.map((s, i) => (
          <View key={i} style={styles.suggestionItem}>
            <Text style={styles.bullet}>{i + 1}.</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.suggestionText}>{s.text}</Text>
              {s.why && (
                <Text style={{ fontSize: 9, color: '#5A7589', marginTop: 2, lineHeight: 1.4 }}>
                  Why: {s.why}
                </Text>
              )}
              {s.udlCodes.length > 0 && (
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
```

If the original code was structured differently (e.g. the section heading was outside the conditional), preserve the original structural flow but swap each per-item render to the new pattern.

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: clean (zero errors).

- [ ] **Step 4: Smoke-test the PDF render path mentally**

The PDF doesn't render at typecheck time. After commit, the controller will run `npm run build` to confirm the dynamic-imported component still bundles. (Subagent: don't run dev server; controller will smoke-test visually.)

- [ ] **Step 5: Commit**

```bash
git add components/PdfReport.tsx
git commit -m "$(cat <<'EOF'
feat(pdf): render structured suggestions with why-line and UDL codes

Mirrors the web rendering: each suggestion shows actionable text,
a "Why" rationale, and a comma-separated list of UDL 3.0 codes.
Adds a footer line linking to the CAST source.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 - Cleanup

### Task 6: Delete the "All Checkpoints" view from results

**Files:**
- Modify: `app/results/page.tsx`

- [ ] **Step 1: Locate the section**

Read `app/results/page.tsx`. Find:

```tsx
{/* Checkpoint table */}
<div>
  <h2 className="font-display text-2xl text-teal mb-4">All Checkpoints</h2>
  <CheckpointTable checkpoints={checkpoints} assessments={assessments} />
</div>
```

- [ ] **Step 2: Remove the block**

Delete those lines entirely. If the `CheckpointTable` import is now unused, remove it too. Confirm `components/CheckpointTable.tsx` is still referenced elsewhere - it must remain because `components/PdfReport.tsx` (or another consumer) uses it. Run:

```bash
grep -rn "CheckpointTable" --include="*.ts" --include="*.tsx" -l . | grep -v node_modules
```

If only the PDF still consumes it, leave the file alone.

- [ ] **Step 3: Verify typecheck and build**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add app/results/page.tsx
git commit -m "$(cat <<'EOF'
refactor(results): remove the All Checkpoints view from the results page

Luke's feedback: this panel duplicated the per-checkpoint review the
user just completed and added little value at the unit level. The same
table remains in the downloadable PDF for record-keeping.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Final Verification

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: builds clean. PDF dynamic-import resolves. No new warnings.

- [ ] **Step 3: End-to-end smoke walk in dev server**

Run `npm run dev`. Walk:

1. Add an Interactive Oral assessment.
2. Upload a single-assessment brief PDF to the Brief slot. Confirm the brief slot shows the filename and no picker appears.
3. Upload a multi-assessment unit-outline PDF/DOCX to the same Brief slot (replacing the previous brief). Confirm the picker opens with the right title ("Pick which assessment this is") and shows multiple candidates with title + truncated content. Pick one. Confirm it's applied.
4. Upload a brief that contains an embedded rubric to the Rubric slot. Confirm the slot fills with the rubric content extracted (not the whole brief).
5. Upload a TXT file that has no rubric content to the Rubric slot. Confirm the error "Could not find a rubric in that document" is shown.
6. Add a Field Journal assessment. Run prefill. Move to results.
7. Confirm the results page no longer shows the "All Checkpoints" section.
8. Confirm the suggestions section shows: numbered items, a "Why:" line under each, UDL code chips, and a single "Read more on UDL Guidelines 3.0 (CAST) →" link below.
9. Download the PDF. Confirm: it still contains the full checkpoint table; suggestions render with Why and UDL codes.

---

## Open questions for Luke (capture before next round)

1. **Rubric / exemplar question wording.** None of the 6 curated checkpoints currently has a rubric- or exemplar-specific question, but if Luke wants to write checkpoint subsets per document type (deferred Pass 4 work), the questionnaire framework supports it.
2. **Curated external links.** Pass 3 ships with a single "Read more on UDL Guidelines 3.0" link to the CAST root page. If Luke has Curtin-specific resources (Teaching Support pages, Indigenous Knowledge resources, GenAI guidelines) he wants to surface from the suggestions, that's a Pass 4 task.
3. **Rubric / exemplar multi-pick.** This plan supports the picker for all three slot types. Worth confirming with Luke that's the right UX once it's live - some academics may upload a unit outline that has rubrics for multiple assessments.

---

## Self-review notes

- **Spec coverage:** Slot-aware extraction (Tasks 1-2), recommendations polish (Tasks 3-5), All Checkpoints cleanup (Task 6). Doc-type-specific subsets remain deferred and are surfaced in open questions.
- **Type consistency:** `Candidate` (used in API + Modal + Slots), `Suggestion` and `Suggestions` (used in API + SuggestionsList + PdfReport + types), `documentType` (already established in Pass 2). All references are consistent.
- **No placeholders:** Every code block is concrete; verbatim prompts and types are provided.
- **File paths:** Each task lists the exact file or files it touches.
- **Trade-offs flagged:** PDF empty-extractedText asymmetry (still in place from Pass 2; not regressed by this plan). External links use a single root URL because UDL 3.0 doesn't expose stable per-consideration URLs.
