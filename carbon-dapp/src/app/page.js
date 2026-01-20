'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWatchContractEvent,
} from 'wagmi'
import { injected } from 'wagmi/connectors'

import { allowance20Abi } from '../abi/Allowance20'
import { cacRegistryAbi } from '../abi/CacRegistry'
import { marketV2Abi } from '../abi/CacMarketplaceV2'

const CAC = process.env.NEXT_PUBLIC_ALLOWANCE20_ADDRESS
const REG = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS
const MKT2 = process.env.NEXT_PUBLIC_MARKET_V2_ADDRESS

const ZERO_ADDR = '0x0000000000000000000000000000000000000000'
const isHexAddress = (x) => typeof x === 'string' && /^0x[0-9a-fA-F]{40}$/.test(x)

function nowSec() {
  return Math.floor(Date.now() / 1000)
}

function short(addr) {
  return addr ? addr.slice(0, 6) + '…' + addr.slice(-4) : ''
}

function normalizeListing(x) {
  // [id, seller, amountCAC, saleType, status, priceWei, reserveWei, buyoutWei, endTime, highestBidder, highestBid]
  if (Array.isArray(x)) {
    return {
      id: Number(x[0] ?? 0),
      seller: String(x[1]),
      amountCAC: x[2],
      saleType: x[3],
      status: x[4],
      priceWei: x[5],
      reserveWei: x[6],
      buyoutWei: x[7],
      endTime: x[8],
      highestBidder: x[9],
      highestBid: x[10],
    }
  }
  return {
    id: Number(x?.id ?? 0),
    seller: String(x?.seller),
    amountCAC: x?.amountCAC,
    saleType: x?.saleType,
    status: x?.status,
    priceWei: x?.priceWei,
    reserveWei: x?.reserveWei,
    buyoutWei: x?.buyoutWei,
    endTime: x?.endTime,
    highestBidder: x?.highestBidder,
    highestBid: x?.highestBid,
  }
}

function normalizeBuyOrder(x) {
  // [id, buyer, amountCAC, offerWei, status]
  if (Array.isArray(x)) {
    return {
      id: Number(x[0] ?? 0),
      buyer: String(x[1]),
      amountCAC: x[2],
      offerWei: x[3],
      status: x[4],
    }
  }
  return {
    id: Number(x?.id ?? 0),
    buyer: String(x?.buyer),
    amountCAC: x?.amountCAC,
    offerWei: x?.offerWei,
    status: x?.status,
  }
}

function normalizeBlind(x) {
  // [id, seller, amountCAC, reserveWei, buyoutWei, commitEndTime, revealEndTime, status, highestBidder, highestBid, commitCount]
  if (Array.isArray(x)) {
    return {
      id: Number(x[0] ?? 0),
      seller: String(x[1]),
      amountCAC: x[2],
      reserveWei: x[3],
      buyoutWei: x[4],
      commitEndTime: x[5],
      revealEndTime: x[6],
      status: x[7],
      highestBidder: x[8],
      highestBid: x[9],
      commitCount: x[10],
    }
  }
  return {
    id: Number(x?.id ?? 0),
    seller: String(x?.seller),
    amountCAC: x?.amountCAC,
    reserveWei: x?.reserveWei,
    buyoutWei: x?.buyoutWei,
    commitEndTime: x?.commitEndTime,
    revealEndTime: x?.revealEndTime,
    status: x?.status,
    highestBidder: x?.highestBidder,
    highestBid: x?.highestBid,
    commitCount: x?.commitCount,
  }
}

export default function Dashboard() {
  // SSR guard
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Wallet
  const { address, isConnected, status: accountStatus } = useAccount()
  const { connect, connectors, status: connectStatus, error: connectError } = useConnect()
  const { disconnect } = useDisconnect()

  const validCAC = isHexAddress(CAC)
  const validREG = isHexAddress(REG)
  const validMKT = isHexAddress(MKT2)

  const busy = !mounted || connectStatus !== 'idle' || accountStatus === 'reconnecting'

  function doConnect() {
    if (busy || isConnected) return
    const inj = connectors.find((c) => c.id === 'injected' || c.type === 'injected') || injected()
    connect({ connector: inj })
  }

  // CAC balance
  const { data: balance, refetch: refetchBal } = useReadContract({
    abi: allowance20Abi,
    address: validCAC ? CAC : undefined,
    functionName: 'balanceOf',
    args: mounted && address && validCAC ? [address] : undefined,
    query: { enabled: mounted && !!address && validCAC },
  })

  // Quota (remainingQuota)
  const { data: quota, refetch: refetchQuota } = useReadContract({
    abi: allowance20Abi,
    address: validCAC ? CAC : undefined,
    functionName: 'remainingQuota',
    args: mounted && address && validCAC ? [address] : undefined,
    query: { enabled: mounted && !!address && validCAC },
  })

  // KYC status (profiles -> [4] = kycApproved)
  const { data: myProfile, refetch: refetchProfile } = useReadContract({
    abi: cacRegistryAbi,
    address: validREG ? REG : undefined,
    functionName: 'profiles',
    args: mounted && address && validREG ? [address] : undefined,
    query: { enabled: mounted && !!address && validREG },
  })
  const isApproved = myProfile ? Boolean(myProfile[4]) : false

  // ---- Marketplace overview (V2) ----
  const { data: nextId, refetch: refetchNextId } = useReadContract({
    abi: marketV2Abi,
    address: validMKT ? MKT2 : undefined,
    functionName: 'nextId',
    query: { enabled: validMKT },
  })

  const sellIds = useMemo(() => {
    const n = nextId ? Number(nextId) : 0
    return n > 0 ? Array.from({ length: n }, (_, i) => i) : []
  }, [nextId])

  const { data: sellData, refetch: refetchSell } = useReadContracts({
    contracts: sellIds.map((id) => ({
      abi: marketV2Abi,
      address: MKT2,
      functionName: 'getListing',
      args: [BigInt(id)],
    })),
    query: { enabled: validMKT && sellIds.length > 0 },
  })

  const sellRows = useMemo(() => {
    if (!sellData) return []
    return sellData.map((r) => (r?.result ? normalizeListing(r.result) : null)).filter(Boolean)
  }, [sellData])

  const activeSellCount = useMemo(() => {
    const now = nowSec()
    return sellRows.filter((r) => {
      if (Number(r.status) !== 0) return false
      if (Number(r.saleType) === 0) return true
      return Number(r.endTime) > now
    }).length
  }, [sellRows])

  const { data: nextBuyId, refetch: refetchNextBuyId } = useReadContract({
    abi: marketV2Abi,
    address: validMKT ? MKT2 : undefined,
    functionName: 'nextBuyId',
    query: { enabled: validMKT },
  })

  const buyIds = useMemo(() => {
    const n = nextBuyId ? Number(nextBuyId) : 0
    return n > 0 ? Array.from({ length: n }, (_, i) => i) : []
  }, [nextBuyId])

  const { data: buyData, refetch: refetchBuy } = useReadContracts({
    contracts: buyIds.map((id) => ({
      abi: marketV2Abi,
      address: MKT2,
      functionName: 'getBuyOrder',
      args: [BigInt(id)],
    })),
    query: { enabled: validMKT && buyIds.length > 0 },
  })

  const buyRows = useMemo(() => {
    if (!buyData) return []
    return buyData.map((r) => (r?.result ? normalizeBuyOrder(r.result) : null)).filter(Boolean)
  }, [buyData])

  const activeBuyCount = useMemo(() => buyRows.filter((o) => Number(o.status) === 0).length, [buyRows])

  const { data: nextBlindId, refetch: refetchNextBlindId } = useReadContract({
    abi: marketV2Abi,
    address: validMKT ? MKT2 : undefined,
    functionName: 'nextBlindId',
    query: { enabled: validMKT },
  })

  const blindIds = useMemo(() => {
    const n = nextBlindId ? Number(nextBlindId) : 0
    return n > 0 ? Array.from({ length: n }, (_, i) => i) : []
  }, [nextBlindId])

  const { data: blindData, refetch: refetchBlind } = useReadContracts({
    contracts: blindIds.map((id) => ({
      abi: marketV2Abi,
      address: MKT2,
      functionName: 'getBlindAuction',
      args: [BigInt(id)],
    })),
    query: { enabled: validMKT && blindIds.length > 0 },
  })

  const blindRows = useMemo(() => {
    if (!blindData) return []
    return blindData.map((r) => (r?.result ? normalizeBlind(r.result) : null)).filter(Boolean)
  }, [blindData])

  const activeBlindCount = useMemo(() => blindRows.filter((a) => Number(a.status) === 0).length, [blindRows])

  // Refunds
  const { data: myRefund, refetch: refetchRefund } = useReadContract({
    abi: marketV2Abi,
    address: validMKT ? MKT2 : undefined,
    functionName: 'pendingRefund',
    args: mounted && address && validMKT ? [address] : undefined,
    query: { enabled: mounted && !!address && validMKT },
  })
  const refundWei = myRefund ?? 0n
  const canWithdraw = refundWei > 0n

  const { writeContract, isPending: isTxPending, error: txError, data: txHash } = useWriteContract()

  function withdrawRefund() {
    if (!canWithdraw || !validMKT) return
    writeContract({
      abi: marketV2Abi,
      address: MKT2,
      functionName: 'withdrawRefund',
      args: [],
    })
  }

  const periodId = new Date().getFullYear()
  const ZERO32 = '0x' + '00'.repeat(32)
  const evidenceURI = 'data:application/json;utf8,%7B%7D'

  const [sAmount, setSAmount] = useState('10')
  function doSurrender() {
    if (!sAmount || !isConnected || !validCAC) return
    const amt = BigInt(sAmount)
    if (amt <= 0n) return
    writeContract({
      abi: allowance20Abi,
      address: CAC,
      functionName: 'surrender',
      args: [amt, periodId, evidenceURI, ZERO32],
    })
  }

  const [tTo, setTTo] = useState('')
  const [tAmount, setTAmount] = useState('5')
  function doTransfer() {
    if (!tTo || !tAmount || !isConnected || !validCAC) return
    const amt = BigInt(tAmount)
    if (amt <= 0n) return
    writeContract({
      abi: allowance20Abi,
      address: CAC,
      functionName: 'transfer',
      args: [tTo, amt],
    })
  }

  const doRefetchAll = () => {
    refetchBal()
    refetchQuota()
    refetchProfile()
    refetchRefund()
    refetchNextId(); refetchSell()
    refetchNextBuyId(); refetchBuy()
    refetchNextBlindId(); refetchBlind()
  }

  useEffect(() => {
    if (!txHash) return
    doRefetchAll()
  }, [txHash])

  useWatchContractEvent({ abi: marketV2Abi, address: validMKT ? MKT2 : undefined, eventName: 'ListedFixed', onLogs: doRefetchAll })
  useWatchContractEvent({ abi: marketV2Abi, address: validMKT ? MKT2 : undefined, eventName: 'ListedAuction', onLogs: doRefetchAll })
  useWatchContractEvent({ abi: marketV2Abi, address: validMKT ? MKT2 : undefined, eventName: 'BuyOrderCreated', onLogs: doRefetchAll })
  useWatchContractEvent({ abi: marketV2Abi, address: validMKT ? MKT2 : undefined, eventName: 'ListedBlind', onLogs: doRefetchAll })
  useWatchContractEvent({ abi: marketV2Abi, address: validMKT ? MKT2 : undefined, eventName: 'Refunded', onLogs: doRefetchAll })

  useWatchContractEvent({
    abi: allowance20Abi,
    address: validCAC ? CAC : undefined,
    eventName: 'Surrendered',
    onLogs: () => { refetchBal(); refetchQuota() },
  })

  if (!mounted) return null

  return (
    <>
      <h1 className="page-title">Dashboard</h1>

      <div className="cards">
        {/* Wallet + KPI */}
        <section className="card col-4">
          <div className="kpi">
            {isConnected && balance !== undefined ? balance.toString() : '—'}
            <small>CAC balance</small>
          </div>

          <div className="subtle" style={{ marginTop: 8 }}>
            {isConnected ? <>Connected: <b>{short(address)}</b></> : 'Wallet not connected'}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            {!isConnected ? (
              <button className="btn" onClick={doConnect} disabled={busy}>
                {busy ? 'Please wait…' : 'Connect wallet'}
              </button>
            ) : (
              <button className="btn" onClick={() => disconnect()}>Disconnect</button>
            )}

            {isConnected && (
              <span className="subtle" style={{ fontSize: 12 }}>
                Quota: <b>{quota !== undefined ? quota.toString() : '…'}</b>
              </span>
            )}
          </div>

          {isConnected && (
            <div className="subtle" style={{ marginTop: 10 }}>
              KYC:{' '}
              <span className={`badge ${isApproved ? 'ok' : 'warn'}`}>
                {isApproved ? 'APPROVED' : 'PENDING/REJECTED'}
              </span>
            </div>
          )}

          {connectError && (
            <div style={{ color: 'crimson', fontSize: 12, marginTop: 10 }}>
              {connectError.message}
            </div>
          )}
        </section>

        {/* Marketplace overview */}
        <section className="card col-8">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ margin: 0 }}>Marketplace overview</h3>
              <div className="subtle" style={{ fontSize: 12, marginTop: 6 }}>
                Sell / Buy requests / Blind auctions • Refund kezelés itt is.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn" onClick={doRefetchAll} style={{ padding: '6px 10px' }}>
                Refresh
              </button>
              <button className="btn" onClick={withdrawRefund} disabled={!isConnected || isTxPending || !canWithdraw}>
                Withdraw refunds
              </button>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
              marginTop: 14,
            }}
          >
            <div className="card" style={{ padding: 14 }}>
              <div className="subtle" style={{ fontSize: 12 }}>Active sell listings</div>
              <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.1, marginTop: 6 }}>{activeSellCount}</div>
            </div>
            <div className="card" style={{ padding: 14 }}>
              <div className="subtle" style={{ fontSize: 12 }}>Active buy requests</div>
              <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.1, marginTop: 6 }}>{activeBuyCount}</div>
            </div>
            <div className="card" style={{ padding: 14 }}>
              <div className="subtle" style={{ fontSize: 12 }}>Active blind auctions</div>
              <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.1, marginTop: 6 }}>{activeBlindCount}</div>
            </div>
          </div>

          <div className="subtle" style={{ fontSize: 12, marginTop: 10 }}>
            nextId: {nextId !== undefined ? nextId.toString() : '…'} • nextBuyId: {nextBuyId !== undefined ? nextBuyId.toString() : '…'} • nextBlindId: {nextBlindId !== undefined ? nextBlindId.toString() : '…'}
          </div>
        </section>

        {/* Surrender */}
        <section className="card col-6">
          <h3 style={{ marginTop: 0 }}>Surrender credits</h3>
          <p className="subtle">Adj meg egy mennyiséget (egész CAC). A többi demo (auto).</p>

          <label>
            Amount (whole CAC)
            <input className="input" value={sAmount} onChange={(e) => setSAmount(e.target.value)} inputMode="numeric" />
          </label>

          <div className="subtle" style={{ marginTop: 8, fontSize: 12 }}>
            Period: {periodId} • Evidence: (auto)
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn"
              onClick={doSurrender}
              disabled={!isConnected || isTxPending || !sAmount || !isApproved}
              title={!isApproved ? 'KYC pending/rejected – surrender tiltva' : ''}
            >
              {isTxPending ? 'Submitting…' : 'Surrender now'}
            </button>
            {txError && <span style={{ color: 'crimson', fontSize: 12 }}>{txError.message}</span>}
          </div>
        </section>

        {/* Transfer */}
        <section className="card col-6">
          <h3 style={{ marginTop: 0 }}>Transfer credits</h3>
          <p className="subtle">Kreditek átküldése másik walletre (ERC-20 transfer).</p>

          <div className="grid grid-2">
            <label>
              Recipient address
              <input className="input" placeholder="0xrecipient…" value={tTo} onChange={(e) => setTTo(e.target.value)} />
            </label>
            <label>
              Amount
              <input className="input" value={tAmount} onChange={(e) => setTAmount(e.target.value)} inputMode="numeric" />
            </label>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            <button className="btn" onClick={doTransfer} disabled={!isConnected || isTxPending || !tTo || !tAmount}>
              {isTxPending ? 'Submitting…' : 'Transfer'}
            </button>
          </div>
        </section>
      </div>
    </>
  )
}
