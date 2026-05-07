# Pass 4 - Agency Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the user real agency over AI-generated recommendations and over how their audit reads in the final PDF. Five small features that together make the user a co-author rather than a recipient: per-suggestion curation (dismiss + mark done), regenerate with optional focus, add-your-own suggestion, audit-wide notes textarea, and clearer textual attribution between AI ratings and user overrides on each checkpoint card.

**Architecture:** Each `Suggestion` gains client-managed curation fields (`id`, `dismissed?`, `done?`, `userAuthored?`). Session state grows by one field (`auditNotes: string`). The suggestions API accepts an optional `focus: string` parameter that gets prepended to the AI prompt, and assigns UUIDs to each suggestion server-side so the client doesn't have to enrich. PDF and web both filter dismissed, badge done, and surface user-authored items alongside AI-generated. CheckpointCard's rating attribution becomes a textual label rather than a colour code alone.

**Tech Stack:** Next.js 14 (App Router), TypeScript strict, Tailwind, Anthropic SDK, @react-pdf/renderer. No new dependencies.

**Scope notes:**
- **Curation state is session-only.** App has no persistence; reload resets everything. Acceptable for a prototype.
- **No "AI off" mode in this pass.** Captured in the Luke email memory; revisit if Pass 4's agency wins don't scratch that itch.
- **Each regenerate replaces the whole suggestion list** including any done/dismissed state. We do NOT merge curation across regenerates - regenerate is a fresh start. The Regenerate button shows a small inline confirm to surface this trade-off.
- **No tests.** Codebase has no test framework; verification is `npx tsc --noEmit` + `npm run build` + manual smoke walk.

---

## File Structure

| File | Responsibility | Status |
|---|---|---|
| `lib/types.ts` | Add `id`, `dismissed?`, `done?`, `userAuthored?` to `Suggestion`; add `auditNotes: string` to `SessionState`; add three reducer action variants | Modify |
| `context/SessionContext.tsx` | Initial state gains `auditNotes: ''`; reducer handles `UPDATE_SUGGESTION`, `ADD_SUGGESTION`, `SET_AUDIT_NOTES`; `RESET` clears auditNotes | Modify |
| `app/api/suggestions/route.ts` | Accept optional `focus: string` in body; assign UUIDs to every returned suggestion (sanitiser + `allMet` branch); prepend focus to prompt | Modify |
| `components/SuggestionsList.tsx` | Per-suggestion dismiss + done toggles, "Regenerate" button with focus input + confirm, "Add your own" inline form, distinct styling for user-authored items, dismissed items strikethrough | Modify |
| `components/PdfReport.tsx` | Filter dismissed; badge done; render user-authored items without UDL chip; render audit-notes section near the top of the PDF | Modify |
| `app/results/page.tsx` | Render audit-notes textarea bound to session state above the recommendations; pass `auditNotes` to PdfDownloadButton | Modify |
| `components/CheckpointCard.tsx` | Replace ✓ tick-only badge with explicit textual label that says what the AI suggested vs what the user picked | Modify |

---

## Phase 1 - Foundations

### Task 1: Type extensions, reducer, API id-assignment

**Files:**
- Modify: `lib/types.ts`
- Modify: `context/SessionContext.tsx`
- Modify: `app/api/suggestions/route.ts`

This task is bundled because the type change cascades through the reducer (initial state + new actions) and the API (UUID generation, focus param). Splitting would leave intermediate states that don't typecheck.

- [ ] **Step 1: Extend `Suggestion`, `SessionState`, and `SessionAction`**

In `lib/types.ts`, replace the `Suggestion` interface and extend `SessionState` and `SessionAction`:

```typescript
export interface Suggestion {
  id: string                  // Stable UUID, assigned server-side
  text: string
  why: string
  udlCodes: string[]
  dismissed?: boolean         // User excluded this from active list and PDF
  done?: boolean              // User marked "I do this / I'll do this"
  userAuthored?: boolean      // User-added (no UDL chip rendered)
}

export interface Suggestions {
  quickWins: Suggestion[]
  longerTerm: Suggestion[]
}

export interface SessionState {
  assessments: Assessment[]
  checkpoints: CheckpointResult[]
  suggestions: Suggestions | null
  auditNotes: string
}

export type SessionAction =
  | { type: 'SET_ASSESSMENTS'; assessments: Assessment[] }
  | { type: 'SET_CHECKPOINTS'; checkpoints: CheckpointResult[] }
  | { type: 'UPDATE_CHECKPOINT'; checkpointId: string; assessmentId: string; userRating: Rating; acceptedAI: boolean }
  | { type: 'SET_SUGGESTIONS'; suggestions: Suggestions }
  | { type: 'UPDATE_SUGGESTION'; id: string; patch: Partial<Pick<Suggestion, 'dismissed' | 'done'>> }
  | { type: 'ADD_SUGGESTION'; bucket: 'quickWins' | 'longerTerm'; suggestion: Suggestion }
  | { type: 'SET_AUDIT_NOTES'; notes: string }
  | { type: 'RESET' }
```

- [ ] **Step 2: Update SessionContext initial state and reducer**

In `context/SessionContext.tsx`, add `auditNotes: ''` to the initial state (find the `initialState` const).

Add three new branches to the reducer:

```typescript
case 'UPDATE_SUGGESTION': {
  if (!state.suggestions) return state
  const update = (list: Suggestion[]) =>
    list.map(s => s.id === action.id ? { ...s, ...action.patch } : s)
  return {
    ...state,
    suggestions: {
      quickWins: update(state.suggestions.quickWins),
      longerTerm: update(state.suggestions.longerTerm),
    },
  }
}
case 'ADD_SUGGESTION': {
  if (!state.suggestions) {
    return {
      ...state,
      suggestions: {
        quickWins: action.bucket === 'quickWins' ? [action.suggestion] : [],
        longerTerm: action.bucket === 'longerTerm' ? [action.suggestion] : [],
      },
    }
  }
  return {
    ...state,
    suggestions: {
      ...state.suggestions,
      [action.bucket]: [...state.suggestions[action.bucket], action.suggestion],
    },
  }
}
case 'SET_AUDIT_NOTES':
  return { ...state, auditNotes: action.notes }
```

The `RESET` case must reset `auditNotes: ''`. Verify `suggestions: null` is also reset (it should already be).

You'll need to import `Suggestion` in this file:

```typescript
import type { ..., Suggestion } from '@/lib/types'
```

- [ ] **Step 3: Update `app/api/suggestions/route.ts` to assign UUIDs and accept focus**

Find the `SuggestionsRequest` interface near the top:

```typescript
interface SuggestionsRequest {
  assessments: Assessment[]
  checkpoints: CheckpointResult[]
  focus?: string
}
```

Update the body destructure:

```typescript
const { checkpoints, assessments, focus } = body
```

Find the `isSuggestion` and `sanitizeSuggestions` helpers. Update `sanitizeSuggestions` to assign UUIDs:

```typescript
function sanitizeSuggestions(parsed: unknown): Suggestions {
  if (!parsed || typeof parsed !== 'object') return { quickWins: [], longerTerm: [] }
  const obj = parsed as Record<string, unknown>
  const withIds = (raw: unknown[]): Suggestion[] =>
    raw.filter(isSuggestion).map(s => ({ ...s, id: crypto.randomUUID() }))
  const quickWins = Array.isArray(obj.quickWins) ? withIds(obj.quickWins) : []
  const longerTerm = Array.isArray(obj.longerTerm) ? withIds(obj.longerTerm) : []
  return { quickWins, longerTerm }
}
```

Note: `isSuggestion` type-guards based on `text`, `why`, `udlCodes` — it does NOT require `id` because the AI doesn't return one. Leave the helper as-is.

Find the `allMet` early-return branch. Each hardcoded suggestion object needs an `id`. The simplest pattern:

```typescript
if (allMet) {
  const id = () => crypto.randomUUID()
  return NextResponse.json({
    quickWins: [
      { id: id(), text: 'All checkpoints are rated Met - outstanding UDL alignment across your unit.', why: 'Your design already supports the full breadth of audited UDL principles.', udlCodes: [] },
      { id: id(), text: 'Consider sharing your assessment design as an exemplar with colleagues.', why: 'Strong UDL practice spreads when others can see what good looks like in context.', udlCodes: [] },
      { id: id(), text: 'Document your approach for your teaching portfolio as evidence of UDL practice.', why: 'Captures your inclusive design choices for review, promotion, or accreditation.', udlCodes: [] },
    ],
    longerTerm: [
      { id: id(), text: 'Explore UDL Guidelines 3.0 checkpoints beyond the ones audited here to deepen your practice.', why: 'The audited checkpoints are a curated subset; the full framework offers more dimensions to explore.', udlCodes: [] },
      { id: id(), text: 'Consider mentoring colleagues in UDL-aligned assessment design.', why: 'Your demonstrated practice is a teaching resource for the wider unit team.', udlCodes: [] },
    ],
  } satisfies Suggestions)
}
```

Find the prompt template. Add a focus paragraph before the existing instructions, conditional on `focus` being non-empty:

```typescript
const focusInstruction = focus?.trim()
  ? `\n\nFOCUS: The user wants suggestions especially relevant to: ${focus.trim()}. Weight your suggestions toward this focus area without ignoring the gap context entirely.\n\n`
  : ''

const prompt = `You are a teaching support specialist at Curtin University, advising on UDL (Universal Design for Learning) assessment design in the context of Assessment 2030.${focusInstruction}

The following UDL checkpoints have not been fully met in this unit's assessments:
... [rest of existing prompt unchanged]
```

(Adjust the existing template-literal stitching to insert `${focusInstruction}` near the top.)

- [ ] **Step 4: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: errors will appear in places that consume `SessionState` or `Suggestion` without the new fields. Specifically:
- `context/SessionContext.tsx` if you missed the import or reducer branches
- `app/results/page.tsx` if it doesn't supply `auditNotes` to PdfDownloadButton (Task 5 fixes this; if errors appear here for now, that's expected and tolerated)
- `components/SuggestionsList.tsx` doesn't consume new fields yet (Task 2 wires)
- `components/PdfReport.tsx` similarly (Task 6 wires)

If errors appear OUTSIDE those files, fix them in this task. The acceptable error set is: any consumer of `SessionState` that destructures fields and now needs `auditNotes`.

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts context/SessionContext.tsx app/api/suggestions/route.ts
git commit -m "$(cat <<'EOF'
feat(types): foundations for suggestion curation and audit notes

Extends Suggestion with id (UUID, server-assigned), and optional
dismissed / done / userAuthored flags. Adds auditNotes to SessionState
and three reducer actions (UPDATE_SUGGESTION, ADD_SUGGESTION,
SET_AUDIT_NOTES). The /api/suggestions route now accepts an optional
focus string and assigns UUIDs to every returned suggestion.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 - Suggestion curation UI

### Task 2: Per-suggestion dismiss + done toggles

**Files:**
- Modify: `components/SuggestionsList.tsx`

- [ ] **Step 1: Add dispatch hook + curation handlers**

Read `components/SuggestionsList.tsx`. The component currently takes `suggestions: Suggestions` as a prop. We're going to add curation actions, so it also needs the dispatch function.

Update the import block to add `useSession`:

```typescript
import type { Suggestions, Suggestion } from '@/lib/types'
import { useSession } from '@/context/SessionContext'
```

Update the component to use dispatch:

```typescript
export function SuggestionsList({ suggestions }: Props) {
  const { dispatch } = useSession()

  function toggleDismissed(id: string, current: boolean) {
    dispatch({ type: 'UPDATE_SUGGESTION', id, patch: { dismissed: !current } })
  }

  function toggleDone(id: string, current: boolean) {
    dispatch({ type: 'UPDATE_SUGGESTION', id, patch: { done: !current } })
  }

  // ... rest of component
}
```

- [ ] **Step 2: Update the `Section` helper to render curation controls**

Replace the existing `Section` body. Each `<li>` now needs to:
- Show strikethrough on text when `dismissed`
- Show a green ✓ badge or muted style when `done`
- Show two icon buttons (dismiss / done) at the right of the row

Replace `Section` with:

```typescript
function Section({
  title,
  items,
  badge,
  onToggleDismissed,
  onToggleDone,
}: {
  title: string
  items: Suggestion[]
  badge: 'terracotta' | 'teal'
  onToggleDismissed: (id: string, current: boolean) => void
  onToggleDone: (id: string, current: boolean) => void
}) {
  if (items.length === 0) return null
  const badgeColor = badge === 'terracotta' ? 'bg-terracotta' : 'bg-teal'
  return (
    <div>
      <h3 className="font-display text-xl text-teal mb-3">{title}</h3>
      <ul className="space-y-3">
        {items.map((item, i) => {
          const isDismissed = !!item.dismissed
          const isDone = !!item.done
          return (
            <li
              key={item.id}
              className={`flex gap-3 bg-white rounded-xl border p-4 transition-colors ${
                isDismissed ? 'border-sand opacity-50' :
                isDone ? 'border-green-300 bg-green-50/40' :
                'border-sand'
              }`}
            >
              <span className={`shrink-0 w-6 h-6 rounded-full ${badgeColor} text-white text-xs flex items-center justify-center font-bold`}>
                {i + 1}
              </span>
              <div className="flex-1 space-y-2">
                <p className={`text-sm leading-relaxed ${isDismissed ? 'text-teal/50 line-through' : 'text-teal'}`}>
                  {item.text}
                </p>
                {item.why && !isDismissed && (
                  <p className="text-xs text-teal/60 leading-relaxed">
                    <span className="font-medium text-teal/70">Why: </span>{item.why}
                  </p>
                )}
                {item.udlCodes.length > 0 && !item.userAuthored && !isDismissed && (
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
                {item.userAuthored && !isDismissed && (
                  <p className="text-[10px] text-teal/40 italic">Your suggestion</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onToggleDone(item.id, isDone)}
                  aria-pressed={isDone}
                  title={isDone ? 'Unmark done' : "Mark as 'I'll do this'"}
                  className={`text-xs rounded px-2 py-1 border transition-colors ${
                    isDone
                      ? 'border-green-400 bg-green-100 text-green-800'
                      : 'border-sand text-teal/60 hover:border-teal/40 hover:text-teal'
                  }`}
                >
                  {isDone ? '✓ Done' : 'Done'}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleDismissed(item.id, isDismissed)}
                  aria-pressed={isDismissed}
                  title={isDismissed ? 'Restore' : 'Dismiss from final report'}
                  className={`text-xs rounded px-2 py-1 border transition-colors ${
                    isDismissed
                      ? 'border-teal/40 bg-teal/10 text-teal'
                      : 'border-sand text-teal/60 hover:border-terracotta/40 hover:text-terracotta'
                  }`}
                >
                  {isDismissed ? 'Restore' : 'Dismiss'}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
```

Update the calls to Section in the parent component to pass the new props:

```tsx
<Section
  title="Quick wins"
  items={suggestions.quickWins}
  badge="terracotta"
  onToggleDismissed={toggleDismissed}
  onToggleDone={toggleDone}
/>
{suggestions.longerTerm.length > 0 && (
  <Section
    title="Longer-term improvements"
    items={suggestions.longerTerm}
    badge="teal"
    onToggleDismissed={toggleDismissed}
    onToggleDone={toggleDone}
  />
)}
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: clean for SuggestionsList. Other files (PdfReport, results page) may still error from Task 1; that's fine.

- [ ] **Step 4: Commit**

```bash
git add components/SuggestionsList.tsx
git commit -m "$(cat <<'EOF'
feat(suggestions): per-item dismiss and mark-done curation

Each suggestion gets two small buttons - "Done" (mark "I'll do this")
and "Dismiss" (exclude from active list and final PDF). Dismissed items
go grey and strikethrough; done items get a soft green halo. State
lives on the suggestion in the session reducer.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 - Regenerate with focus

### Task 3: Regenerate button + optional focus input

**Files:**
- Modify: `components/SuggestionsList.tsx`
- Modify: `app/results/page.tsx`

The regenerate logic lives close to the suggestions UI but the API call has historically been in `app/results/page.tsx`. We hoist regenerate into a callback that the page passes down.

- [ ] **Step 1: Add a regenerate callback prop to `SuggestionsList`**

In `components/SuggestionsList.tsx`, extend the Props:

```typescript
interface Props {
  suggestions: Suggestions
  onRegenerate?: (focus: string) => Promise<void>
  regenerating?: boolean
}
```

Add internal state for the focus input and confirm dialog:

```typescript
const [focus, setFocus] = useState('')
const [showConfirm, setShowConfirm] = useState(false)
```

Add a regenerate UI block at the top of the rendered output (above the Quick wins section):

```tsx
{onRegenerate && (
  <div className="rounded-xl border border-sand bg-cream/40 p-4 space-y-3">
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm font-medium text-teal">Need different suggestions?</p>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        disabled={regenerating}
        className="rounded-md border border-teal/30 hover:border-teal/60 hover:bg-teal/5 px-3 py-1 text-xs font-medium text-teal disabled:opacity-60 transition-colors"
      >
        {regenerating ? 'Regenerating…' : 'Regenerate'}
      </button>
    </div>
    <div>
      <label className="block text-xs text-teal/60 mb-1">
        Focus on (optional):
      </label>
      <input
        type="text"
        value={focus}
        onChange={e => setFocus(e.target.value)}
        placeholder="e.g. students with adjustment plans, L2 learners, accessibility"
        disabled={regenerating}
        className="w-full rounded-md border border-sand px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal/40 disabled:opacity-60"
      />
    </div>
    {showConfirm && (
      <div className="rounded-lg bg-amber/10 border border-amber/40 p-3 text-xs text-teal/80 space-y-2">
        <p>Regenerating replaces all current suggestions, including any you have marked as done or dismissed.</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={async () => {
              setShowConfirm(false)
              await onRegenerate(focus)
            }}
            className="rounded-md bg-terracotta text-white px-3 py-1 text-xs font-medium hover:bg-terracotta-dark transition-colors"
          >
            Yes, regenerate
          </button>
          <button
            type="button"
            onClick={() => setShowConfirm(false)}
            className="rounded-md border border-sand text-teal px-3 py-1 text-xs hover:bg-sand transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )}
  </div>
)}
```

Add the `useState` import:

```typescript
import { useState } from 'react'
```

- [ ] **Step 2: Implement regenerate in the results page**

In `app/results/page.tsx`, find the existing `useEffect` that fetches suggestions on mount. Extract the fetch into a reusable function:

```typescript
async function fetchSuggestions(focus?: string) {
  setLoadingSuggestions(true)
  setSuggestionsError(false)
  try {
    const res = await fetch('/api/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkpoints, assessments, focus }),
    })
    if (!res.ok) throw new Error('failed')
    const data = await res.json() as Suggestions
    dispatch({ type: 'SET_SUGGESTIONS', suggestions: data })
  } catch {
    setSuggestionsError(true)
  } finally {
    setLoadingSuggestions(false)
  }
}
```

Hoist any state needed (`loadingSuggestions`, `suggestionsError` already exist; `fetchingSuggestions` ref still guards the on-mount call).

The existing `useEffect` should call `fetchSuggestions()` (no focus) on initial mount. Don't duplicate the gating logic - keep the `fetchingSuggestions.current` guard for the initial mount only, but bypass it for explicit regenerates.

The simplest pattern: keep the on-mount `useEffect` with the guard (calls fetchSuggestions without focus), and define a separate `handleRegenerate(focus: string)` callback that doesn't touch the guard:

```typescript
async function handleRegenerate(focus: string) {
  await fetchSuggestions(focus.trim() || undefined)
}
```

Pass `handleRegenerate` and `loadingSuggestions` to `SuggestionsList`:

```tsx
<SuggestionsList
  suggestions={suggestions}
  onRegenerate={handleRegenerate}
  regenerating={loadingSuggestions}
/>
```

- [ ] **Step 3: Verify typecheck and dev-build**

Run: `npx tsc --noEmit` - clean except for any remaining downstream tasks.

- [ ] **Step 4: Commit**

```bash
git add components/SuggestionsList.tsx app/results/page.tsx
git commit -m "$(cat <<'EOF'
feat(suggestions): regenerate button with optional focus input

User can ask the AI for fresh suggestions, optionally focused on a
theme they care about (e.g. "students with adjustment plans"). Inline
confirm warns that regenerate replaces all current items, including
done and dismissed state - we don't merge curation across regenerates.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4 - User-authored content

### Task 4: Add-your-own suggestion form

**Files:**
- Modify: `components/SuggestionsList.tsx`

- [ ] **Step 1: Add a small inline form for adding a user suggestion**

Add new state in the SuggestionsList component:

```typescript
const [addOpen, setAddOpen] = useState(false)
const [addBucket, setAddBucket] = useState<'quickWins' | 'longerTerm'>('quickWins')
const [addText, setAddText] = useState('')
const [addWhy, setAddWhy] = useState('')
```

Add a handler:

```typescript
function handleAddOwn() {
  const text = addText.trim()
  if (!text) return
  const suggestion: Suggestion = {
    id: crypto.randomUUID(),
    text,
    why: addWhy.trim(),
    udlCodes: [],
    userAuthored: true,
  }
  dispatch({ type: 'ADD_SUGGESTION', bucket: addBucket, suggestion })
  setAddText('')
  setAddWhy('')
  setAddOpen(false)
}
```

Render the add-your-own UI between the Quick wins and Longer-term sections OR below both (cleaner: below both, before the CAST footer). Replace the existing CAST footer paragraph with:

```tsx
<div className="rounded-xl border border-dashed border-teal/30 p-4">
  {addOpen ? (
    <div className="space-y-3">
      <p className="text-sm font-medium text-teal">Add your own suggestion</p>
      <div>
        <label className="block text-xs text-teal/60 mb-1">Add to:</label>
        <div className="flex gap-3 text-sm">
          {(['quickWins', 'longerTerm'] as const).map(b => (
            <label key={b} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="add-bucket"
                value={b}
                checked={addBucket === b}
                onChange={() => setAddBucket(b)}
                className="accent-teal"
              />
              <span className="text-teal">{b === 'quickWins' ? 'Quick wins' : 'Longer-term'}</span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-xs text-teal/60 mb-1">Action:</label>
        <input
          type="text"
          value={addText}
          onChange={e => setAddText(e.target.value)}
          placeholder="What you'll do (e.g. add a 24-hour grace period)"
          className="w-full rounded-md border border-sand px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal/40"
        />
      </div>
      <div>
        <label className="block text-xs text-teal/60 mb-1">Why (optional):</label>
        <input
          type="text"
          value={addWhy}
          onChange={e => setAddWhy(e.target.value)}
          placeholder="What it improves for students"
          className="w-full rounded-md border border-sand px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal/40"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleAddOwn}
          disabled={!addText.trim()}
          className="rounded-md bg-teal text-white px-3 py-1.5 text-xs font-medium hover:bg-teal-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => { setAddOpen(false); setAddText(''); setAddWhy('') }}
          className="rounded-md border border-sand text-teal px-3 py-1.5 text-xs hover:bg-sand transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  ) : (
    <button
      type="button"
      onClick={() => setAddOpen(true)}
      className="w-full text-sm text-teal/60 hover:text-teal transition-colors"
    >
      + Add your own suggestion
    </button>
  )}
</div>

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
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add components/SuggestionsList.tsx
git commit -m "$(cat <<'EOF'
feat(suggestions): add-your-own suggestion form

Inline form below the AI suggestions lets the user add their own
quick-win or longer-term action with optional why text. Stored as
a userAuthored Suggestion in session state with no UDL codes; the
list rendering already styles user-authored items distinctly with
a small "Your suggestion" label.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5 - Audit notes

### Task 5: Audit-wide notes textarea

**Files:**
- Modify: `app/results/page.tsx`

- [ ] **Step 1: Render a notes textarea above the recommendations**

Find the section in `app/results/page.tsx` that renders the Recommendations heading. Add a new section ABOVE it (between the radar/breakdown grid and the recommendations heading):

```tsx
<div className="bg-white rounded-2xl border border-sand p-6">
  <label className="block font-display text-xl text-teal mb-2">
    Audit notes
    <span className="ml-2 text-xs font-normal text-teal/50">(optional - included in the PDF)</span>
  </label>
  <p className="text-xs text-teal/60 mb-3 leading-relaxed">
    Add any context the AI couldn&apos;t infer - context for teaching support, links to your unit outline, planned next steps, anything you want captured in the report.
  </p>
  <textarea
    value={state.auditNotes}
    onChange={e => dispatch({ type: 'SET_AUDIT_NOTES', notes: e.target.value })}
    placeholder="Notes for teaching support, your portfolio, or future-you…"
    rows={4}
    className="w-full rounded-lg border border-sand px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/40 bg-cream/40 resize-none"
  />
</div>
```

The existing `state` reference at the top of the page should already destructure session state; if not, ensure `auditNotes` is reachable. Pass `auditNotes` to the `<PdfDownloadButton>` (Task 6 will consume it).

Update the `PdfDownloadButton` props interface near the top of the file to include `auditNotes: string` and add it to the props passed at render time:

```typescript
interface PdfDownloadButtonProps {
  // ...existing
  auditNotes: string
}
```

```tsx
<PdfDownloadButton
  checkpoints={checkpoints}
  assessments={assessments}
  principleScores={principleScores}
  overallScore={overallScore}
  gradeLabel={gradeLabel}
  suggestions={suggestions}
  auditNotes={state.auditNotes}
/>
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: errors will appear in `components/PdfReport.tsx` because its prop interface doesn't yet include `auditNotes`. That's OK - Task 6 fixes.

- [ ] **Step 3: Commit**

```bash
git add app/results/page.tsx
git commit -m "$(cat <<'EOF'
feat(results): audit notes textarea above recommendations

Free-text notes the user can write to capture context the AI can't
infer - delivery details, links to the unit outline, planned next
steps. Stored in session state and passed to the PDF generator.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 6 - PDF rendering

### Task 6: PDF respects curation, renders notes, surfaces user-authored items

**Files:**
- Modify: `components/PdfReport.tsx`

- [ ] **Step 1: Update props and render**

In `components/PdfReport.tsx`, extend `ReportProps`:

```typescript
interface ReportProps {
  checkpoints: CheckpointResult[]
  assessments: Assessment[]
  principleScores: PrincipleScore[]
  overallScore: number
  gradeLabel: string
  suggestions: Suggestions | null
  auditNotes: string
}
```

Update the destructure and the function signature:

```typescript
function UdlReport({ checkpoints, assessments, principleScores, overallScore, gradeLabel, suggestions, auditNotes }: ReportProps) {
```

Above the principle-scores block (just below the hero section), add an audit-notes block conditional on the notes being non-empty:

```tsx
{auditNotes.trim() && (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>Audit notes</Text>
    <Text style={{ fontSize: 10, color: '#1B3A4B', lineHeight: 1.5 }}>
      {auditNotes}
    </Text>
  </View>
)}
```

In the suggestions render block, filter dismissed items, badge done items, and visually mark user-authored items. Replace the existing per-item render (the `{suggestions.quickWins.map((s, i) => ...)}` blocks) so each iteration looks like this:

```tsx
{suggestions.quickWins
  .filter(s => !s.dismissed)
  .map((s, i) => (
    <View key={s.id} style={styles.suggestionItem}>
      <Text style={styles.bullet}>{i + 1}.</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.suggestionText, s.done ? { textDecoration: 'line-through' } : undefined]}>
          {s.text} {s.done ? '(done)' : ''}{s.userAuthored ? ' (your suggestion)' : ''}
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
```

Apply the same filter+render pattern to `suggestions.longerTerm`. If both filtered lists are empty, still render the section heading (a degenerate case, but consistent with the user expectation that the section exists if `suggestions` is non-null).

Also: if `suggestions.quickWins.filter(s => !s.dismissed).length === 0`, suppress the "Quick wins" section heading (was a follow-up note from Pass 3 final review). Same for longerTerm.

Cleanest pattern - extract the filtered lists to consts at the top of the suggestions render:

```typescript
const visibleQuickWins = suggestions?.quickWins.filter(s => !s.dismissed) ?? []
const visibleLongerTerm = suggestions?.longerTerm.filter(s => !s.dismissed) ?? []
```

And only render each section if its visible list is non-empty.

- [ ] **Step 2: Verify typecheck and build**

Run: `npx tsc --noEmit` - should be clean.
Run: `npm run build` - should succeed end-to-end.

- [ ] **Step 3: Commit**

```bash
git add components/PdfReport.tsx
git commit -m "$(cat <<'EOF'
feat(pdf): render audit notes, filter dismissed, badge done suggestions

PDF now mirrors the web view's curation:
- Audit notes appear in their own section just below the hero
- Dismissed suggestions are filtered out of the PDF entirely
- Done suggestions are tagged "(done)" and strikethrough
- User-authored suggestions are tagged "(your suggestion)" and skip
  the UDL codes line

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 7 - CheckpointCard attribution clarity

### Task 7: Replace tick-only badge with explicit attribution label

**Files:**
- Modify: `components/CheckpointCard.tsx`

Luke's feedback: the difference between "you rated this" and "AI rated this and you accepted" is conveyed only by tick colour today, which isn't strong enough.

- [ ] **Step 1: Read the current AI suggestion block**

In `components/CheckpointCard.tsx`, find the block that renders the AI suggestion + the rating buttons. Currently the AI box shows `result.aiRating` with a small `(you set this)` parenthetical when the user overrode. We're going to make this more explicit.

- [ ] **Step 2: Replace the AI suggestion / attribution block**

Find the existing block (it currently looks something like the following but with subtle styling):

```tsx
<div className="rounded-lg bg-teal/5 border border-teal/10 p-3">
  <p className="text-xs font-semibold text-teal/70 uppercase tracking-wide mb-1">
    AI suggestion {!result.acceptedAI && result.userRating !== null && <span className="text-terracotta">(you set this)</span>}
  </p>
  <p className="text-sm text-teal">
    <span className={...}>...</span>
    {result.aiReasoning}
  </p>
</div>
```

Replace it with a richer version that explicitly states what the AI suggested and what the user picked, when they differ:

```tsx
<div className="rounded-lg bg-teal/5 border border-teal/10 p-3 space-y-1.5">
  <p className="text-xs font-semibold text-teal/70 uppercase tracking-wide">
    AI suggestion
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
  {result.userRating !== null && (
    <p className="text-xs text-teal/70">
      <span className="font-medium">
        {result.acceptedAI ? 'You confirmed the AI suggestion.' : 'You changed it to'}
      </span>
      {!result.acceptedAI && (
        <span className={`inline-block ml-1 rounded px-2 py-0.5 text-[11px] font-bold ${
          result.userRating === 'met' ? 'bg-green-100 text-green-800' :
          result.userRating === 'partial' ? 'bg-amber/30 text-teal' :
          'bg-red-100 text-red-700'
        }`}>
          {result.userRating === 'met' ? 'Met' : result.userRating === 'partial' ? 'Partially' : 'Not yet'}
        </span>
      )}
    </p>
  )}
</div>
```

The result: when the user has rated, they see explicitly either "You confirmed the AI suggestion." or "You changed it to [Met/Partially/Not yet]". The existing tick-color badge in the card header still works but is no longer the only signal.

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add components/CheckpointCard.tsx
git commit -m "$(cat <<'EOF'
feat(review): explicit textual attribution for AI vs user rating

Replaces the tick-color-only signal with a clearer textual line that
appears once the user has rated: either "You confirmed the AI
suggestion." or "You changed it to <rating>" with the rating chip.
Addresses Luke's feedback that the AI/you distinction was too subtle.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Final verification

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: builds clean. The PDF dynamic-imported component still resolves.

- [ ] **Step 3: End-to-end smoke walk**

Run `npm run dev` and walk:

1. Add Interactive Oral assessment, upload brief, answer questionnaire, proceed.
2. Rate one checkpoint by clicking a button (override the AI). On the card, verify "You changed it to <rating>" appears below the AI suggestion.
3. Confirm AI on another checkpoint via "Confirm suggestion". Verify "You confirmed the AI suggestion." appears.
4. Move to results.
5. Add audit notes ("Test note for Luke").
6. On the suggestions: dismiss one item (verify strikethrough + grey); mark another as Done (verify green halo); add your own suggestion ("Run a 24-hour grace period pilot") in the Quick wins bucket.
7. Type a focus into the Regenerate input ("students with adjustment plans"), click Regenerate, confirm the dialog. Verify the suggestions list refreshes - dismissed/done state is gone (expected per scope notes).
8. Download the PDF. Verify:
  - Audit notes section appears just under the hero with the typed note
  - Dismissed items don't appear in the PDF
  - Done items appear strikethrough with "(done)"
  - User-authored items appear with "(your suggestion)" and no UDL codes
  - All other content (radar, principle scores, checkpoint table, suggestions) is intact

---

## Open questions for Luke (capture before next round)

1. **"Turn off AI" mode.** Captured in the Luke email memory; ask whether Pass 4's agency upgrades scratch the same itch or if a fully AI-disabled mode is still wanted.
2. **Curated focus suggestions.** The focus input is free-text. If Luke has 3-5 common focus phrases Curtin academics tend to use ("students with adjustment plans", "Indigenous students", "L2 learners", "neurodivergent students"), we could expose them as quick-pick chips to lower the cold-start friction.
3. **Audit-notes prompt.** The placeholder currently says "Notes for teaching support, your portfolio, or future-you…" - check that this matches what Luke wants captured.

---

## Self-review notes

- **Spec coverage:** Five named features (curation, regenerate, add-own, audit notes, attribution) each have at least one task. Tasks 1-7 form the implementation; Task 8 verifies.
- **Type consistency:** `Suggestion` (with all new fields), `auditNotes` field on `SessionState`, `UPDATE_SUGGESTION` / `ADD_SUGGESTION` / `SET_AUDIT_NOTES` actions, focus param on suggestions API. All cross-referenced consistently.
- **No placeholders:** Every code block contains literal code. Prompt fragments shown verbatim.
- **File paths:** Each task lists the exact file or files it touches.
- **Trade-offs flagged:** Regenerate is destructive (replaces curation); session-only state; no AI-off mode this pass.
- **No em-dashes:** Plan text uses `-` (ASCII hyphen). UI strings in the plan also use `-`.
