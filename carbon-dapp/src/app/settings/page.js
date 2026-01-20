'use client'

import { useAccount, useDisconnect } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'

const CAC = process.env.NEXT_PUBLIC_ALLOWANCE20_ADDRESS
const MKT = process.env.NEXT_PUBLIC_MARKET_ADDRESS

export default function SettingsPage() {
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const queryClient = useQueryClient()

  function clearCache() {
    try {
      queryClient.clear()
      // wagmi store + egyéb saját cache-ek
      if (typeof window !== 'undefined') {
        localStorage.removeItem('wagmi.store')
        // ha mást is eltároltál:
        // localStorage.removeItem('your-app-key')
      }
      alert('Local cache cleared.')
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <main className="page">
      <h1 className="page-title">Settings</h1>

      <section className="card col-12">
        <h3>Network &amp; Contracts</h3>
        <div className="subtle">Network: Hardhat Local (31337)</div>
        <div>CAC: <code>{CAC}</code></div>
        <div>Marketplace: <code>{MKT}</code></div>
      </section>

      <section className="card col-12">
        <h3>Wallet</h3>
        <div className="subtle" style={{ marginBottom: 8 }}>
          {isConnected ? <>Connected: {address}</> : 'Not connected'}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn" onClick={() => disconnect()}>Disconnect</button>
          <button className="btn" onClick={clearCache}>Clear local cache</button>
        </div>
      </section>
    </main>
  )
}
