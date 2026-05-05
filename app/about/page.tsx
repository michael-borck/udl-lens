import Link from 'next/link'
import { Header } from '@/components/Header'

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-cream">
      <Header />

      <div className="max-w-2xl mx-auto px-6 py-12">
        <h2 className="font-display text-4xl text-teal mb-8">About UDL Lens</h2>

        <section className="mb-10">
          <h3 className="font-display text-xl text-teal mb-3">What is UDL?</h3>
          <p className="text-teal/70 leading-relaxed mb-3">
            Universal Design for Learning (UDL) is a framework for designing teaching and assessment
            so that all students can access, engage with, and demonstrate their learning — regardless
            of their background, abilities, or learning preferences.
          </p>
          <p className="text-teal/70 leading-relaxed">
            Developed by CAST, the UDL Guidelines 3.0 organise good practice across three principles:
            providing multiple means of <strong className="text-teal">Representation</strong> (how
            content is presented), <strong className="text-teal">Engagement</strong> (how students
            are motivated and supported), and <strong className="text-teal">Action &amp; Expression</strong> (how
            students demonstrate what they know).
          </p>
        </section>

        <section className="mb-10">
          <h3 className="font-display text-xl text-teal mb-3">Assessment 2030</h3>
          <p className="text-teal/70 leading-relaxed">
            Assessment 2030 (A2030) is Curtin University&apos;s initiative to redesign assessment
            practice for a changing world. It introduces a two-lane structure: <strong className="text-teal">Lane 1
            (Secure)</strong> assessments like invigilated exams and interactive orals, and <strong className="text-teal">Lane 2
            (Non-secure)</strong> assessments like portfolios, field journals, and written reports.
            UDL Lens uses this structure to focus the audit on the checkpoints most relevant to each
            assessment type.
          </p>
        </section>

        <section className="mb-10">
          <h3 className="font-display text-xl text-teal mb-3">How UDL Lens works</h3>
          <ol className="space-y-4">
            <li className="flex gap-4">
              <span className="rounded-full bg-teal text-white w-7 h-7 flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">1</span>
              <div>
                <p className="font-medium text-teal mb-1">Add your assessments</p>
                <p className="text-teal/60 text-sm leading-relaxed">
                  Describe each assessment in your unit — name, type, and A2030 lane. Optionally
                  upload the assignment brief (PDF or DOCX) so the AI has full context.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="rounded-full bg-teal text-white w-7 h-7 flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">2</span>
              <div>
                <p className="font-medium text-teal mb-1">Review AI-assisted checkpoint ratings</p>
                <p className="text-teal/60 text-sm leading-relaxed">
                  Claude reads your brief and pre-fills a UDL rating (Not yet / Partially / Met)
                  for each relevant checkpoint, with a brief explanation. You verify each rating and
                  can override it. The goal is to reduce blank-slate fatigue while keeping you in
                  control — and ensuring you engage with what each checkpoint actually means.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="rounded-full bg-teal text-white w-7 h-7 flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">3</span>
              <div>
                <p className="font-medium text-teal mb-1">Get your results</p>
                <p className="text-teal/60 text-sm leading-relaxed">
                  See a radar chart across six UDL dimensions, a breakdown by checkpoint, and
                  concrete quick wins and longer-term suggestions. Download a PDF report suitable
                  for a teaching support conversation or professional development evidence.
                </p>
              </div>
            </li>
          </ol>
        </section>

        <section className="mb-12">
          <h3 className="font-display text-xl text-teal mb-3">Privacy</h3>
          <p className="text-teal/70 leading-relaxed">
            Nothing is stored. Your assessment data and uploaded briefs exist only in your browser
            session and are sent to the AI solely to generate ratings — they are not retained. There
            are no user accounts, no cookies, and no analytics.
          </p>
        </section>

        <Link
          href="/audit"
          className="inline-block rounded-lg bg-terracotta text-white px-8 py-3 font-medium hover:bg-terracotta-dark transition-colors"
        >
          Start audit →
        </Link>
      </div>
    </main>
  )
}
