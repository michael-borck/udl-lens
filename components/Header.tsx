import Link from 'next/link'

export function Header() {
  return (
    <header className="border-b border-sand bg-teal text-white px-8 py-5 flex items-center justify-between">
      <div>
        <Link href="/" className="font-display text-2xl hover:opacity-90 transition-opacity">
          UDL Lens
        </Link>
        <p className="text-sm text-white/70 mt-0.5">Assessment 2030 · UDL Guidelines 3.0 Audit</p>
      </div>
      <Link href="/about" className="text-sm text-white/70 hover:text-white transition-colors">
        About
      </Link>
    </header>
  )
}
