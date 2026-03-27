'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMemo, useState } from 'react'

const topItems = [
  { href: '/', label: 'Dashboard', icon: 'DB' },
  { href: '/profile', label: 'Company Profile', icon: 'PF' },
]

const marketItems = [
  { href: '/marketplace/sell-fixed', label: 'Fixed price', icon: 'FX' },
  { href: '/marketplace/open-auction', label: 'Open auction', icon: 'OA' },
  { href: '/marketplace/buy-orders', label: 'Buy requests', icon: 'BO' },
  { href: '/marketplace/blind-auction', label: 'Blind auction', icon: 'BA' },
  { href: '/marketplace/dutch', label: 'Dutch auction', icon: 'DA' },
  { href: '/marketplace/bundle', label: 'Bundle / Batch', icon: 'BD' },
  { href: '/marketplace/offers', label: 'Direct offers', icon: 'OF' },
]

const bottomItems = [
  { href: '/mint', label: 'Mint', icon: 'MT' },
  { href: '/reports', label: 'Reports', icon: 'RP' },
  { href: '/settings', label: 'Settings', icon: 'ST' },
]

export default function Sidebar({ mobileOpen = false, onClose = () => {} }) {
  const path = usePathname()
  const isMarketPath = useMemo(() => (path || '').startsWith('/marketplace'), [path])
  const [marketOpen, setMarketOpen] = useState(() => isMarketPath)
  const showMarketItems = isMarketPath || marketOpen

  const linkClass = (href) => ((path || '') === href ? 'active' : '')
  const marketActive = isMarketPath ? 'active' : ''

  return (
    <>
      <button
        type="button"
        className={`sidebar-overlay ${mobileOpen ? 'open' : ''}`}
        aria-label="Close navigation"
        onClick={onClose}
      />
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
      <div className="brand">
        <div className="fox" />
        <div>
          <div>CAC Registry &</div>
          <div>Marketplace</div>
        </div>
      </div>

      <nav className="nav">
        <div className="nav-section">Overview</div>
        {topItems.map((item) => (
          <Link key={item.href} href={item.href} className={linkClass(item.href)} onClick={onClose}>
            <span className="nav-ico">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </Link>
        ))}

        <div className="nav-section">Marketplace</div>
        <div className={`nav-group ${marketActive}`}>
          <button
            type="button"
            className="nav-btn"
            onClick={() => setMarketOpen((value) => !value)}
            aria-expanded={showMarketItems}
          >
            <span className="nav-ico">MK</span>
            <span className="nav-label">Marketplace</span>
            <span className={`nav-caret ${showMarketItems ? 'open' : ''}`} aria-hidden>
              ^
            </span>
          </button>

          {showMarketItems && (
            <div className="nav-sub">
              {marketItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sub-link ${linkClass(item.href)}`}
                  onClick={onClose}
                >
                  <span className="nav-ico">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="nav-section">Tools</div>
        {bottomItems.map((item) => (
          <Link key={item.href} href={item.href} className={linkClass(item.href)} onClick={onClose}>
            <span className="nav-ico">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div>v0.1</div>
        <div>Sepolia live</div>
      </div>
      </aside>
    </>
  )
}
