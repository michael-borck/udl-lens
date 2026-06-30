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
            so that all students can access, engage with, and demonstrate their learning - regardless
            of their background, abilities, or learning preferences.
          </p>
          <p className="text-teal/70 leading-relaxed">
            Developed by{' '}
            <a
              href="https://www.cast.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal underline hover:text-terracotta-dark transition-colors"
            >
              CAST
            </a>
            , the UDL Guidelines 3.0 organise good practice across three principles:
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
            (Secure)</strong> assessments like interactive orals, and <strong className="text-teal">Lane 2
            (Non-secure)</strong> assessments like field journals with media analysis. The current
            prototype focuses on these two assessment types, with UDL 3.0 checkpoints curated by
            Curtin Teaching Support for each.
          </p>
          <a
            href="https://www.curtin.edu.au/assessment2030/assessment-design-studio/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-3 text-sm text-terracotta-dark underline hover:text-terracotta-dark transition-colors"
          >
            Explore the A2030 Assessment Design Studio →
          </a>
        </section>

        <section className="mb-10">
          <h3 className="font-display text-xl text-teal mb-3">How UDL Lens works</h3>
          <ol className="space-y-4">
            <li className="flex gap-4">
              <span className="rounded-full bg-teal text-white w-7 h-7 flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">1</span>
              <div>
                <p className="font-medium text-teal mb-1">Add your assessments</p>
                <p className="text-teal/70 text-sm leading-relaxed">
                  Describe each assessment in your unit - name, type, and A2030 lane. You can
                  optionally upload up to three documents (brief, rubric, exemplar) and answer
                  a short self-report about classroom delivery. Several UDL 3.0 practices live
                  in how you teach rather than in any document, so the self-report fills that
                  gap and helps the AI give a more honest pre-fill.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="rounded-full bg-teal text-white w-7 h-7 flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">2</span>
              <div>
                <p className="font-medium text-teal mb-1">Review AI-assisted checkpoint ratings</p>
                <p className="text-teal/70 text-sm leading-relaxed">
                  The AI reads your documents and gives each checkpoint a first-pass rating
                  (Not yet / Partially / Met) with a short justification - an evaluation to react
                  to, not a verdict. Your job is to agree or change each one. You are judging how
                  well the assessment supports learners, not whether it has passed or failed a
                  standard - and you keep the final call on every rating.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="rounded-full bg-teal text-white w-7 h-7 flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">3</span>
              <div>
                <p className="font-medium text-teal mb-1">Get your results</p>
                <p className="text-teal/70 text-sm leading-relaxed">
                  See a radar chart across the three UDL principles (Representation, Engagement,
                  and Action &amp; Expression), a breakdown by checkpoint, and
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
            Nothing is stored on our servers. Uploaded files are sent to the configured AI provider
            for analysis, processed in memory, and discarded right after - never written to disk or a
            database. Your assessment data, ratings, and any extracted text live only in this browser
            session, and clear when you choose &ldquo;Start over&rdquo; or close the tab. There are no
            user accounts, no cookies, and no analytics.
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
