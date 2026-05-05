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

      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
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
