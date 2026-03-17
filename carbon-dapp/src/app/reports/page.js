'use client'

import { useEffect, useMemo, useState } from 'react'
import QRCode from 'react-qr-code'

export default function ReportsPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    try {
      setLoading(true)
      setError('')
      const response = await fetch('/api/reports/surrenders', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Failed to load reports')
      setLogs(data.rows || [])
    } catch (e) {
      setError(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const totalsByYear = useMemo(() => {
    const map = new Map()
    for (const log of logs) {
      const year = Number(log.periodId)
      const amount = Number(log.amount || 0)
      map.set(year, (map.get(year) || 0) + amount)
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0])
  }, [logs])

  const latest = useMemo(() => {
    if (typeof window === 'undefined') return []
    const origin = window.location.origin
    return logs.slice(0, 10).map((log) => ({
      ...log,
      receiptUrl: `${origin}/receipt/${log.txHash}`,
      ts: Number(log.timestamp) * 1000,
    }))
  }, [logs])

  function formatDate(ts) {
    try {
      return new Date(ts).toLocaleString()
    } catch {
      return '-'
    }
  }

  return (
    <main className="page">
      <h1 className="page-title">Reports</h1>

      <section className="card col-12">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h3 style={{ margin: 0 }}>Carbon credit retirements (Surrender)</h3>
          <button className="btn" onClick={load} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {error && <div style={{ color: 'crimson', marginTop: 10 }}>{error}</div>}
        {!error && (
          <div className="subtle" style={{ marginTop: 10 }}>
            Loaded through the app server to avoid browser-side RPC failures and rate-limit spikes.
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          <strong>Total events:</strong> {logs.length}
        </div>

        <div style={{ marginTop: 12 }}>
          <h4>Totals by year</h4>
          <table className="table">
            <thead>
              <tr>
                <th>Year</th>
                <th>Total CAC</th>
              </tr>
            </thead>
            <tbody>
              {totalsByYear.map(([year, sum]) => (
                <tr key={year}>
                  <td>{year}</td>
                  <td>{sum}</td>
                </tr>
              ))}
              {totalsByYear.length === 0 && (
                <tr>
                  <td colSpan={2}>No data</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 12 }}>
          <h4>Latest events</h4>
          {!latest.length && <div>No data</div>}
          {!!latest.length && (
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {latest.map((item) => (
                <div key={item.key} className="card" style={{ padding: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{item.user}</div>
                    <div className="subtle" style={{ fontSize: 12, marginTop: 4 }}>
                      {item.amount} CAC | year {item.periodId}
                    </div>
                    <div className="subtle" style={{ fontSize: 11, marginTop: 4 }}>
                      at {formatDate(item.ts)}
                    </div>
                    <div className="subtle" style={{ fontSize: 11, overflowWrap: 'anywhere', marginTop: 4 }}>
                      <a href={item.receiptUrl}>{item.txHash}</a>
                    </div>
                  </div>
                  <a href={item.receiptUrl} title="Open receipt" style={{ marginLeft: 'auto', width: 96, height: 96 }}>
                    <QRCode value={item.receiptUrl} size={96} />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
