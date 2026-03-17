'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWatchContractEvent,
} from 'wagmi'
import { parseEther, formatEther } from 'viem'

import { allowance20Abi } from '../../../abi/Allowance20'
import { dutchAuctionMarketAbi } from '../../../abi/DutchAuctionMarket'
import { isHexAddress, prettyError, cmpBig, shortAddr } from '../../../lib/marketplaceHelpers'

const CAC = process.env.NEXT_PUBLIC_ALLOWANCE20_ADDRESS
const DUTCH = process.env.NEXT_PUBLIC_MARKET_DUTCH_ADDRESS

// Avoid 21M fallback when estimateGas fails on some nodes
const SAFE_GAS = 800_000n

function normalizeDutch(x) {
  // auctions(id) returns tuple:
  // [id, seller, amountCAC, startPriceWei, endPriceWei, startTime, endTime, stepSec, status]
  if (Array.isArray(x)) {
    return {
      id: Number(x[0] ?? 0),
      seller: String(x[1]),
      amountCAC: x[2],
      startPriceWei: x[3],
      endPriceWei: x[4],
      startTime: Number(x[5] ?? 0),
      endTime: Number(x[6] ?? 0),
      stepSec: Number(x[7] ?? 0),
      status: Number(x[8] ?? 0),
    }
  }
  return {
    id: Number(x?.id ?? 0),
    seller: String(x?.seller),
    amountCAC: x?.amountCAC,
    startPriceWei: x?.startPriceWei,
    endPriceWei: x?.endPriceWei,
    startTime: Number(x?.startTime ?? 0),
    endTime: Number(x?.endTime ?? 0),
    stepSec: Number(x?.stepSec ?? 0),
    status: Number(x?.status ?? 0),
  }
}

function pad2(n) { return String(n).padStart(2, '0') }
function fmtHMS(sec) {
  const s = Math.max(0, Number(sec) || 0)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return `${pad2(h)}:${pad2(m)}:${pad2(r)}`
}

export default function MarketplaceDutchPage() {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const { writeContract, isPending, error: txError, data: txHash } = useWriteContract()

  const validCAC = isHexAddress(CAC)
  const validD = isHexAddress(DUTCH)

  const [notice, setNotice] = useState('')
  const [chainNow, setChainNow] = useState(null)

  // Keep a stable chain timestamp for countdowns (tab switch safe)
  useEffect(() => {
    let cancelled = false

    async function sync() {
      try {
        const b = await publicClient.getBlock()
        const ts = Number(b.timestamp)
        if (!cancelled) setChainNow(ts)
      } catch {
        // ignore
      }
    }

    sync()
    const t = setInterval(sync, 2000)
    return () => { cancelled = true; clearInterval(t) }
  }, [publicClient])

  const nowSec = () => (chainNow ?? Math.floor(Date.now() / 1000))

  // CREATE
  const [daAmount, setDaAmount] = useState('10')
  const [daStartEth, setDaStartEth] = useState('0.5')
  const [daEndEth, setDaEndEth] = useState('0.1')
  const [daDurationMins, setDaDurationMins] = useState('60')
  const [daStepSec, setDaStepSec] = useState('60') // price updates every N seconds

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    abi: allowance20Abi,
    address: validCAC ? CAC : undefined,
    functionName: 'allowance',
    args: address && validCAC ? [address, DUTCH] : undefined,
    query: { enabled: !!address && validCAC && validD },
  })

  function needAllowanceFor(amountStr) {
    if (allowance === undefined || allowance === null) return true
    try { return BigInt(allowance) < BigInt(amountStr || '0') } catch { return true }
  }

  function approve(amountStr) {
    setNotice('')
    if (!amountStr || !validCAC) return
    writeContract({
      abi: allowance20Abi,
      address: CAC,
      functionName: 'approve',
      args: [DUTCH, BigInt(amountStr)],
      gas: SAFE_GAS,
    })
  }

  async function listDutch() {
    setNotice('')
    if (!daAmount || !daStartEth || !daEndEth || !daDurationMins || !daStepSec) return
    if (needAllowanceFor(daAmount)) {
      setNotice('Approve needed first (allowance is lower than amount).')
      return
    }

    let startPriceWei, endPriceWei
    try {
      startPriceWei = parseEther(daStartEth)
      endPriceWei = parseEther(daEndEth)
    } catch {
      setNotice('Invalid ETH price input.')
      return
    }

    if (endPriceWei > startPriceWei) {
      setNotice('End price must be <= start price for dutch auction.')
      return
    }

    const durationSec = Math.max(2, Number(daDurationMins)) * 60
    const stepSec = Math.max(1, Number(daStepSec))

    if (stepSec > durationSec) {
      setNotice(`Step (${stepSec}s) cannot be greater than duration (${durationSec}s).`)
      return
    }

    // ABI-aligned call:
    // listDutch(amountCAC, startPriceWei, endPriceWei, durationSec, stepSec)
    writeContract({
      abi: dutchAuctionMarketAbi,
      address: DUTCH,
      functionName: 'listDutch',
      args: [BigInt(daAmount), startPriceWei, endPriceWei, durationSec, stepSec],
      gas: SAFE_GAS,
    })
  }

  // READ
  const { data: nextId, refetch: refetchNextId } = useReadContract({
    abi: dutchAuctionMarketAbi,
    address: validD ? DUTCH : undefined,
    functionName: 'nextId',
    query: { enabled: validD },
  })

  const ids = useMemo(() => {
    const n = nextId ? Number(nextId) : 0
    return n > 0 ? Array.from({ length: n }, (_, i) => i) : []
  }, [nextId])

  const { data: rows, refetch: refetchDutch } = useReadContracts({
    contracts: ids.map((id) => ({
      abi: dutchAuctionMarketAbi,
      address: DUTCH,
      functionName: 'auctions',
      args: [BigInt(id)],
    })),
    query: { enabled: validD && ids.length > 0 },
  })

  const all = useMemo(() => {
    if (!rows) return []
    return rows.map((r) => (r?.result ? normalizeDutch(r.result) : null)).filter(Boolean)
  }, [rows])

  const active = useMemo(() => all.filter((d) => d.status === 0), [all])

  const [sortBy, setSortBy] = useState('priceAsc')
  const shown = useMemo(() => {
    const s = active.slice()
    if (sortBy === 'priceAsc') s.sort((a, b) => cmpBig(a.endPriceWei || 0n, b.endPriceWei || 0n))
    else if (sortBy === 'priceDesc') s.sort((a, b) => cmpBig(b.startPriceWei || 0n, a.startPriceWei || 0n))
    else if (sortBy === 'new') s.sort((a, b) => b.id - a.id)
    return s
  }, [active, sortBy])

  function buyNow(id, payWei) {
    setNotice('')
    writeContract({
      abi: dutchAuctionMarketAbi,
      address: DUTCH,
      functionName: 'buy',
      args: [BigInt(id)],
      value: payWei,
      gas: SAFE_GAS,
    })
  }

  function cancel(id) {
    setNotice('')
    writeContract({
      abi: dutchAuctionMarketAbi,
      address: DUTCH,
      functionName: 'cancel',
      args: [BigInt(id)],
      gas: SAFE_GAS,
    })
  }

  const doRefetchAll = () => { refetchAllowance(); refetchNextId(); refetchDutch() }

  useWatchContractEvent({ abi: dutchAuctionMarketAbi, address: validD ? DUTCH : undefined, eventName: 'Listed', onLogs: doRefetchAll })
  useWatchContractEvent({ abi: dutchAuctionMarketAbi, address: validD ? DUTCH : undefined, eventName: 'Bought', onLogs: doRefetchAll })
  useWatchContractEvent({ abi: dutchAuctionMarketAbi, address: validD ? DUTCH : undefined, eventName: 'Cancelled', onLogs: doRefetchAll })

  useEffect(() => { if (txHash) doRefetchAll() }, [txHash]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setInterval(doRefetchAll, 10000); return () => clearInterval(t) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!validD) {
    return (
      <div className="card">
        <b>Missing NEXT_PUBLIC_MARKET_DUTCH_ADDRESS</b>
        <div className="subtle" style={{ marginTop: 8 }}>
          <code>{String(DUTCH)}</code>
        </div>
      </div>
    )
  }

  if (!isConnected) return <div className="card">Please connect your wallet.</div>
  const errText = prettyError(txError)

  function DutchCard({ d }) {
    const now = nowSec()
    const startsIn = d.startTime - now
    const endsIn = d.endTime - now

    // Poll currentPrice moderately
    const { data: curPrice } = useReadContract({
      abi: dutchAuctionMarketAbi,
      address: DUTCH,
      functionName: 'currentPrice',
      args: [BigInt(d.id)],
      query: { enabled: validD, refetchInterval: 2000 },
    })

    // Clamp display: before start show startPrice, after end show endPrice
    let payWei = d.startPriceWei ?? 0n
    if (startsIn <= 0 && endsIn > 0) payWei = curPrice ?? (d.startPriceWei ?? 0n)
    if (endsIn <= 0) payWei = d.endPriceWei ?? (curPrice ?? 0n)

    const isMine = String(d.seller).toLowerCase() === address?.toLowerCase()

    return (
      <div className="card" style={{ padding: 12 }}>
        <div><b>ID:</b> {d.id}</div>
        <div><b>Seller:</b> {shortAddr(d.seller)}</div>
        <div><b>Amount:</b> {d.amountCAC?.toString?.() || String(d.amountCAC)} CAC</div>
        <div><b>Start:</b> {formatEther(d.startPriceWei || 0n)} ETH</div>
        <div><b>End:</b> {formatEther(d.endPriceWei || 0n)} ETH</div>
        <div><b>Step:</b> {d.stepSec || 0}s</div>

        <div style={{ marginTop: 6, padding: 10, borderRadius: 12, background: 'rgba(255,255,255,0.04)' }}>
          <div className="subtle" style={{ fontSize: 12 }}>Current price</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{formatEther(payWei)} ETH</div>
          <div className="subtle" style={{ fontSize: 12 }}>
            {startsIn > 0 ? `Starts in: ${fmtHMS(startsIn)}` : `Ends in: ${fmtHMS(endsIn)}`}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <button className="btn primary" onClick={() => buyNow(d.id, payWei)} disabled={isPending || startsIn > 0 || endsIn <= 0}>
            Buy now ({formatEther(payWei)} ETH)
          </button>
          {isMine && (
            <button className="btn" onClick={() => cancel(d.id)} disabled={isPending}>
              Cancel
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <h1 className="page-title">Marketplace • Dutch auction</h1>

      <div className="cards">
        <div className="col-8">
          <section className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <h2 style={{ margin: 0 }}>Create dutch auction</h2>
              <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={doRefetchAll}>
                Refresh
              </button>
            </div>

            <div className="subtle" style={{ fontSize: 12, marginTop: 6 }}>
              Chain time: {chainNow ? `${chainNow}` : '…'}
            </div>

            <div className="grid grid-2" style={{ marginTop: 10 }}>
              <label>Amount (CAC)
                <input className="input" value={daAmount} onChange={(e) => setDaAmount(e.target.value)} />
              </label>
              <label>Duration (minutes)
                <input className="input" value={daDurationMins} onChange={(e) => setDaDurationMins(e.target.value)} />
              </label>
            </div>

            <div className="grid grid-2" style={{ marginTop: 8 }}>
              <label>Start price (ETH)
                <input className="input" value={daStartEth} onChange={(e) => setDaStartEth(e.target.value)} />
              </label>
              <label>End price (ETH)
                <input className="input" value={daEndEth} onChange={(e) => setDaEndEth(e.target.value)} />
              </label>
            </div>

            <div className="grid grid-2" style={{ marginTop: 8 }}>
              <label>Step (seconds)
                <input className="input" value={daStepSec} onChange={(e) => setDaStepSec(e.target.value)} />
              </label>
              <div />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => approve(daAmount)} disabled={isPending || !daAmount || !validCAC}>
                Approve
              </button>
              <button className="btn primary" onClick={listDutch} disabled={isPending || needAllowanceFor(daAmount) || !daAmount}>
                Create dutch
              </button>
              <span className="subtle" style={{ fontSize: 12 }}>
                Allowance: {allowance !== undefined ? allowance.toString() : '…'}
              </span>
            </div>

            {!!notice && <div style={{ marginTop: 8 }}>{notice}</div>}
            {!!errText && <div style={{ color: 'crimson', marginTop: 8 }}>{errText}</div>}
          </section>

          <section className="card" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ margin: 0 }}>Active dutch auctions</h2>
                <div className="subtle" style={{ fontSize: 12 }}>
                  nextId: {nextId !== undefined ? nextId.toString() : '…'} • loaded: {active.length}
                </div>
              </div>

              <select
                className="input"
                style={{ maxWidth: 220, color: 'var(--text)', background: 'var(--panel)' }}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option style={{ color: '#111', background: '#fff' }} value="priceAsc">End price ↑</option>
                <option style={{ color: '#111', background: '#fff' }} value="priceDesc">Start price ↓</option>
                <option style={{ color: '#111', background: '#fff' }} value="new">Newest</option>
              </select>
            </div>

            {!shown.length ? (
              <div style={{ marginTop: 10 }}>No active dutch auctions.</div>
            ) : (
              <div className="grid" style={{ marginTop: 10 }}>
                {shown.map((d) => <DutchCard key={`dutch-${d.id}`} d={d} />)}
              </div>
            )}
          </section>
        </div>

        <div className="col-4">
          <section className="card">
            <h3>Notes</h3>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>Calls ABI-aligned listDutch(amount,start,end,duration,step).</li>
              <li>Countdown uses chain timestamp (tab switch safe).</li>
              <li>Displayed price is clamped before start / after end.</li>
            </ul>
          </section>
        </div>
      </div>
    </>
  )
}
