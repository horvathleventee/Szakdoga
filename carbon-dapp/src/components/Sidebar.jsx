'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

const topItems = [
  { href: '/', label: 'Dashboard', icon: '🏠' },
  { href: '/profile', label: 'Company Profile', icon: '🏷️' },
]

const marketItems = [
  { href: '/marketplace/sell', label: 'Sell', icon: '💸' },
  { href: '/marketplace/buy', label: 'Buy requests', icon: '🧾' },
  { href: '/marketplace/blind', label: 'Blind auctions', icon: '🙈' },
]

const bottomItems = [
  { href: '/reports', label: 'Reports', icon: '📊' },
  { href: '/mint', label: 'Mint', icon: '🏭' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
]

export default function Sidebar() {
  const path = usePathname()

  const isMarketPath = useMemo(() => (path || '').startsWith('/marketplace'), [path])
  const [marketOpen, setMarketOpen] = useState(isMarketPath)

  useEffect(() => {
    // Ha marketplace aloldalon vagyunk, legyen nyitva
    if (isMarketPath) setMarketOpen(true)
  }, [isMarketPath])

  const linkClass = (href) => ((path || '') === href ? 'active' : '')
  const marketActive = isMarketPath ? 'active' : ''

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="fox" />
        <div>CAC Registry & Marketplace</div>
      </div>

      <nav className="nav">
        {/* Top items */}
        {topItems.map((it) => (
          <Link key={it.href} href={it.href} className={linkClass(it.href)}>
            <span className="nav-ico">{it.icon}</span>
            <span className="nav-label">{it.label}</span>
          </Link>
        ))}

        {/* Marketplace group (NEM navigál, csak lenyit/csuk) */}
        <div className={`nav-group ${marketActive}`}>
          <button
            type="button"
            className="nav-btn"
            onClick={() => setMarketOpen((v) => !v)}
            aria-expanded={marketOpen}
          >
            <span className="nav-ico">🛒</span>
            <span className="nav-label">Marketplace</span>
            <span className={`nav-caret ${marketOpen ? 'open' : ''}`} aria-hidden>
              ▾
            </span>
          </button>

          {marketOpen && (
            <div className="nav-sub">
              {marketItems.map((it) => (
                <Link key={it.href} href={it.href} className={`sub-link ${linkClass(it.href)}`}>
                  <span className="nav-ico">{it.icon}</span>
                  <span className="nav-label">{it.label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Bottom items */}
        {bottomItems.map((it) => (
          <Link key={it.href} href={it.href} className={linkClass(it.href)}>
            <span className="nav-ico">{it.icon}</span>
            <span className="nav-label">{it.label}</span>
          </Link>
        ))}
      </nav>

      <div style={{ marginTop: 'auto', padding: '12px', color: 'var(--muted)', fontSize: 12 }}>
        v0.1 • Local 31337
      </div>
    </aside>
  )
}
