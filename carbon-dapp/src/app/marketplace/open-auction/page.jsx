'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWatchContractEvent } from 'wagmi'
import { parseEther, formatEther } from 'viem'

import { allowance20Abi } from '../../../abi/Allowance20'
import { openAuctionMarketAbi } from '../../../abi/OpenAuctionMarket'
import { cmpBig, isHexAddress, nowSec, prettyError, shortAddr } from '../../../lib/marketplaceHelpers'

const CAC = process.env.NEXT_PUBLIC_ALLOWANCE20_ADDRESS
const AUCTION = process.env.NEXT_PUBLIC_MARKET_OPEN_AUCTION_ADDRESS

function normalizeAuction(x) {
  if (Array.isArray(x)) {
    return {
      id: Number(x[0] ?? 0),
      seller: String(x[1]),
      amountCAC: x[2],
      reserveWei: x[3],
      buyoutWei: x[4],
      endTime: x[5],
      status: Number(x[6]),
      highestBidder: String(x[7]),
      highestBid: x[8],
    }
  }
  return {
    id: Number(x.id ?? 0),
    seller: String(x.seller),
    amountCAC: x.amountCAC,
    reserveWei: x.reserveWei,
    buyoutWei: x.buyoutWei,
    endTime: x.endTime,
    status: Number(x.status),
    highestBidder: String(x.highestBidder),
    highestBid: x.highestBid,
  }
}

export default function MarketplaceOpenAuctionPage() {
  const { address, isConnected } = useAccount()
  const { writeContract, isPending, error: txError, data: txHash } = useWriteContract()

  const validCAC = isHexAddress(CAC)
  const validAuc = isHexAddress(AUCTION)
  const [notice, setNotice] = useState('')

  // CREATE
  const [auAmount, setAuAmount] = useState('10')
  const [auReserveEth, setAuReserveEth] = useState('0.05')
  const [auBuyoutEth, setAuBuyoutEth] = useState('0.3')
  const [auEndsInMins, setAuEndsInMins] = useState('60')

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    abi: allowance20Abi,
    address: validCAC ? CAC : undefined,
    functionName: 'allowance',
    args: address && validCAC ? [address, AUCTION] : undefined,
    query: { enabled: !!address && validCAC && validAuc },
  })

  function needAllowanceFor(amountStr) {
    if (allowance === undefined || allowance === null) return true
    try { return BigInt(allowance) < BigInt(amountStr || '0') } catch { return true }
  }

  function approve(amountStr) {
    setNotice('')
    if (!amountStr || !validCAC) return
    writeContract({ abi: allowance20Abi, address: CAC, functionName: 'approve', args: [AUCTION, BigInt(amountStr)] })
  }

  function listAuction() {
    setNotice('')
    if (!auAmount || !auReserveEth || !auEndsInMins) return
    if (needAllowanceFor(auAmount)) return

    const mins = Math.max(Number(auEndsInMins || '0'), 2)
    const bufferSec = 5
    const endTs = BigInt(nowSec() + mins * 60 + bufferSec)

    const reserve = parseEther(auReserveEth)
    const buyout = auBuyoutEth && Number(auBuyoutEth) > 0 ? parseEther(auBuyoutEth) : 0n

    writeContract({
      abi: openAuctionMarketAbi,
      address: AUCTION,
      functionName: 'listAuction',
      args: [BigInt(auAmount), reserve, buyout, endTs],
    })
  }

  // READ
  const { data: nextId, refetch: refetchNextId } = useReadContract({
    abi: openAuctionMarketAbi, address: validAuc ? AUCTION : undefined, functionName: 'nextId',
    query: { enabled: validAuc },
  })

  const ids = useMemo(() => {
    const n = nextId ? Number(nextId) : 0
    return n > 0 ? Array.from({ length: n }, (_, i) => i) : []
  }, [nextId])

  const { data: rows, refetch: refetchAuctions } = useReadContracts({
    contracts: ids.map((id) => ({ abi: openAuctionMarketAbi, address: AUCTION, functionName: 'auctions', args: [BigInt(id)] })),
    query: { enabled: validAuc && ids.length > 0 },
  })

  const all = useMemo(() => {
    if (!rows) return []
    return rows.map((r) => (r?.result ? normalizeAuction(r.result) : null)).filter(Boolean)
  }, [rows])

  const now = nowSec()
  const active = useMemo(() => all.filter((a) => a.status === 0 && Number(a.endTime) > now), [all, now])
  const endedActive = useMemo(() => all.filter((a) => a.status === 0 && Number(a.endTime) <= now && a.highestBidder && a.highestBidder !== '0x0000000000000000000000000000000000000000'), [all, now])

  // Refund
  const { data: myRefund, refetch: refetchRefund } = useReadContract({
    abi: openAuctionMarketAbi,
    address: validAuc ? AUCTION : undefined,
    functionName: 'pendingRefund',
    args: address ? [address] : undefined,
    query: { enabled: !!address && validAuc },
  })
  const refundWei = myRefund ?? 0n
  const canWithdraw = refundWei > 0n

  function withdrawRefund() {
    setNotice('')
    if (!canWithdraw) return
    writeContract({ abi: openAuctionMarketAbi, address: AUCTION, functionName: 'withdrawRefund', args: [] })
  }

  // Actions
  const [bidEthById, setBidEthById] = useState({})
  const bidInput = (id) => String(bidEthById[id] ?? '0.06')
  const setBidEth = (id, v) => setBidEthById((s) => ({ ...s, [id]: v }))

  function bid(id) {
    setNotice('')
    const eth = bidInput(id)
    if (!eth || Number(eth) <= 0) return
    writeContract({ abi: openAuctionMarketAbi, address: AUCTION, functionName: 'bid', args: [BigInt(id)], value: parseEther(eth) })
  }

  function finalize(id) {
    setNotice('')
    writeContract({ abi: openAuctionMarketAbi, address: AUCTION, functionName: 'finalize', args: [BigInt(id)] })
  }

  function cancel(id) {
    setNotice('')
    writeContract({ abi: openAuctionMarketAbi, address: AUCTION, functionName: 'cancel', args: [BigInt(id)] })
  }

  const doRefetchAll = () => { refetchAllowance(); refetchRefund(); refetchNextId(); refetchAuctions() }

  useWatchContractEvent({ abi: openAuctionMarketAbi, address: validAuc ? AUCTION : undefined, eventName: 'Listed', onLogs: doRefetchAll })
  useWatchContractEvent({ abi: openAuctionMarketAbi, address: validAuc ? AUCTION : undefined, eventName: 'BidPlaced', onLogs: doRefetchAll })
  useWatchContractEvent({ abi: openAuctionMarketAbi, address: validAuc ? AUCTION : undefined, eventName: 'Finalized', onLogs: doRefetchAll })
  useWatchContractEvent({ abi: openAuctionMarketAbi, address: validAuc ? AUCTION : undefined, eventName: 'Cancelled', onLogs: doRefetchAll })
  useWatchContractEvent({ abi: openAuctionMarketAbi, address: validAuc ? AUCTION : undefined, eventName: 'Refunded', onLogs: doRefetchAll })

  useEffect(() => { if (txHash) doRefetchAll() }, [txHash]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setInterval(doRefetchAll, 10000); return () => clearInterval(t) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!validAuc) {
    return (
      <div className="card">
        <b>Missing NEXT_PUBLIC_MARKET_OPEN_AUCTION_ADDRESS</b>
        <div className="subtle" style={{ marginTop: 8 }}><code>{String(AUCTION)}</code></div>
      </div>
    )
  }

  if (!isConnected) return <div className="card">Please connect your wallet.</div>
  const errText = prettyError(txError)

  return (
    <>
      <h1 className="page-title">Marketplace • Open auction</h1>

      <section className="card">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:12}}>
          <h2 style={{margin:0}}>Create auction</h2>
          <button className="btn" style={{padding:'4px 10px', fontSize:12}} onClick={doRefetchAll}>Refresh</button>
        </div>

        <div className="grid grid-2" style={{marginTop:10}}>
          <label>Amount (CAC)
            <input className="input" value={auAmount} onChange={(e) => setAuAmount(e.target.value)} />
          </label>
          <label>Ends in (minutes)
            <input className="input" value={auEndsInMins} onChange={(e) => setAuEndsInMins(e.target.value)} />
          </label>
        </div>

        <div className="grid grid-2" style={{marginTop:8}}>
          <label>Reserve price (ETH)
            <input className="input" value={auReserveEth} onChange={(e) => setAuReserveEth(e.target.value)} />
          </label>
          <label>Buyout (ETH, optional)
            <input className="input" value={auBuyoutEth} onChange={(e) => setAuBuyoutEth(e.target.value)} />
          </label>
        </div>

        <div style={{display:'flex', gap:10, marginTop:12, alignItems:'center', flexWrap:'wrap'}}>
          <button className="btn" onClick={() => approve(auAmount)} disabled={isPending || !auAmount || !validCAC}>Approve</button>
          <button className="btn primary" onClick={listAuction} disabled={isPending || needAllowanceFor(auAmount) || !auAmount}>List auction</button>

          <button className="btn" onClick={withdrawRefund} disabled={isPending || !canWithdraw}>
            Withdraw refunds {canWithdraw ? `(${formatEther(refundWei)} ETH)` : ''}
          </button>

          <span className="subtle" style={{fontSize:12}}>Allowance: {allowance !== undefined ? allowance.toString() : '…'}</span>
        </div>

        {!!notice && <div style={{marginTop:8}}>{notice}</div>}
        {!!errText && <div style={{color:'crimson', marginTop:8}}>{errText}</div>}
      </section>

      <section className="card" style={{marginTop:16}}>
        <h2 style={{margin:0}}>Active auctions</h2>
        <div className="subtle" style={{fontSize:12, marginTop:6}}>nextId: {nextId?.toString?.() ?? '…'} • loaded: {active.length}</div>

        {!active.length ? (
          <div style={{marginTop:10}}>No active auctions.</div>
        ) : (
          <div className="grid" style={{marginTop:10}}>
            {active.map((a) => {
              const mine = a.seller?.toLowerCase() === address?.toLowerCase()
              return (
                <div key={a.id} className="card" style={{padding:12}}>
                  <div><b>ID:</b> {a.id}</div>
                  <div><b>Seller:</b> {shortAddr(a.seller)}</div>
                  <div><b>Amount:</b> {String(a.amountCAC)} CAC</div>
                  <div><b>Reserve:</b> {formatEther(a.reserveWei || 0n)} ETH</div>
                  <div><b>Highest:</b> {a.highestBid && a.highestBid > 0n ? `${formatEther(a.highestBid)} ETH` : '—'}</div>

                  <div style={{display:'flex', gap:8, marginTop:10, flexWrap:'wrap', alignItems:'center'}}>
                    <input className="input" style={{maxWidth:140}} value={bidInput(a.id)} onChange={(e)=>setBidEth(a.id, e.target.value)} placeholder="0.06" />
                    <button className="btn primary" onClick={() => bid(a.id)} disabled={isPending}>Bid</button>
                    {mine && (
                      <button className="btn" onClick={() => cancel(a.id)} disabled={isPending || (a.highestBid && a.highestBid > 0n)}>
                        Cancel (only if no bids)
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {!!endedActive.length && (
        <section className="card" style={{marginTop:16}}>
          <h2 style={{margin:0}}>Ended auctions (finalize)</h2>
          <div className="subtle" style={{fontSize:12, marginTop:6}}>These are Active but already ended and have bids.</div>
          <div className="grid" style={{marginTop:10}}>
            {endedActive.map((a) => (
              <div key={`end-${a.id}`} className="card" style={{padding:12}}>
                <div><b>ID:</b> {a.id}</div>
                <div><b>Highest:</b> {formatEther(a.highestBid || 0n)} ETH • <b>Winner:</b> {shortAddr(a.highestBidder)}</div>
                <button className="btn primary" style={{marginTop:8}} onClick={() => finalize(a.id)} disabled={isPending}>Finalize</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
