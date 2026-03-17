'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMemo, useState } from 'react'

const topItems = [
  { href: '/', label: 'Dashboard', icon: 'Home' },
  { href: '/profile', label: 'Company Profile', icon: 'Profile' },
]

const marketItems = [
  { href: '/marketplace/sell-fixed', label: 'Fixed price', icon: 'Fixed' },
  { href: '/marketplace/open-auction', label: 'Open auction', icon: 'Open' },
  { href: '/marketplace/buy-orders', label: 'Buy requests', icon: 'Buy' },
  { href: '/marketplace/blind-auction', label: 'Blind auction', icon: 'Blind' },
  { href: '/marketplace/dutch', label: 'Dutch auction', icon: 'Dutch' },
  { href: '/marketplace/bundle', label: 'Bundle / Batch', icon: 'Bundle' },
  { href: '/marketplace/offers', label: 'Direct offers', icon: 'Offer' },
]

const bottomItems = [
  { href: '/mint', label: 'Mint', icon: 'Mint' },
  { href: '/reports', label: 'Reports', icon: 'Report' },
  { href: '/settings', label: 'Settings', icon: 'Settings' },
]

export default function Sidebar() {
  const path = usePathname()
  const isMarketPath = useMemo(() => (path || '').startsWith('/marketplace'), [path])
  const [marketOpen, setMarketOpen] = useState(() => isMarketPath)
  const showMarketItems = isMarketPath || marketOpen

  const linkClass = (href) => ((path || '') === href ? 'active' : '')
  const marketActive = isMarketPath ? 'active' : ''

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="fox" />
        <div>CAC Registry & Marketplace</div>
      </div>

      <nav className="nav">
        {topItems.map((it) => (
          <Link key={it.href} href={it.href} className={linkClass(it.href)}>
            <span className="nav-ico">{it.icon}</span>
            <span className="nav-label">{it.label}</span>
          </Link>
        ))}

        <div className={`nav-group ${marketActive}`}>
          <button
            type="button"
            className="nav-btn"
            onClick={() => setMarketOpen((value) => !value)}
            aria-expanded={showMarketItems}
          >
            <span className="nav-ico">Shop</span>
            <span className="nav-label">Marketplace</span>
            <span className={`nav-caret ${showMarketItems ? 'open' : ''}`} aria-hidden>
              ^
            </span>
          </button>

          {showMarketItems && (
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

        {bottomItems.map((it) => (
          <Link key={it.href} href={it.href} className={linkClass(it.href)}>
            <span className="nav-ico">{it.icon}</span>
            <span className="nav-label">{it.label}</span>
          </Link>
        ))}
      </nav>

      <div style={{ marginTop: 'auto', padding: '12px', color: 'var(--muted)', fontSize: 12 }}>
        v0.1 | Configurable network
      </div>
    </aside>
  )
}
