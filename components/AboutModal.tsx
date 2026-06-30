'use client'

import { Modal } from './Modal'

interface Props {
  open: boolean
  onClose: () => void
}

// The *app* primer: what UDL Lens is and how the three-step flow works. Deliberately
// does NOT teach UDL itself - that lives in UdlPrimerModal ("What is UDL?") - so the
// two popups stay distinct.
export function AboutModal({ open, onClose }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="How UDL Lens works" labelledById="about-title">
      <p>
        UDL Lens helps you audit your unit&apos;s assessments against the{' '}
        <strong className="text-teal">UDL Guidelines 3.0</strong>, framed around Curtin&apos;s
        Assessment 2030. No login, no database - your work stays in this browser.
      </p>

      <p className="font-medium text-teal">Three steps</p>
      <ol className="space-y-3">
        <li>
          <strong className="text-teal">1. Add your assessments</strong>
          <br />
          Describe each one and optionally upload the brief, rubric, or exemplar for context.
        </li>
        <li>
          <strong className="text-teal">2. Verify the AI ratings</strong>
          <br />
          For each UDL checkpoint the AI gives a first-pass rating (Not yet / Partially / Met) with a
          short justification - an evaluation to react to, not a verdict. You agree or change each
          one; you keep the final call.
        </li>
        <li>
          <strong className="text-teal">3. Get your report</strong>
          <br />
          A radar across the UDL guidelines, quick wins and longer-term improvements, and a
          downloadable PDF to share with teaching support.
        </li>
      </ol>

      <p>
        Files you upload are sent for AI analysis and never stored on our servers; your ratings stay
        in this browser session only.
      </p>

      <p className="text-xs text-teal/70 pt-3 border-t border-sand">
        New to UDL? See <span className="font-medium text-teal">&ldquo;What is UDL?&rdquo;</span>.
      </p>
    </Modal>
  )
}
