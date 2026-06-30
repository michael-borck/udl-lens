'use client'

import { Modal } from './Modal'

interface Props {
  open: boolean
  onClose: () => void
}

// The UDL *framework* primer: what UDL and A2030 are. Deliberately does NOT
// cover the app - that lives in AboutModal ("How it works") - so the two popups
// don't overlap. Keep CAST/UDL framing here in sync with AboutModal's one-liner.
export function UdlPrimerModal({ open, onClose }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="What is UDL?" labelledById="udl-primer-title">
      <p>
        <strong className="text-teal">Universal Design for Learning (UDL)</strong> is a framework
        for designing teaching and assessment so that <em>all</em> students can access, engage
        with, and demonstrate their learning - regardless of background, ability, or learning
        preference. It is published by CAST (UDL Guidelines 3.0).
      </p>

      <p className="font-medium text-teal">Three principles - the why, what, and how of learning:</p>
      <ul className="space-y-2">
        <li>
          <strong className="text-teal">Representation</strong> - the <em>what</em>: how content is
          presented.
        </li>
        <li>
          <strong className="text-teal">Action &amp; Expression</strong> - the <em>how</em>: how
          learners show what they know.
        </li>
        <li>
          <strong className="text-teal">Engagement</strong> - the <em>why</em>: how learners are
          motivated and supported.
        </li>
      </ul>
      <p>
        Each principle contains guidelines and checkpoints - the specific practices UDL Lens rates
        your assessment against.
      </p>

      <p className="font-medium text-teal">Assessment 2030 (A2030)</p>
      <p>Curtin&apos;s initiative to redesign assessment, built on a two-lane structure:</p>
      <ul className="space-y-2">
        <li>
          <strong className="text-teal">Lane 1 (Secure)</strong> - e.g. interactive orals.
        </li>
        <li>
          <strong className="text-teal">Lane 2 (Non-secure)</strong> - e.g. field journals with
          media analysis.
        </li>
      </ul>

      <p className="text-xs text-teal/70 pt-3 border-t border-sand">
        Full UDL Guidelines 3.0:{' '}
        <a
          href="https://udlguidelines.cast.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-terracotta-dark underline hover:text-terracotta transition-colors"
        >
          udlguidelines.cast.org
        </a>
      </p>
    </Modal>
  )
}
