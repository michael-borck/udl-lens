import Link from 'next/link'
import { InfoModals } from '@/components/InfoModals'
import { ResultsMock } from '@/components/ResultsMock'

const STEPS = [
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
    body: 'A radar across the UDL guidelines, plus recommendations and a PDF you can share with teaching support.',
  },
] as const

export default function LandingPage() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? '?'
  const sha = process.env.NEXT_PUBLIC_BUILD_SHA ?? 'dev'
  return (
    <main className="min-h-screen bg-cream flex flex-col">
      <header className="px-8 py-6 flex items-center justify-between">
        <span className="font-display text-2xl text-teal">UDL Lens</span>
        <InfoModals variant="cream" />
      </header>

      {/* Hero: text left, animated results mock right */}
      <section className="flex flex-1 items-center justify-center px-8 pb-10">
        <div className="grid w-full max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-[1.02fr_0.98fr]">
          <div className="min-w-0">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-terracotta/25 bg-terracotta/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-widest text-terracotta-dark">
              <span className="animate-hero-pulse h-1.5 w-1.5 rounded-full bg-terracotta" />
              Assessment 2030 · Curtin University
            </span>
            <h1 className="mb-5 max-w-xl font-display text-4xl leading-tight text-teal sm:text-5xl">
              How well do your assessments support <em className="italic text-terracotta-dark">all</em> learners?
            </h1>
            <p className="mb-8 max-w-md text-lg text-teal-light">
              UDL Lens audits your unit assessments against the Universal Design for Learning
              Guidelines 3.0 - with AI-assisted ratings, a radar of your coverage, and a
              downloadable report.
            </p>
            <div className="mb-4 flex flex-wrap items-center gap-3.5">
              <Link
                href="/audit"
                className="rounded-lg bg-terracotta px-7 py-3.5 text-base font-medium text-white transition-all hover:-translate-y-px hover:bg-terracotta-dark"
              >
                Start audit →
              </Link>
              <Link
                href="#how-it-works"
                className="rounded-lg border border-sand px-7 py-3.5 text-base font-medium text-teal transition-colors hover:border-teal hover:bg-teal/5"
              >
                See how it works
              </Link>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-teal-light">
              No login, no database. Files are sent for AI analysis and never stored on our
              servers; your ratings stay in this browser session only.
            </p>
          </div>

          <ResultsMock />
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="px-8 pb-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-6 text-center font-display text-2xl text-teal">How it works</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {STEPS.map(s => (
              <div key={s.n} className="rounded-xl border border-sand bg-white p-5">
                <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-full bg-teal text-sm font-bold text-white">
                  {s.n}
                </div>
                <h3 className="mb-1 font-display text-base text-teal">{s.title}</h3>
                <p className="text-sm leading-relaxed text-teal-light/90">{s.body}</p>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-relaxed text-teal-light">
            UDL is read across the whole unit, not single assessments. The audit is most useful when
            you include the assessments in a unit together.
          </p>
        </div>
      </section>

      <footer className="px-8 py-6 flex items-center justify-between text-xs text-teal-light">
        <span>UDL Guidelines 3.0 · CAST</span>
        <span className="text-teal/50">v{version} · {sha}</span>
      </footer>
    </main>
  )
}
