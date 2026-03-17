'use client'
import { useMemo, useState } from 'react'

export default function Page() {
  const [user, setUser] = useState('0x...')
  const [area, setArea] = useState('1000') // m²
  const [factor, setFactor] = useState<number | null>(null)
  const [current, setCurrent] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string>('')

  const calc = useMemo(() => {
    const m2 = Number(area || 0)
    const f = factor ?? 0
    if (!Number.isFinite(m2) || !Number.isFinite(f)) return 0
    return Math.floor(m2 * f)
  }, [area, factor])

  async function loadFactor() {
    try {
      const res = await fetch(`/api/get-quota?meta=factor`)
      const js = await res.json()
      if (typeof js.factor === 'number') setFactor(js.factor)
    } catch {}
  }

  async function checkOnChain() {
    if (!user) return
    setMsg('')
    setBusy(true)
    try {
      const res = await fetch(`/api/get-quota?user=${encodeURIComponent(user)}`)
      const js = await res.json()
      if (typeof js.remaining === 'number') setCurrent(js.remaining)
      else setMsg(js.error || 'Ismeretlen hiba (get-quota).')
    } catch (e: any) {
      setMsg(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  async function setOnChain() {
    if (!user) { setMsg('Adj meg egy gyár (wallet) címet.'); return }
    const areaM2 = Number(area || 0)
    if (!(areaM2 > 0)) { setMsg('A terület m²-ben legyen pozitív szám.'); return }

    setMsg('')
    setBusy(true)
    try {
      const res = await fetch(`/api/set-quota`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, areaM2 }),
      })
      const js = await res.json()
      if (res.ok) {
        setMsg(`Kvóta beállítva a láncon. Tx: ${js.txHash || '—'}`)
        // utána olvassuk vissza
        await checkOnChain()
      } else {
        setMsg(js.error || 'Hiba történt a kvóta beállításakor.')
      }
    } catch (e: any) {
      setMsg(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  // első faktor betöltés
  useMemo(() => { loadFactor() }, [])

  return (
    <main style={styles.wrap}>
      <h1 style={styles.h1}>Gyár → Mint kvóta kalkulátor</h1>

      <section style={styles.card}>
        <div style={styles.row}>
          <label style={styles.label}>
            Gyár (wallet) címe
            <input
              style={styles.input}
              value={user}
              onChange={e => setUser(e.target.value)}
              placeholder="0x..."
            />
          </label>
          <label style={styles.label}>
            Gyár területe (m²)
            <input
              style={styles.input}
              value={area}
              onChange={e => setArea(e.target.value)}
              inputMode="numeric"
            />
          </label>
        </div>

        <div style={{marginTop:8}}>
          <b>{calc}</b> CAC kvóta (kalkulált) &nbsp; • &nbsp;
          faktor: <code>{factor ?? '…'} CAC / m²</code>
        </div>

        <div style={styles.row}>
          <button style={styles.btn} onClick={checkOnChain} disabled={busy || !user}>
            Láncon lévő kvóta lekérdezése
          </button>
          <div>aktuális: <b>{current ?? '—'}</b></div>
        </div>

        <div style={styles.row}>
          <button style={styles.btnPrimary} onClick={setOnChain} disabled={busy || !user || !area}>
            Kvóta beállítása a láncra
          </button>
        </div>

        {msg && <div style={{...styles.note, color: msg.startsWith('Hiba') ? '#b91c1c' : '#2563eb'}}>{msg}</div>}

        <p style={styles.help}>
        </p>
      </section>
    </main>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 820, margin: '24px auto', padding: '0 16px', fontFamily: 'system-ui, sans-serif' },
  h1: { fontSize: 24, marginBottom: 12 },
  card: { background: '#111318', border: '1px solid #23262d', borderRadius: 12, padding: 16, color: '#e5e7eb' },
  row: { display: 'flex', gap: 12, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' },
  label: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 260 },
  input: { background: '#0b0d12', border: '1px solid #2a2f3a', borderRadius: 8, color: '#e5e7eb', padding: '8px 10px' },
  btn: { padding: '10px 12px', borderRadius: 8, background: '#2a2f3a', border: '1px solid #3a4150', color: '#e5e7eb' },
  btnPrimary: { padding: '10px 12px', borderRadius: 8, background: '#2563eb', border: '1px solid #1d4ed8', color: 'white' },
  note: { marginTop: 10, fontSize: 14 },
  help: { marginTop: 14, color: '#9ca3af', fontSize: 13 },
}
