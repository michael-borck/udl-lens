import type { Suggestions, Suggestion } from '@/lib/types'
import { useSession } from '@/context/SessionContext'

interface Props {
  suggestions: Suggestions
}

const CAST_URL = 'https://udlguidelines.cast.org/'

export function SuggestionsList({ suggestions }: Props) {
  const { dispatch } = useSession()

  function toggleDismissed(id: string, current: boolean) {
    dispatch({ type: 'UPDATE_SUGGESTION', id, patch: { dismissed: !current } })
  }

  function toggleDone(id: string, current: boolean) {
    dispatch({ type: 'UPDATE_SUGGESTION', id, patch: { done: !current } })
  }

  return (
    <div className="space-y-6">
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
