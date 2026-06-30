'use client'

import { useState } from 'react'
import { UdlPrimerModal } from './UdlPrimerModal'
import { AboutModal } from './AboutModal'

// The two header info popups, with deliberately different labels so users know
// which is which: "What is UDL?" = the framework; "How it works" = this app.
// `variant` restyles the triggers for the header they sit in (cream landing
// header vs teal app header).
export function InfoModals({ variant }: { variant: 'cream' | 'teal' }) {
  const [which, setWhich] = useState<'none' | 'udl' | 'about'>('none')
  const close = () => setWhich('none')
  const link =
    variant === 'teal' ? 'text-white/80 hover:text-white' : 'text-teal/80 hover:text-teal'

  return (
    <>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setWhich('udl')}
          className={`${link} text-sm transition-colors`}
        >
          What is UDL?
        </button>
        <button
          type="button"
          onClick={() => setWhich('about')}
          className={`${link} text-sm transition-colors`}
        >
          How it works
        </button>
      </div>
      <UdlPrimerModal open={which === 'udl'} onClose={close} />
      <AboutModal open={which === 'about'} onClose={close} />
    </>
  )
}
