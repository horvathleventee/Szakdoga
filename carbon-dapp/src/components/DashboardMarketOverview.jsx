'use client'

import { useEffect, useMemo } from 'react'
import { useReadContract, useReadContracts } from 'wagmi'

import { fixedMarketAbi } from '../abi/FixedMarket'
import { openAuctionMarketAbi } from '../abi/OpenAuctionMarket'
import { buyOrderMarketAbi } from '../abi/BuyOrderMarket'
import { blindAuctionMarketAbi } from '../abi/BlindAuctionMarket'
import { dutchAuctionMarketAbi } from '../abi/DutchAuctionMarket'
import { bundleSaleMarketAbi } from '../abi/BundleSaleMarket'
import { directOfferMarketAbi } from '../abi/DirectOfferMarket'

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

function normFixed(x) {
  if (Array.isArray(x)) return { status: Number(x[4]) }
  return { status: Number(x?.status ?? 0) }
}

function normOpenAuction(x) {
  if (Array.isArray(x)) return { endTime: Number(x[5]), status: Number(x[6]) }
  return { endTime: Number(x?.endTime ?? 0), status: Number(x?.status ?? 0) }
}

function normBuyOrder(x) {
  if (Array.isArray(x)) return { status: Number(x[4]) }
  return { status: Number(x?.status ?? 0) }
}

function normBlind(x) {
  if (Array.isArray(x)) return { status: Number(x[7]) }
  return { status: Number(x?.status ?? 0) }
}

function normDutch(x) {
  if (Array.isArray(x)) return { endTime: Number(x[6]), status: Number(x[8]) }
  return { endTime: Number(x?.endTime ?? 0), status: Number(x?.status ?? 0) }
}

function normBundle(x) {
  if (Array.isArray(x)) return { status: Number(x[5]) }
  return { status: Number(x?.status ?? 0) }
}

function normOffer(x) {
  if (Array.isArray(x)) return { status: Number(x[x.length - 1]) }
  return { status: Number(x?.status ?? 0) }
}

export default function DashboardMarketOverview({ refreshTrigger }) {
  const validFIXED = isHexAddress(FIXED)
  const validOPENA = isHexAddress(OPENA)
  const validBUY = isHexAddress(BUY)
  const validBLIND = isHexAddress(BLIND)
  const validDUTCH = isHexAddress(DUTCH)
  const validBUNDLE = isHexAddress(BUNDLE)
  const validOFFER = isHexAddress(OFFER)

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
    return openRows.map((r) => (r?.result ? normOpenAuction(r.result) : null)).filter(Boolean).filter((x) => x.status === 0 && (!x.endTime || x.endTime > now)).length
  }, [openRows])

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
    return dutchRows.map((r) => (r?.result ? normDutch(r.result) : null)).filter(Boolean).filter((x) => x.status === 0 && (!x.endTime || x.endTime > now)).length
  }, [dutchRows])

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
    return bundleRows.map((r) => (r?.result ? normBundle(r.result) : null)).filter(Boolean).filter((x) => x.status === 0).length
  }, [bundleRows])

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

  const doRefetchAll = () => {
    refetchFixedNextId()
    refetchFixedRows()
    refetchOpenNextId()
    refetchOpenRows()
    refetchBuyNextId()
    refetchBuyRows()
    refetchBlindNextId()
    refetchBlindRows()
    refetchDutchNextId()
    refetchDutchRows()
    refetchBundleNextId()
    refetchBundleRows()
    refetchOfferNextId()
    refetchOfferRows()
  }

  useEffect(() => {
    if (!refreshTrigger) return
    doRefetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger])

  return (
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
        nextId fixed: {fixedNextId !== undefined ? fixedNextId.toString() : '...'} •
        open: {openNextId !== undefined ? openNextId.toString() : '...'} •
        buy: {buyNextId !== undefined ? buyNextId.toString() : '...'} •
        blind: {blindNextId !== undefined ? blindNextId.toString() : '...'} •
        dutch: {dutchNextId !== undefined ? dutchNextId.toString() : '...'} •
        bundle: {bundleNextId !== undefined ? bundleNextId.toString() : '...'} •
        offer: {offerNextId !== undefined ? offerNextId.toString() : '...'}
      </div>
    </section>
  )
}
