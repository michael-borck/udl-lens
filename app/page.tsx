import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-cream flex flex-col">
      <header className="px-8 py-6 flex items-center justify-between">
        <span className="font-display text-2xl text-teal">UDL Lens</span>
        <Link href="/about" className="text-sm text-teal/80 hover:text-teal transition-colors">
          Learn about UDL Lens
        </Link>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center">
        <p className="text-sm font-medium text-terracotta uppercase tracking-widest mb-4">
          Assessment 2030 · Curtin University
        </p>
        <h1 className="font-display text-5xl text-teal leading-tight mb-6 max-w-2xl">
          How well do your assessments support <em className="italic text-terracotta">all</em> learners?
        </h1>
        <p className="text-teal/80 text-lg max-w-xl mb-10">
          UDL Lens helps you audit your unit assessments against the Universal Design for Learning
          Guidelines 3.0 - with AI-assisted ratings and a downloadable report.
        </p>

        <Link
          href="/audit"
          className="rounded-lg bg-terracotta text-white px-10 py-4 text-lg font-medium hover:bg-terracotta-dark transition-colors"
        >
          Start audit →
        </Link>

        <p className="mt-6 text-sm text-teal/60">
          No login, no database. Files are sent for AI analysis and never stored on our servers; your ratings stay in this browser session only.
        </p>

        {/* How it works - three-step preview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-14 max-w-3xl w-full text-left">
          {[
            {
              n: 1,
              title: 'Add your assessments',
              body: 'Describe each one and optionally upload the brief, rubric, or exemplar. The AI reads them for context, then they are discarded - nothing is stored on our servers.',
            },
            {
              n: 2,
              title: 'Verify AI ratings',
              body: 'For each UDL checkpoint the AI suggests a rating (Not yet / Partially / Met) and explains why. This is a starting point, not a verdict - you stay the expert and set the final rating yourself.',
            },
            {
              n: 3,
              title: 'Get your report',
              body: 'A radar across the three UDL principles - Representation, Engagement, and Action & Expression - plus recommendations and a PDF you can share with teaching support.',
            },
          ].map(s => (
            <div key={s.n} className="rounded-xl bg-white border border-sand p-5">
              <div className="rounded-full bg-teal text-white w-7 h-7 flex items-center justify-center text-sm font-bold mb-3">
                {s.n}
              </div>
              <h3 className="font-display text-base text-teal mb-1">{s.title}</h3>
              <p className="text-sm text-teal/75 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>

        <p className="mt-8 text-xs text-teal/65 max-w-2xl">
          UDL is read across the whole unit, not single assessments. The audit is most useful when you include
          the assessments in a unit together. <Link href="/about" className="underline hover:text-teal">Learn about UDL Lens →</Link>
        </p>
      </div>

      <footer className="px-8 py-6 flex items-center justify-between text-xs text-teal/50">
        <span>UDL Guidelines 3.0 · CAST</span>
        <Link href="/about" className="hover:text-teal transition-colors">
          Learn about UDL Lens
        </Link>
      </footer>
    </main>
  )
}
