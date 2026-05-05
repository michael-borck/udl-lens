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
