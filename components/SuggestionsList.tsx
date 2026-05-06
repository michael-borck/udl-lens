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
