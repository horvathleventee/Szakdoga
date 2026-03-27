'use client'
import { useState } from 'react'
import Sidebar from './Sidebar'

export default function Shell({ children }){
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="app">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <main className="main">
        <div className="mobile-topbar">
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={() => setMobileOpen((value) => !value)}
            aria-expanded={mobileOpen}
            aria-label="Toggle navigation"
          >
            <span />
            <span />
            <span />
          </button>
          <div className="mobile-brand-text">
            <strong>CAC Registry</strong>
            <span>Sepolia live</span>
          </div>
        </div>
        {children}
      </main>
    </div>
  )
}
