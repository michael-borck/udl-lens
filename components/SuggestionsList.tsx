import { useState } from 'react'
import type { Suggestions, Suggestion } from '@/lib/types'
import { useSession } from '@/context/SessionContext'

interface Props {
  suggestions: Suggestions
  onRegenerate?: (focus: string) => Promise<void>
  regenerating?: boolean
}

const CAST_URL = 'https://udlguidelines.cast.org/'

export function SuggestionsList({ suggestions, onRegenerate, regenerating }: Props) {
  const { dispatch } = useSession()
  const [focus, setFocus] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [addBucket, setAddBucket] = useState<'quickWins' | 'longerTerm'>('quickWins')
  const [addText, setAddText] = useState('')
  const [addWhy, setAddWhy] = useState('')
  const [justAdded, setJustAdded] = useState<string | null>(null)

  function toggleDismissed(id: string, current: boolean) {
    dispatch({ type: 'UPDATE_SUGGESTION', id, patch: { dismissed: !current } })
  }

  function toggleDone(id: string, current: boolean) {
    dispatch({ type: 'UPDATE_SUGGESTION', id, patch: { done: !current } })
  }

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
    setJustAdded(addBucket === 'quickWins' ? 'Quick wins' : 'Longer-term improvements')
    setTimeout(() => setJustAdded(null), 4000)
  }

  return (
    <div className="space-y-6">
      {justAdded && (
        <div
          role="status"
          className="rounded-lg border border-terracotta/40 bg-terracotta/10 px-4 py-2 text-sm text-terracotta-dark flex items-center gap-2"
        >
          <span aria-hidden="true" className="font-bold">✓</span>
          <span>Your suggestion was added to <strong>{justAdded}</strong> below and is marked as yours. It will appear in the PDF.</span>
        </div>
      )}
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
      <div className="rounded-xl border border-dashed border-teal/30 p-4">
        {addOpen ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-teal">Add your own suggestion</p>
            <div>
              <label className="block text-xs text-teal/70 mb-1">Add to:</label>
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
              <label htmlFor="add-action" className="block text-xs text-teal/70 mb-1">Action:</label>
              <input
                id="add-action"
                type="text"
                value={addText}
                onChange={e => setAddText(e.target.value)}
                placeholder="What you'll do (e.g. add a 24-hour grace period)"
                className="w-full rounded-md border border-sand px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal/40"
              />
            </div>
            <div>
              <label htmlFor="add-why" className="block text-xs text-teal/70 mb-1">Why (optional):</label>
              <input
                id="add-why"
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
            className="w-full flex flex-col items-center gap-0.5 py-1 text-teal hover:text-terracotta-dark transition-colors"
          >
            <span className="text-sm font-medium">+ Add your own suggestion</span>
            <span className="text-xs text-teal/70">
              Your additions are kept through regenerate and included in the PDF
            </span>
          </button>
        )}
      </div>
      {onRegenerate && (
        <div className="rounded-xl border border-sand bg-cream/40 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-teal">Want a different set of AI suggestions?</p>
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              disabled={regenerating}
              className="rounded-md border border-teal/30 hover:border-teal/60 hover:bg-teal/5 px-3 py-1 text-xs font-medium text-teal disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {regenerating ? 'Regenerating…' : 'Regenerate AI suggestions'}
            </button>
          </div>
          <p className="text-xs text-teal/70 leading-relaxed">
            This asks the AI for a fresh set of recommendations based on your ratings. The AI
            suggestions above are replaced - anything you added yourself, and your audit notes,
            are kept. It does not change your scores. Do this <em>after</em> downloading if you
            want to keep the current set.
          </p>
          <div>
            <label htmlFor="regen-focus" className="block text-xs text-teal/70 mb-1">
              Prioritise a group or theme (optional):
            </label>
            <input
              id="regen-focus"
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
              <p>Regenerating replaces the AI suggestions (including any you&apos;ve marked planned or dismissed). Your own added suggestions are kept.</p>
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
      <p className="text-xs text-teal/70">
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
                isDone ? 'border-teal/30 bg-teal/5' :
                item.userAuthored ? 'border-sand border-l-4 border-l-terracotta bg-terracotta/[0.04]' :
                'border-sand'
              }`}
            >
              <span className={`shrink-0 w-6 h-6 rounded-full ${badgeColor} text-white text-xs flex items-center justify-center font-bold`}>
                {i + 1}
              </span>
              <div className="flex-1 space-y-2">
                <p className={`text-sm leading-relaxed ${isDismissed ? 'text-teal/70 line-through' : 'text-teal'}`}>
                  {item.text}
                </p>
                {item.why && !isDismissed && (
                  <p className="text-xs text-teal/70 leading-relaxed">
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
                  <span className="inline-block text-[10px] font-semibold uppercase tracking-wide bg-terracotta/15 text-terracotta-dark rounded px-1.5 py-0.5">
                    Your addition
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onToggleDone(item.id, isDone)}
                  aria-pressed={isDone}
                  title={isDone ? 'Unmark - treat as an open recommendation again' : 'I already do this or plan to - keep it in the report, flagged as planned'}
                  className={`text-xs rounded px-2 py-1 border transition-colors ${
                    isDone
                      ? 'border-teal bg-teal/15 text-teal'
                      : 'border-sand text-teal/70 hover:border-teal/40 hover:text-teal'
                  }`}
                >
                  {isDone ? '✓ Planned' : 'Planned'}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleDismissed(item.id, isDismissed)}
                  aria-pressed={isDismissed}
                  title={isDismissed ? 'Restore to the report' : 'Not relevant - hide from the report and PDF'}
                  className={`text-xs rounded px-2 py-1 border transition-colors ${
                    isDismissed
                      ? 'border-teal/40 bg-teal/10 text-teal'
                      : 'border-sand text-teal/70 hover:border-terracotta/40 hover:text-terracotta-dark'
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
