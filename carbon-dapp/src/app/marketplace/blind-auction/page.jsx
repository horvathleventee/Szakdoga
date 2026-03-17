'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWatchContractEvent } from 'wagmi'
import { parseEther, formatEther, keccak256, encodePacked } from 'viem'

import { allowance20Abi } from '../../../abi/Allowance20'
import { blindAuctionMarketAbi } from '../../../abi/BlindAuctionMarket'
import { isHexAddress, nowSec, prettyError, shortAddr } from '../../../lib/marketplaceHelpers'

const CAC = process.env.NEXT_PUBLIC_ALLOWANCE20_ADDRESS
const BLIND = process.env.NEXT_PUBLIC_MARKET_BLIND_AUCTION_ADDRESS

function genSalt32() {
  const a = new Uint8Array(32)
  crypto.getRandomValues(a)
  return '0x' + Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function normalizeBlind(x) {
  if (Array.isArray(x)) {
    return {
      id: Number(x[0] ?? 0),
      seller: String(x[1]),
      amountCAC: x[2],
      reserveWei: x[3],
      buyoutWei: x[4],
      commitEndTime: x[5],
      revealEndTime: x[6],
      status: Number(x[7]),
      highestBidder: String(x[8]),
      highestBid: x[9],
      commitCount: x[10],
    }
  }
  return {
    id: Number(x.id ?? 0),
    seller: String(x.seller),
    amountCAC: x.amountCAC,
    reserveWei: x.reserveWei,
    buyoutWei: x.buyoutWei,
    commitEndTime: x.commitEndTime,
    revealEndTime: x.revealEndTime,
    status: Number(x.status),
    highestBidder: String(x.highestBidder),
    highestBid: x.highestBid,
    commitCount: x.commitCount,
  }
}

export default function MarketplaceBlindAuctionPage() {
  const { address, isConnected } = useAccount()
  const { writeContract, isPending, error: txError, data: txHash } = useWriteContract()

  const validCAC = isHexAddress(CAC)
  const validB = isHexAddress(BLIND)
  const [notice, setNotice] = useState('')

  // CREATE
  const [blAmount, setBlAmount] = useState('10')
  const [blReserveEth, setBlReserveEth] = useState('0.05')
  const [blBuyoutEth, setBlBuyoutEth] = useState('0')
  const [blCommitMins, setBlCommitMins] = useState('10')
  const [blRevealMins, setBlRevealMins] = useState('10')

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    abi: allowance20Abi,
    address: validCAC ? CAC : undefined,
    functionName: 'allowance',
    args: address && validCAC ? [address, BLIND] : undefined,
    query: { enabled: !!address && validCAC && validB },
  })

  function needAllowanceFor(amountStr) {
    if (allowance === undefined || allowance === null) return true
    try { return BigInt(allowance) < BigInt(amountStr || '0') } catch { return true }
  }

  function approve(amountStr) {
    setNotice('')
    if (!amountStr || !validCAC) return
    writeContract({ abi: allowance20Abi, address: CAC, functionName: 'approve', args: [BLIND, BigInt(amountStr)] })
  }

  function listBlind() {
    setNotice('')
    if (!blAmount || !blReserveEth || !blCommitMins || !blRevealMins) return
    if (needAllowanceFor(blAmount)) return

    const commitM = Math.max(Number(blCommitMins || '0'), 2)
    const revealM = Math.max(Number(blRevealMins || '0'), 2)
    const bufferSec = 5

    const commitEnd = BigInt(nowSec() + commitM * 60 + bufferSec)
    const revealEnd = BigInt(nowSec() + (commitM + revealM) * 60 + bufferSec)

    const reserve = parseEther(blReserveEth)
    const buyout = blBuyoutEth && Number(blBuyoutEth) > 0 ? parseEther(blBuyoutEth) : 0n

    writeContract({
      abi: blindAuctionMarketAbi,
      address: BLIND,
      functionName: 'listBlindAuction',
      args: [BigInt(blAmount), reserve, buyout, commitEnd, revealEnd],
    })
  }

  // READ
  const { data: nextId, refetch: refetchNextId } = useReadContract({
    abi: blindAuctionMarketAbi,
    address: validB ? BLIND : undefined,
    functionName: 'nextId',
    query: { enabled: validB },
  })

  const ids = useMemo(() => {
    const n = nextId ? Number(nextId) : 0
    return n > 0 ? Array.from({ length: n }, (_, i) => i) : []
  }, [nextId])

  const { data: rows, refetch: refetchBlind } = useReadContracts({
    contracts: ids.map((id) => ({ abi: blindAuctionMarketAbi, address: BLIND, functionName: 'auctions', args: [BigInt(id)] })),
    query: { enabled: validB && ids.length > 0 },
  })

  const all = useMemo(() => {
    if (!rows) return []
    return rows.map((r) => (r?.result ? normalizeBlind(r.result) : null)).filter(Boolean)
  }, [rows])

  const active = useMemo(() => all.filter((a) => a.status === 0), [all])

  // Refund
  const { data: myRefund, refetch: refetchRefund } = useReadContract({
    abi: blindAuctionMarketAbi,
    address: validB ? BLIND : undefined,
    functionName: 'pendingRefund',
    args: address ? [address] : undefined,
    query: { enabled: !!address && validB },
  })
  const refundWei = myRefund ?? 0n
  const canWithdraw = refundWei > 0n

  function withdrawRefund() {
    setNotice('')
    if (!canWithdraw) return
    writeContract({ abi: blindAuctionMarketAbi, address: BLIND, functionName: 'withdrawRefund', args: [] })
  }

  // Actions (commit/reveal)
  const [blindBidEthById, setBlindBidEthById] = useState({})
  const setBlindBid = (id, v) => setBlindBidEthById((s) => ({ ...s, [id]: v }))
  const bidInput = (id) => String(blindBidEthById[id] ?? '')

  function blindStorageKey(id) {
    return `cac_blind_${BLIND}_${address}_${id}`
  }

  function commit(id) {
    setNotice('')
    const bidEth = bidInput(id)
    if (!bidEth || Number(bidEth) <= 0) {
      setNotice('Enter a bid amount in ETH (commit).')
      return
    }

    const bidWei = parseEther(bidEth)
    const salt = genSalt32()
    const commitment = keccak256(encodePacked(['uint256', 'bytes32', 'address'], [bidWei, salt, address]))

    localStorage.setItem(blindStorageKey(id), JSON.stringify({ bidEth, salt }))

    writeContract({
      abi: blindAuctionMarketAbi,
      address: BLIND,
      functionName: 'commitBid',
      args: [BigInt(id), commitment],
      value: bidWei, // deposit
    })
  }

  function reveal(id) {
    setNotice('')
    const raw = localStorage.getItem(blindStorageKey(id))
    if (!raw) {
      setNotice('No stored salt/bid for this auction in this browser (saved on commit).')
      return
    }
    let parsed
    try { parsed = JSON.parse(raw) } catch { setNotice('Bad localStorage data. Commit again.'); return }

    const bidWei = parseEther(String(parsed.bidEth))
    const salt = parsed.salt

    writeContract({
      abi: blindAuctionMarketAbi,
      address: BLIND,
      functionName: 'revealBid',
      args: [BigInt(id), bidWei, salt],
    })
  }

  function finalize(id) {
    setNotice('')
    writeContract({ abi: blindAuctionMarketAbi, address: BLIND, functionName: 'finalize', args: [BigInt(id)] })
  }

  function cancel(id) {
    setNotice('')
    writeContract({ abi: blindAuctionMarketAbi, address: BLIND, functionName: 'cancel', args: [BigInt(id)] })
  }

  function prepareUnrevealedRefund(id) {
    setNotice('')
    writeContract({ abi: blindAuctionMarketAbi, address: BLIND, functionName: 'prepareUnrevealedRefund', args: [BigInt(id)] })
  }

  const doRefetchAll = () => { refetchAllowance(); refetchRefund(); refetchNextId(); refetchBlind() }

  useWatchContractEvent({ abi: blindAuctionMarketAbi, address: validB ? BLIND : undefined, eventName: 'Listed', onLogs: doRefetchAll })
  useWatchContractEvent({ abi: blindAuctionMarketAbi, address: validB ? BLIND : undefined, eventName: 'Committed', onLogs: doRefetchAll })
  useWatchContractEvent({ abi: blindAuctionMarketAbi, address: validB ? BLIND : undefined, eventName: 'Revealed', onLogs: doRefetchAll })
  useWatchContractEvent({ abi: blindAuctionMarketAbi, address: validB ? BLIND : undefined, eventName: 'Finalized', onLogs: doRefetchAll })
  useWatchContractEvent({ abi: blindAuctionMarketAbi, address: validB ? BLIND : undefined, eventName: 'Cancelled', onLogs: doRefetchAll })
  useWatchContractEvent({ abi: blindAuctionMarketAbi, address: validB ? BLIND : undefined, eventName: 'UnrevealedRefundPrepared', onLogs: doRefetchAll })
  useWatchContractEvent({ abi: blindAuctionMarketAbi, address: validB ? BLIND : undefined, eventName: 'Refunded', onLogs: doRefetchAll })

  useEffect(() => { if (txHash) doRefetchAll() }, [txHash]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setInterval(doRefetchAll, 10000); return () => clearInterval(t) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!validB) {
    return (
      <div className="card">
        <b>Missing NEXT_PUBLIC_MARKET_BLIND_AUCTION_ADDRESS</b>
        <div className="subtle" style={{ marginTop: 8 }}><code>{String(BLIND)}</code></div>
      </div>
    )
  }

  if (!isConnected) return <div className="card">Please connect your wallet.</div>
  const errText = prettyError(txError)
  const now = nowSec()

  const phaseText = (a) => {
    const ce = Number(a.commitEndTime || 0)
    const re = Number(a.revealEndTime || 0)
    if (now < ce) return 'Commit phase'
    if (now < re) return 'Reveal phase'
    return 'Ended'
  }

  return (
    <>
      <h1 className="page-title">Marketplace • Blind auction</h1>

      <section className="card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
          <h2 style={{ margin:0 }}>Create blind auction</h2>
          <button className="btn" style={{ padding:'4px 10px', fontSize:12 }} onClick={doRefetchAll}>Refresh</button>
        </div>

        <div className="grid grid-2" style={{ marginTop:10 }}>
          <label>Amount (CAC)
            <input className="input" value={blAmount} onChange={(e)=>setBlAmount(e.target.value)} />
          </label>
          <label>Reserve (ETH)
            <input className="input" value={blReserveEth} onChange={(e)=>setBlReserveEth(e.target.value)} />
          </label>
        </div>

        <div className="grid grid-2" style={{ marginTop:8 }}>
          <label>Commit minutes
            <input className="input" value={blCommitMins} onChange={(e)=>setBlCommitMins(e.target.value)} />
          </label>
          <label>Reveal minutes
            <input className="input" value={blRevealMins} onChange={(e)=>setBlRevealMins(e.target.value)} />
          </label>
        </div>

        <div className="grid grid-2" style={{ marginTop:8 }}>
          <label>Buyout (ETH, optional)
            <input className="input" value={blBuyoutEth} onChange={(e)=>setBlBuyoutEth(e.target.value)} />
          </label>
          <div className="subtle" style={{ fontSize:12, alignSelf:'end' }}>
            Commit = deposit now, Reveal = show bid+salt later.
          </div>
        </div>

        <div style={{ display:'flex', gap:10, marginTop:12, alignItems:'center', flexWrap:'wrap' }}>
          <button className="btn" onClick={() => approve(blAmount)} disabled={isPending || !blAmount || !validCAC}>Approve</button>
          <button className="btn primary" onClick={listBlind} disabled={isPending || needAllowanceFor(blAmount) || !blAmount}>List</button>

          <button className="btn" onClick={withdrawRefund} disabled={isPending || !canWithdraw}>
            Withdraw refunds {canWithdraw ? `(${formatEther(refundWei)} ETH)` : ''}
          </button>

          <span className="subtle" style={{ fontSize:12 }}>Allowance: {allowance !== undefined ? allowance.toString() : '…'}</span>
        </div>

        {!!notice && <div style={{ marginTop:8 }}>{notice}</div>}
        {!!errText && <div style={{ color:'crimson', marginTop:8 }}>{errText}</div>}
      </section>

      <section className="card" style={{ marginTop:16 }}>
        <h2 style={{ margin:0 }}>Active blind auctions</h2>
        <div className="subtle" style={{ fontSize:12, marginTop:6 }}>nextId: {nextId?.toString?.() ?? '…'} • loaded: {active.length}</div>

        {!active.length ? (
          <div style={{ marginTop:10 }}>No active blind auctions.</div>
        ) : (
          <div className="grid" style={{ marginTop:10 }}>
            {active.map((a) => {
              const mine = a.seller?.toLowerCase() === address?.toLowerCase()
              return (
                <div key={`blind-${a.id}`} className="card" style={{ padding:12 }}>
                  <div><b>ID:</b> {a.id} • <span className="subtle">{phaseText(a)}</span></div>
                  <div><b>Seller:</b> {shortAddr(a.seller)}</div>
                  <div><b>Amount:</b> {String(a.amountCAC)} CAC</div>
                  <div><b>Reserve:</b> {formatEther(a.reserveWei || 0n)} ETH</div>
                  <div><b>Highest revealed:</b> {a.highestBid && a.highestBid > 0n ? `${formatEther(a.highestBid)} ETH` : '—'}</div>

                  <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap', alignItems:'center' }}>
                    <input className="input" style={{ maxWidth:140 }} value={bidInput(a.id)} onChange={(e)=>setBlindBid(a.id, e.target.value)} placeholder="0.08" />
                    <button className="btn primary" onClick={() => commit(a.id)} disabled={isPending}>Commit</button>
                    <button className="btn" onClick={() => reveal(a.id)} disabled={isPending}>Reveal</button>
                    <button className="btn" onClick={() => prepareUnrevealedRefund(a.id)} disabled={isPending}>Prepare unrevealed refund</button>
                    <button className="btn primary" onClick={() => finalize(a.id)} disabled={isPending}>Finalize</button>
                    {mine && <button className="btn" onClick={() => cancel(a.id)} disabled={isPending || Number(a.commitCount) > 0}>Cancel (only if no commits)</button>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}
