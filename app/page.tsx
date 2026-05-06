import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-cream flex flex-col">
      <header className="px-8 py-6 flex items-center justify-between">
        <span className="font-display text-2xl text-teal">UDL Lens</span>
        <Link href="/about" className="text-sm text-teal/60 hover:text-teal transition-colors">
          About
        </Link>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center">
        <p className="text-sm font-medium text-terracotta uppercase tracking-widest mb-4">
          Assessment 2030 · Curtin University
        </p>
        <h1 className="font-display text-5xl text-teal leading-tight mb-6 max-w-2xl">
          How well do your assessments support all learners?
        </h1>
        <p className="text-teal/60 text-lg max-w-xl mb-10">
          UDL Lens helps you audit your unit assessments against the Universal Design for Learning
          Guidelines 3.0 — with AI-assisted ratings and a downloadable report.
        </p>

        <Link
          href="/audit"
          className="rounded-lg bg-terracotta text-white px-10 py-4 text-lg font-medium hover:bg-terracotta-dark transition-colors"
        >
          Start audit →
        </Link>

        <p className="mt-6 text-sm text-teal/40">
          No login required. Your data never leaves your session.
        </p>

        {/* How it works — three-step preview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-14 max-w-3xl w-full text-left">
          {[
            {
              n: 1,
              title: 'Add your assessments',
              body: 'Describe each one and optionally upload the brief. The AI reads it for context.',
            },
            {
              n: 2,
              title: 'Verify AI ratings',
              body: 'For each UDL checkpoint the AI suggests Not yet / Partially / Met with reasoning. You confirm or change it.',
            },
            {
              n: 3,
              title: 'Get your report',
              body: 'A radar across the three UDL principles, recommendations, and a PDF you can share with teaching support.',
            },
          ].map(s => (
            <div key={s.n} className="rounded-xl bg-white border border-sand p-5">
              <div className="rounded-full bg-teal text-white w-7 h-7 flex items-center justify-center text-sm font-bold mb-3">
                {s.n}
              </div>
              <h3 className="font-display text-base text-teal mb-1">{s.title}</h3>
              <p className="text-sm text-teal/60 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>

        <p className="mt-8 text-xs text-teal/40 max-w-2xl">
          UDL is read across the whole unit, not single assessments. The audit is most useful when you include
          the assessments in a unit together. <Link href="/about" className="underline hover:text-teal/70">Read more about the approach →</Link>
        </p>
      </div>

      <footer className="px-8 py-6 flex items-center justify-between text-xs text-teal/30">
        <span>UDL Guidelines 3.0 · CAST</span>
        <Link href="/about" className="hover:text-teal/60 transition-colors">
          How it works
        </Link>
      </footer>
    </main>
  )
}
