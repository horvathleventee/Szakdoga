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

// ✅ 7 market ABI-k
import { fixedMarketAbi } from '../abi/FixedMarket'
import { openAuctionMarketAbi } from '../abi/OpenAuctionMarket'
import { buyOrderMarketAbi } from '../abi/BuyOrderMarket'
import { blindAuctionMarketAbi } from '../abi/BlindAuctionMarket'
import { dutchAuctionMarketAbi } from '../abi/DutchAuctionMarket'
import { bundleSaleMarketAbi } from '../abi/BundleSaleMarket'
import { directOfferMarketAbi } from '../abi/DirectOfferMarket'

// ENV
const CAC = process.env.NEXT_PUBLIC_ALLOWANCE20_ADDRESS
const REG = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS
const FIXED = process.env.NEXT_PUBLIC_MARKET_FIXED_ADDRESS
const OPENA = process.env.NEXT_PUBLIC_MARKET_OPEN_AUCTION_ADDRESS
const BUY = process.env.NEXT_PUBLIC_MARKET_BUY_ORDER_ADDRESS
const BLIND = process.env.NEXT_PUBLIC_MARKET_BLIND_AUCTION_ADDRESS
const DUTCH = process.env.NEXT_PUBLIC_MARKET_DUTCH_ADDRESS
const BUNDLE = process.env.NEXT_PUBLIC_MARKET_BUNDLE_ADDRESS
const OFFER = process.env.NEXT_PUBLIC_MARKET_OFFER_ADDRESS

const isHexAddress = (x) => typeof x === 'string' && /^0x[0-9a-fA-F]{40}$/.test(x)

function nowSec() {
  return Math.floor(Date.now() / 1000)
}
function short(addr) {
  return addr ? addr.slice(0, 6) + '…' + addr.slice(-4) : ''
}

// ----------------- normalizers -----------------

function normFixed(x) {
  // listings: [id, seller, amountCAC, priceWei, status]
  if (Array.isArray(x)) return { id: Number(x[0]), status: Number(x[4]) }
  return { id: Number(x?.id ?? 0), status: Number(x?.status ?? 0) }
}

function normOpenAuction(x) {
  // auctions: [id, seller, amountCAC, reserveWei, buyoutWei, endTime, status, highestBidder, highestBid]
  if (Array.isArray(x)) return { id: Number(x[0]), endTime: Number(x[5]), status: Number(x[6]) }
  return { id: Number(x?.id ?? 0), endTime: Number(x?.endTime ?? 0), status: Number(x?.status ?? 0) }
}

function normBuyOrder(x) {
  // orders: [id, buyer, amountCAC, offerWei, status]
  if (Array.isArray(x)) return { id: Number(x[0]), status: Number(x[4]) }
  return { id: Number(x?.id ?? 0), status: Number(x?.status ?? 0) }
}

function normBlind(x) {
  // auctions: [id, seller, amountCAC, reserveWei, buyoutWei, commitEndTime, revealEndTime, status, ...]
  if (Array.isArray(x)) return { id: Number(x[0]), status: Number(x[7]) }
  return { id: Number(x?.id ?? 0), status: Number(x?.status ?? 0) }
}

function normDutch(x) {
  // ✅ NEW dutch struct:
  // [id, seller, amountCAC, startPriceWei, endPriceWei, startTime, endTime, stepSec, status]
  if (Array.isArray(x)) return { id: Number(x[0]), endTime: Number(x[6]), status: Number(x[8]) }
  return { id: Number(x?.id ?? 0), endTime: Number(x?.endTime ?? 0), status: Number(x?.status ?? 0) }
}

function normBundleFromGetBundle(x) {
  // ✅ Tieres bundle: getBundle(id) -> (id, seller, totalCAC, remainingCAC, tierCount, status)
  if (Array.isArray(x)) return { id: Number(x[0]), status: Number(x[5]) }
  return { id: Number(x?.id ?? 0), status: Number(x?.status ?? 0) }
}

function normOffer(x) {
  // offers: last field is status
  if (Array.isArray(x)) return { id: Number(x[0]), status: Number(x[x.length - 1]) }
  return { id: Number(x?.id ?? 0), status: Number(x?.status ?? 0) }
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

  const validFIXED = isHexAddress(FIXED)
  const validOPENA = isHexAddress(OPENA)
  const validBUY = isHexAddress(BUY)
  const validBLIND = isHexAddress(BLIND)
  const validDUTCH = isHexAddress(DUTCH)
  const validBUNDLE = isHexAddress(BUNDLE)
  const validOFFER = isHexAddress(OFFER)

  const busy = !mounted || connectStatus !== 'idle' || accountStatus === 'reconnecting'

  function doConnect() {
    if (busy || isConnected) return
    const inj = connectors.find((c) => c.id === 'injected' || c.type === 'injected') || injected()
    connect({ connector: inj })
  }

  // ✅ ONE writeContract only (don’t duplicate)
  const { writeContract, isPending: isTxPending, error: txError, data: txHash } = useWriteContract()

  // CAC balance
  const { data: balance, refetch: refetchBal } = useReadContract({
    abi: allowance20Abi,
    address: validCAC ? CAC : undefined,
    functionName: 'balanceOf',
    args: mounted && address && validCAC ? [address] : undefined,
    query: { enabled: mounted && !!address && validCAC },
  })

  // Quota
  const { data: quota, refetch: refetchQuota } = useReadContract({
    abi: allowance20Abi,
    address: validCAC ? CAC : undefined,
    functionName: 'remainingQuota',
    args: mounted && address && validCAC ? [address] : undefined,
    query: { enabled: mounted && !!address && validCAC },
  })

  // KYC status
  const { data: myProfile, refetch: refetchProfile } = useReadContract({
    abi: cacRegistryAbi,
    address: validREG ? REG : undefined,
    functionName: 'profiles',
    args: mounted && address && validREG ? [address] : undefined,
    query: { enabled: mounted && !!address && validREG },
  })
  const isApproved = myProfile ? Boolean(myProfile[4]) : false

  // ---------------- MARKET COUNTERS ----------------

  // Fixed
  const { data: fixedNextId, refetch: refetchFixedNextId } = useReadContract({
    abi: fixedMarketAbi,
    address: validFIXED ? FIXED : undefined,
    functionName: 'nextId',
    query: { enabled: validFIXED },
  })
  const fixedIds = useMemo(() => {
    const n = fixedNextId ? Number(fixedNextId) : 0
    return n > 0 ? Array.from({ length: n }, (_, i) => i) : []
  }, [fixedNextId])
  const { data: fixedRows, refetch: refetchFixedRows } = useReadContracts({
    contracts: fixedIds.map((id) => ({
      abi: fixedMarketAbi,
      address: FIXED,
      functionName: 'listings',
      args: [BigInt(id)],
    })),
    query: { enabled: validFIXED && fixedIds.length > 0 },
  })
  const activeFixedCount = useMemo(() => {
    if (!fixedRows) return 0
    return fixedRows.map((r) => (r?.result ? normFixed(r.result) : null)).filter(Boolean).filter((x) => x.status === 0).length
  }, [fixedRows])

  // Open auction
  const { data: openNextId, refetch: refetchOpenNextId } = useReadContract({
    abi: openAuctionMarketAbi,
    address: validOPENA ? OPENA : undefined,
    functionName: 'nextId',
    query: { enabled: validOPENA },
  })
  const openIds = useMemo(() => {
    const n = openNextId ? Number(openNextId) : 0
    return n > 0 ? Array.from({ length: n }, (_, i) => i) : []
  }, [openNextId])
  const { data: openRows, refetch: refetchOpenRows } = useReadContracts({
    contracts: openIds.map((id) => ({
      abi: openAuctionMarketAbi,
      address: OPENA,
      functionName: 'auctions',
      args: [BigInt(id)],
    })),
    query: { enabled: validOPENA && openIds.length > 0 },
  })
  const activeOpenCount = useMemo(() => {
    if (!openRows) return 0
    const now = nowSec()
    return openRows
      .map((r) => (r?.result ? normOpenAuction(r.result) : null))
      .filter(Boolean)
      .filter((x) => x.status === 0 && (!x.endTime || x.endTime > now)).length
  }, [openRows])

  // Buy order
  const { data: buyNextId, refetch: refetchBuyNextId } = useReadContract({
    abi: buyOrderMarketAbi,
    address: validBUY ? BUY : undefined,
    functionName: 'nextId',
    query: { enabled: validBUY },
  })
  const buyIds = useMemo(() => {
    const n = buyNextId ? Number(buyNextId) : 0
    return n > 0 ? Array.from({ length: n }, (_, i) => i) : []
  }, [buyNextId])
  const { data: buyRows, refetch: refetchBuyRows } = useReadContracts({
    contracts: buyIds.map((id) => ({
      abi: buyOrderMarketAbi,
      address: BUY,
      functionName: 'orders',
      args: [BigInt(id)],
    })),
    query: { enabled: validBUY && buyIds.length > 0 },
  })
  const activeBuyCount = useMemo(() => {
    if (!buyRows) return 0
    return buyRows.map((r) => (r?.result ? normBuyOrder(r.result) : null)).filter(Boolean).filter((x) => x.status === 0).length
  }, [buyRows])

  // Blind auction
  const { data: blindNextId, refetch: refetchBlindNextId } = useReadContract({
    abi: blindAuctionMarketAbi,
    address: validBLIND ? BLIND : undefined,
    functionName: 'nextId',
    query: { enabled: validBLIND },
  })
  const blindIds = useMemo(() => {
    const n = blindNextId ? Number(blindNextId) : 0
    return n > 0 ? Array.from({ length: n }, (_, i) => i) : []
  }, [blindNextId])
  const { data: blindRows, refetch: refetchBlindRows } = useReadContracts({
    contracts: blindIds.map((id) => ({
      abi: blindAuctionMarketAbi,
      address: BLIND,
      functionName: 'auctions',
      args: [BigInt(id)],
    })),
    query: { enabled: validBLIND && blindIds.length > 0 },
  })
  const activeBlindCount = useMemo(() => {
    if (!blindRows) return 0
    return blindRows.map((r) => (r?.result ? normBlind(r.result) : null)).filter(Boolean).filter((x) => x.status === 0).length
  }, [blindRows])

  // Dutch auction
  const { data: dutchNextId, refetch: refetchDutchNextId } = useReadContract({
    abi: dutchAuctionMarketAbi,
    address: validDUTCH ? DUTCH : undefined,
    functionName: 'nextId',
    query: { enabled: validDUTCH },
  })
  const dutchIds = useMemo(() => {
    const n = dutchNextId ? Number(dutchNextId) : 0
    return n > 0 ? Array.from({ length: n }, (_, i) => i) : []
  }, [dutchNextId])
  const { data: dutchRows, refetch: refetchDutchRows } = useReadContracts({
    contracts: dutchIds.map((id) => ({
      abi: dutchAuctionMarketAbi,
      address: DUTCH,
      functionName: 'auctions',
      args: [BigInt(id)],
    })),
    query: { enabled: validDUTCH && dutchIds.length > 0 },
  })
  const activeDutchCount = useMemo(() => {
    if (!dutchRows) return 0
    const now = nowSec()
    return dutchRows
      .map((r) => (r?.result ? normDutch(r.result) : null))
      .filter(Boolean)
      .filter((x) => x.status === 0 && (!x.endTime || x.endTime > now)).length
  }, [dutchRows])

  // ✅ Bundle sale (tieres): use getBundle, not bundles()
  const { data: bundleNextId, refetch: refetchBundleNextId } = useReadContract({
    abi: bundleSaleMarketAbi,
    address: validBUNDLE ? BUNDLE : undefined,
    functionName: 'nextId',
    query: { enabled: validBUNDLE },
  })
  const bundleIds = useMemo(() => {
    const n = bundleNextId ? Number(bundleNextId) : 0
    return n > 0 ? Array.from({ length: n }, (_, i) => i) : []
  }, [bundleNextId])
  const { data: bundleRows, refetch: refetchBundleRows } = useReadContracts({
    contracts: bundleIds.map((id) => ({
      abi: bundleSaleMarketAbi,
      address: BUNDLE,
      functionName: 'getBundle',
      args: [BigInt(id)],
    })),
    query: { enabled: validBUNDLE && bundleIds.length > 0 },
  })
  const activeBundleCount = useMemo(() => {
    if (!bundleRows) return 0
    return bundleRows
      .map((r) => (r?.result ? normBundleFromGetBundle(r.result) : null))
      .filter(Boolean)
      .filter((x) => x.status === 0).length
  }, [bundleRows])

  // Direct offers
  const { data: offerNextId, refetch: refetchOfferNextId } = useReadContract({
    abi: directOfferMarketAbi,
    address: validOFFER ? OFFER : undefined,
    functionName: 'nextId',
    query: { enabled: validOFFER },
  })
  const offerIds = useMemo(() => {
    const n = offerNextId ? Number(offerNextId) : 0
    return n > 0 ? Array.from({ length: n }, (_, i) => i) : []
  }, [offerNextId])
  const { data: offerRows, refetch: refetchOfferRows } = useReadContracts({
    contracts: offerIds.map((id) => ({
      abi: directOfferMarketAbi,
      address: OFFER,
      functionName: 'offers',
      args: [BigInt(id)],
    })),
    query: { enabled: validOFFER && offerIds.length > 0 },
  })
  const activeOfferCount = useMemo(() => {
    if (!offerRows) return 0
    return offerRows.map((r) => (r?.result ? normOffer(r.result) : null)).filter(Boolean).filter((x) => x.status === 0).length
  }, [offerRows])

  // ----- Surrender + Transfer (unchanged) -----
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

    refetchFixedNextId(); refetchFixedRows()
    refetchOpenNextId(); refetchOpenRows()
    refetchBuyNextId(); refetchBuyRows()
    refetchBlindNextId(); refetchBlindRows()
    refetchDutchNextId(); refetchDutchRows()
    refetchBundleNextId(); refetchBundleRows()
    refetchOfferNextId(); refetchOfferRows()
  }

  useEffect(() => {
    if (!txHash) return
    doRefetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txHash])

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
                7 modes • only counts (active)
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn" onClick={doRefetchAll} style={{ padding: '6px 10px' }}>
                Refresh
              </button>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 12,
              marginTop: 14,
            }}
          >
            <div className="card" style={{ padding: 14 }}>
              <div className="subtle" style={{ fontSize: 12 }}>Sell fixed</div>
              <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.1, marginTop: 6 }}>{activeFixedCount}</div>
            </div>

            <div className="card" style={{ padding: 14 }}>
              <div className="subtle" style={{ fontSize: 12 }}>Open auctions</div>
              <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.1, marginTop: 6 }}>{activeOpenCount}</div>
            </div>

            <div className="card" style={{ padding: 14 }}>
              <div className="subtle" style={{ fontSize: 12 }}>Buy orders</div>
              <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.1, marginTop: 6 }}>{activeBuyCount}</div>
            </div>

            <div className="card" style={{ padding: 14 }}>
              <div className="subtle" style={{ fontSize: 12 }}>Blind auctions</div>
              <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.1, marginTop: 6 }}>{activeBlindCount}</div>
            </div>

            <div className="card" style={{ padding: 14 }}>
              <div className="subtle" style={{ fontSize: 12 }}>Dutch auctions</div>
              <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.1, marginTop: 6 }}>{activeDutchCount}</div>
            </div>

            <div className="card" style={{ padding: 14 }}>
              <div className="subtle" style={{ fontSize: 12 }}>Bundles</div>
              <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.1, marginTop: 6 }}>{activeBundleCount}</div>
            </div>

            <div className="card" style={{ padding: 14 }}>
              <div className="subtle" style={{ fontSize: 12 }}>Offers</div>
              <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.1, marginTop: 6 }}>{activeOfferCount}</div>
            </div>

            <div className="card" style={{ padding: 14 }}>
              <div className="subtle" style={{ fontSize: 12 }}>Node OK</div>
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>
                {validFIXED && validOPENA && validBUY && validBLIND && validDUTCH && validBUNDLE && validOFFER ? 'Yes' : 'Check .env'}
              </div>
            </div>
          </div>

          <div className="subtle" style={{ fontSize: 12, marginTop: 10 }}>
            nextId fixed: {fixedNextId !== undefined ? fixedNextId.toString() : '…'} •
            open: {openNextId !== undefined ? openNextId.toString() : '…'} •
            buy: {buyNextId !== undefined ? buyNextId.toString() : '…'} •
            blind: {blindNextId !== undefined ? blindNextId.toString() : '…'} •
            dutch: {dutchNextId !== undefined ? dutchNextId.toString() : '…'} •
            bundle: {bundleNextId !== undefined ? bundleNextId.toString() : '…'} •
            offer: {offerNextId !== undefined ? offerNextId.toString() : '…'}
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
