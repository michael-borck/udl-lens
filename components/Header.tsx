import Link from 'next/link'

export function Header() {
  return (
    <header className="border-b border-sand bg-teal text-white px-8 py-3 flex items-center justify-between">
      <div className="flex items-baseline gap-3">
        <Link href="/" className="font-display text-xl hover:opacity-90 transition-opacity">
          UDL Lens
        </Link>
        <span className="text-xs text-white/60 hidden sm:inline">Assessment 2030 · UDL 3.0 Audit</span>
      </div>
      <Link href="/about" className="text-sm text-white/80 hover:text-white transition-colors">
        Learn about UDL Lens
      </Link>
    </header>
  )
}
