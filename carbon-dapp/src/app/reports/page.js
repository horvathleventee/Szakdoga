'use client'
import { useEffect, useMemo, useState } from 'react'
import { usePublicClient } from 'wagmi'
import { parseAbiItem } from 'viem'
import QRCode from 'react-qr-code'

const CAC = process.env.NEXT_PUBLIC_ALLOWANCE20_ADDRESS

// Részletes log: timestamp + profil snapshot
const SURRENDER_LOGGED_EVT = parseAbiItem(
  'event SurrenderLogged(address indexed user, uint256 amount, uint16 periodId, uint256 timestamp, string displayName, bytes32 taxIdHash, string metadataURI, string docsURI)'
)

export default function ReportsPage() {
  const client = usePublicClient()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    try {
      setLoading(true); setError('')
      const data = await client.getLogs({
        address: CAC,
        event: SURRENDER_LOGGED_EVT,
        fromBlock: 0n,
        toBlock: 'latest',
      })
      setLogs(data)
    } catch (e) {
      setError(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Összesítés év szerint
  const totalsByYear = useMemo(() => {
    const map = new Map()
    for (const l of logs) {
      const y = Number(l.args.periodId)
      const a = Number(l.args.amount ?? 0n)
      map.set(y, (map.get(y) || 0) + a)
    }
    return Array.from(map.entries()).sort((a,b)=>a[0]-b[0])
  }, [logs])

  // Kártyák + kattintható QR (URL-t kódolunk)
  const latest = useMemo(() => {
    if (typeof window === 'undefined') return []
    const origin = window.location.origin
    return logs.slice(-10).reverse().map((l, i) => {
      const user = String(l.args.user)
      const amount = String(l.args.amount)
      const periodId = String(l.args.periodId)
      const ts = Number(l.args.timestamp) * 1000
      const txHash = l.transactionHash
      const receiptUrl = `${origin}/receipt/${txHash}`
      return {
        key: l.blockHash + ':' + i,
        user, amount, periodId, ts, txHash, receiptUrl,
      }
    })
  }, [logs])

  function fmt(ts) {
    try { return new Date(ts).toLocaleString() } catch { return '—' }
  }

  return (
    <main className="page">
      <h1 className="page-title">Reports</h1>

      <section className="card col-12">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <h3 style={{margin:0}}>Carbon credit retirements (Surrender)</h3>
          <button className="btn" onClick={load} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {error && <div style={{color:'crimson', marginTop:10}}>{error}</div>}

        <div style={{marginTop:12}}>
          <strong>Total events:</strong> {logs.length}
        </div>

        <div style={{marginTop:12}}>
          <h4>Totals by year</h4>
          <table className="table">
            <thead><tr><th>Year</th><th>Total CAC</th></tr></thead>
            <tbody>
              {totalsByYear.map(([y, sum]) => (
                <tr key={y}><td>{y}</td><td>{sum}</td></tr>
              ))}
              {totalsByYear.length===0 && <tr><td colSpan={2}>No data</td></tr>}
            </tbody>
          </table>
        </div>

        <div style={{marginTop:12}}>
          <h4>Latest events</h4>

          {!latest.length && <div>No data</div>}

          {!!latest.length && (
            <div className="grid" style={{gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:12}}>
              {latest.map((it) => (
                <div key={it.key} className="card" style={{padding:12, display:'flex', gap:12, alignItems:'center'}}>
                  <div>
                    <div style={{fontWeight:600, fontSize:13}}>{it.user}</div>
                    <div className="subtle" style={{fontSize:12, marginTop:4}}>
                      {it.amount} CAC • year {it.periodId}
                    </div>
                    <div className="subtle" style={{fontSize:11, marginTop:4}}>
                      at {fmt(it.ts)}
                    </div>
                    <div className="subtle" style={{fontSize:11, overflowWrap:'anywhere', marginTop:4}}>
                      {/* tx hash is legyen linkként kattintható */}
                      <a href={it.receiptUrl}>{it.txHash}</a>
                    </div>
                  </div>

                  {/* ⬇︎ A QR most kattintható és a /receipt/[tx]-re visz */}
                  <a
                    href={it.receiptUrl}
                    title="Open receipt"
                    style={{marginLeft:'auto', width:96, height:96}}
                  >
                    <QRCode value={it.receiptUrl} size={96} />
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
