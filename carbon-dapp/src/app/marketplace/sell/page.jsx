'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWatchContractEvent,
} from 'wagmi'
import { parseEther, formatEther } from 'viem'

import { allowance20Abi } from '../../../abi/Allowance20'
import { marketV2Abi } from '../../../abi/CacMarketplaceV2'

import { cmpBig, displayPriceWei, isHexAddress, nowSec, normalizeListing, prettyError } from '../../../lib/marketplaceHelpers'

const CAC = process.env.NEXT_PUBLIC_ALLOWANCE20_ADDRESS
const MKT2 = process.env.NEXT_PUBLIC_MARKET_V2_ADDRESS

export default function MarketplaceSellPage() {
  const { address, isConnected } = useAccount()
  const { writeContract, isPending, error: txError, data: txHash } = useWriteContract()

  const validCAC = isHexAddress(CAC)
  const validMKT = isHexAddress(MKT2)

  const [notice, setNotice] = useState('')

  if (!validMKT) {
    return (
      <div className="card">
        <b>Marketplace V2 cím hiányzik / hibás.</b>
        <div style={{ marginTop: 8 }}>
          Állítsd be a <code>NEXT_PUBLIC_MARKET_V2_ADDRESS</code>-t a dapp <code>.env.local</code>-ban.
        </div>
        <div className="subtle" style={{ marginTop: 8 }}>
          Jelenlegi érték: <code>{String(MKT2)}</code>
        </div>
      </div>
    )
  }

  // ---------------- CREATE: Fixed / Auction ----------------
  const [tab, setTab] = useState('fixed') // fixed | auction

  // FIXED
  const [fxAmount, setFxAmount] = useState('10')
  const [fxPriceEth, setFxPriceEth] = useState('0.1')

  // AUCTION (open)
  const [auAmount, setAuAmount] = useState('10')
  const [auReserveEth, setAuReserveEth] = useState('0.05')
  const [auBuyoutEth, setAuBuyoutEth] = useState('0.3')
  const [auEndsInMins, setAuEndsInMins] = useState('60')

  // ---------------- allowance ----------------
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    abi: allowance20Abi,
    address: validCAC ? CAC : undefined,
    functionName: 'allowance',
    args: address && validCAC ? [address, MKT2] : undefined,
    query: { enabled: !!address && validCAC && validMKT },
  })

  function needAllowanceFor(amountStr) {
    if (allowance === undefined || allowance === null) return true
    try {
      return BigInt(allowance) < BigInt(amountStr || '0')
    } catch {
      return true
    }
  }

  function approve(amountStr) {
    setNotice('')
    if (!amountStr || !validCAC) return
    writeContract({
      abi: allowance20Abi,
      address: CAC,
      functionName: 'approve',
      args: [MKT2, BigInt(amountStr)],
    })
  }

  function listFixed() {
    setNotice('')
    if (!fxAmount || !fxPriceEth) return
    if (needAllowanceFor(fxAmount)) return
    writeContract({
      abi: marketV2Abi,
      address: MKT2,
      functionName: 'listFixed',
      args: [BigInt(fxAmount), parseEther(fxPriceEth)],
    })
  }

  function listAuction() {
    setNotice('')
    if (!auAmount || !auReserveEth || !auEndsInMins) return
    if (needAllowanceFor(auAmount)) return

    // UI minimum: 2 perc + puffer
    const mins = Math.max(Number(auEndsInMins || '0'), 2)
    const bufferSec = 5
    const endTs = BigInt(nowSec() + mins * 60 + bufferSec)

    const reserve = parseEther(auReserveEth)
    const buyout = auBuyoutEth && Number(auBuyoutEth) > 0 ? parseEther(auBuyoutEth) : 0n

    writeContract({
      abi: marketV2Abi,
      address: MKT2,
      functionName: 'listAuction',
      args: [BigInt(auAmount), reserve, buyout, endTs],
    })
  }

  // ---------------- READ: Sell listings ----------------
  const { data: nextId, refetch: refetchNextId } = useReadContract({
    abi: marketV2Abi,
    address: MKT2,
    functionName: 'nextId',
    query: { enabled: validMKT },
  })

  const ids = useMemo(() => {
    const n = nextId ? Number(nextId) : 0
    return n > 0 ? Array.from({ length: n }, (_, i) => i) : []
  }, [nextId])

  const {
    data: listingsData,
    refetch: refetchListings,
    isFetching: isLoadingListings,
  } = useReadContracts({
    contracts: ids.map((id) => ({
      abi: marketV2Abi,
      address: MKT2,
      functionName: 'getListing',
      args: [BigInt(id)],
    })),
    query: { enabled: validMKT && ids.length > 0 },
  })

  const allSell = useMemo(() => {
    if (!listingsData) return []
    return listingsData
      .map((r, i) => (r?.result ? { id: ids[i], ...normalizeListing(r.result) } : null))
      .filter(Boolean)
  }, [listingsData, ids])

  const activeSell = useMemo(() => {
    const now = nowSec()
    return allSell.filter((r) => {
      if (Number(r.status) !== 0) return false
      if (Number(r.saleType) === 0) return true
      return Number(r.endTime) > now
    })
  }, [allSell])

  const expiredMyAuctions = useMemo(() => {
    const now = nowSec()
    return allSell.filter((r) => {
      if (Number(r.status) !== 0) return false
      if (Number(r.saleType) !== 1) return false
      if (Number(r.endTime) > now) return false
      return r.seller?.toLowerCase() === address?.toLowerCase()
    })
  }, [allSell, address])

  // ---------------- FILTER / SORT ----------------
  const [typeFilter, setTypeFilter] = useState('all') // all|fixed|auction
  const [sortBy, setSortBy] = useState('priceAsc') // priceAsc|priceDesc|endSoon|new

  const shownSell = useMemo(() => {
    let rows = activeSell.slice()

    if (typeFilter !== 'all') {
      rows = rows.filter((r) => (typeFilter === 'fixed' ? Number(r.saleType) === 0 : Number(r.saleType) === 1))
    }

    if (sortBy === 'priceAsc') rows.sort((a, b) => cmpBig(displayPriceWei(a), displayPriceWei(b)))
    else if (sortBy === 'priceDesc') rows.sort((a, b) => cmpBig(displayPriceWei(b), displayPriceWei(a)))
    else if (sortBy === 'endSoon') {
      rows = rows.filter((r) => Number(r.saleType) === 1)
      rows.sort((a, b) => Number(a.endTime) - Number(b.endTime))
    } else if (sortBy === 'new') rows.sort((a, b) => b.id - a.id)

    return rows
  }, [activeSell, typeFilter, sortBy])

  // ---------------- REFUNDS ----------------
  const { data: myRefund, refetch: refetchRefund } = useReadContract({
    abi: marketV2Abi,
    address: MKT2,
    functionName: 'pendingRefund',
    args: address ? [address] : undefined,
    query: { enabled: !!address && validMKT },
  })
  const refundWei = myRefund ?? 0n
  const canWithdraw = refundWei > 0n

  function withdrawRefund() {
    setNotice('')
    if (!canWithdraw) return
    writeContract({
      abi: marketV2Abi,
      address: MKT2,
      functionName: 'withdrawRefund',
      args: [],
    })
  }

  // ---------------- ACTIONS (sell listings) ----------------
  function buy(id, priceWei) {
    setNotice('')
    writeContract({
      abi: marketV2Abi,
      address: MKT2,
      functionName: 'buy',
      args: [BigInt(id)],
      value: priceWei,
    })
  }

  const [bidEthById, setBidEthById] = useState({})
  const bidInput = (id) => String(bidEthById[id] ?? '0.06')

  function setBidEth(id, v) {
    setBidEthById((s) => ({ ...s, [id]: v }))
  }

  function bid(id) {
    setNotice('')
    writeContract({
      abi: marketV2Abi,
      address: MKT2,
      functionName: 'bid',
      args: [BigInt(id)],
      value: parseEther(bidInput(id) || '0'),
    })
  }

  function finalize(id) {
    setNotice('')
    writeContract({
      abi: marketV2Abi,
      address: MKT2,
      functionName: 'finalize',
      args: [BigInt(id)],
    })
  }

  function cancel(id) {
    setNotice('')
    writeContract({
      abi: marketV2Abi,
      address: MKT2,
      functionName: 'cancel',
      args: [BigInt(id)],
    })
  }

  // ---------------- REFETCH ----------------
  const doRefetchAll = () => {
    refetchAllowance()
    refetchRefund()
    refetchNextId()
    refetchListings()
  }

  useWatchContractEvent({ abi: marketV2Abi, address: MKT2, eventName: 'ListedFixed', onLogs: doRefetchAll })
  useWatchContractEvent({ abi: marketV2Abi, address: MKT2, eventName: 'ListedAuction', onLogs: doRefetchAll })
  useWatchContractEvent({ abi: marketV2Abi, address: MKT2, eventName: 'BuyNow', onLogs: doRefetchAll })
  useWatchContractEvent({ abi: marketV2Abi, address: MKT2, eventName: 'Bid', onLogs: doRefetchAll })
  useWatchContractEvent({ abi: marketV2Abi, address: MKT2, eventName: 'Finalized', onLogs: doRefetchAll })
  useWatchContractEvent({ abi: marketV2Abi, address: MKT2, eventName: 'Cancelled', onLogs: doRefetchAll })
  useWatchContractEvent({ abi: marketV2Abi, address: MKT2, eventName: 'Refunded', onLogs: doRefetchAll })

  useEffect(() => {
    if (!txHash) return
    doRefetchAll()
  }, [txHash])

  useEffect(() => {
    const t = setInterval(() => {
      doRefetchAll()
    }, 10000)
    return () => clearInterval(t)
  }, [])

  if (!isConnected) return <div className="card">Please connect your wallet.</div>

  const errText = prettyError(txError)
  const selectStyle = { maxWidth: 180, color: 'var(--text)', background: 'var(--panel)' }
  const optionStyle = { color: '#111', background: '#fff' }

  return (
    <>
      <h1 className="page-title">Marketplace • Sell</h1>

      <div className="cards">
        <div className="col-8">
          {/* Create */}
          <section className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Create listing</h2>
              <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={doRefetchAll}>
                Refresh
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <button className={`btn ${tab === 'fixed' ? 'primary' : ''}`} onClick={() => setTab('fixed')}>
                Fixed price
              </button>
              <button className={`btn ${tab === 'auction' ? 'primary' : ''}`} onClick={() => setTab('auction')}>
                Auction
              </button>
            </div>

            {tab === 'fixed' && (
              <>
                <div className="grid grid-2">
                  <label>
                    Amount (CAC)
                    <input className="input" value={fxAmount} onChange={(e) => setFxAmount(e.target.value)} />
                  </label>
                  <label>
                    Price (ETH)
                    <input className="input" value={fxPriceEth} onChange={(e) => setFxPriceEth(e.target.value)} />
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button className="btn" onClick={() => approve(fxAmount)} disabled={isPending || !fxAmount || !validCAC}>
                    Approve
                  </button>
                  <button
                    className="btn"
                    onClick={listFixed}
                    disabled={isPending || !fxAmount || !fxPriceEth || needAllowanceFor(fxAmount) || !validCAC}
                    title={needAllowanceFor(fxAmount) ? 'Approve first' : ''}
                  >
                    List fixed
                  </button>
                  <span className="subtle" style={{ fontSize: 12 }}>
                    Allowance: {allowance !== undefined ? allowance.toString() : '…'}
                  </span>
                </div>
              </>
            )}

            {tab === 'auction' && (
              <>
                <div className="grid grid-2">
                  <label>
                    Amount (CAC)
                    <input className="input" value={auAmount} onChange={(e) => setAuAmount(e.target.value)} />
                  </label>
                  <label>
                    Reserve (ETH)
                    <input className="input" value={auReserveEth} onChange={(e) => setAuReserveEth(e.target.value)} />
                  </label>
                </div>
                <div className="grid grid-2" style={{ marginTop: 8 }}>
                  <label>
                    Buyout (ETH, 0 = none)
                    <input className="input" value={auBuyoutEth} onChange={(e) => setAuBuyoutEth(e.target.value)} />
                  </label>
                  <label>
                    Ends in (minutes, min 2)
                    <input className="input" value={auEndsInMins} onChange={(e) => setAuEndsInMins(e.target.value)} />
                  </label>
                </div>
                <div className="subtle" style={{ fontSize: 12, marginTop: 6 }}>
                  Minimum 2 perc javasolt (kontrakt: 60s+).
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button className="btn" onClick={() => approve(auAmount)} disabled={isPending || !auAmount || !validCAC}>
                    Approve
                  </button>
                  <button
                    className="btn"
                    onClick={listAuction}
                    disabled={
                      isPending ||
                      !auAmount ||
                      !auReserveEth ||
                      !auEndsInMins ||
                      Number(auEndsInMins) < 2 ||
                      needAllowanceFor(auAmount) ||
                      !validCAC
                    }
                    title={
                      Number(auEndsInMins) < 2
                        ? 'Minimum 2 perc'
                        : needAllowanceFor(auAmount)
                          ? 'Approve first'
                          : ''
                    }
                  >
                    List auction
                  </button>
                  <span className="subtle" style={{ fontSize: 12 }}>
                    Allowance: {allowance !== undefined ? allowance.toString() : '…'}
                  </span>
                </div>
              </>
            )}

            {!!notice && <div style={{ marginTop: 8 }}>{notice}</div>}
            {!!errText && <div style={{ color: 'crimson', marginTop: 8 }}>{errText}</div>}
          </section>

          {/* Active sell listings */}
          <section className="card" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ margin: 0 }}>Active sell listings</h2>
                <div className="subtle" style={{ fontSize: 12 }}>
                  nextId: {nextId !== undefined ? nextId.toString() : '…'} • loaded: {activeSell.length}
                  {isLoadingListings ? ' • loading…' : ''}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <select className="input" style={selectStyle} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                  <option style={optionStyle} value="all">All</option>
                  <option style={optionStyle} value="fixed">Fixed price</option>
                  <option style={optionStyle} value="auction">Auction</option>
                </select>

                <select className="input" style={selectStyle} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option style={optionStyle} value="priceAsc">Price ↑</option>
                  <option style={optionStyle} value="priceDesc">Price ↓</option>
                  <option style={optionStyle} value="endSoon">Ending soon</option>
                  <option style={optionStyle} value="new">Newest</option>
                </select>

                <button className="btn" onClick={withdrawRefund} disabled={isPending || !canWithdraw}>
                  Withdraw refunds {canWithdraw ? `(${formatEther(refundWei)} ETH)` : ''}
                </button>
              </div>
            </div>

            {!shownSell.length ? (
              <div style={{ marginTop: 8 }}>No active listings (with current filters).</div>
            ) : (
              <div className="grid" style={{ marginTop: 10 }}>
                {shownSell.map((r) => {
                  const isFixed = Number(r.saleType) === 0
                  const isMine = address?.toLowerCase() === r.seller?.toLowerCase()

                  return (
                    <div key={`sell-${r.id}`} className="card" style={{ padding: 12 }}>
                      <div><b>ID:</b> {r.id}</div>
                      <div><b>Seller:</b> {r.seller}</div>
                      <div><b>Amount:</b> {r.amountCAC?.toString?.() || String(r.amountCAC)} CAC</div>
                      <div><b>Type:</b> {isFixed ? 'Fixed' : 'Auction'}</div>

                      {isFixed ? (
                        <div><b>Price:</b> {formatEther(r.priceWei)} ETH</div>
                      ) : (
                        <>
                          <div><b>Reserve:</b> {formatEther(r.reserveWei)} ETH</div>
                          <div><b>Highest bid:</b> {formatEther(r.highestBid || 0n)} ETH</div>
                          <div><b>Buyout:</b> {r.buyoutWei && r.buyoutWei !== 0n ? `${formatEther(r.buyoutWei)} ETH` : '—'}</div>
                          <div><b>Ends:</b> {r.endTime ? new Date(Number(r.endTime) * 1000).toLocaleString() : '—'}</div>
                        </>
                      )}

                      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {isFixed ? (
                          <button className="btn" onClick={() => buy(r.id, r.priceWei)} disabled={isPending}>
                            Buy {formatEther(r.priceWei)} ETH
                          </button>
                        ) : (
                          <>
                            <input
                              className="input"
                              style={{ maxWidth: 140 }}
                              value={bidInput(r.id)}
                              onChange={(e) => setBidEth(r.id, e.target.value)}
                              placeholder="Bid ETH"
                            />
                            <button className="btn" onClick={() => bid(r.id)} disabled={isPending}>
                              Place bid
                            </button>
                          </>
                        )}

                        {isMine && (
                          <button className="btn" onClick={() => cancel(r.id)} disabled={isPending}>
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Expired auctions (yours) */}
          {!!expiredMyAuctions.length && (
            <section className="card" style={{ marginTop: 16 }}>
              <h3>Expired auctions (yours)</h3>
              <div className="subtle" style={{ fontSize: 12, marginBottom: 8 }}>
                Ezek már nem aktívak. Zárd le: licittel Finalize, licit nélkül Cancel (CAC vissza).
              </div>
              <div className="grid">
                {expiredMyAuctions.map((r) => {
                  const hasBid = r.highestBid && r.highestBid !== 0n
                  return (
                    <div key={`exp-${r.id}`} className="card" style={{ padding: 12 }}>
                      <div><b>ID:</b> {r.id}</div>
                      <div><b>Amount:</b> {r.amountCAC?.toString?.() || String(r.amountCAC)} CAC</div>
                      <div><b>Highest bid:</b> {formatEther(r.highestBid || 0n)} ETH</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        {hasBid ? (
                          <button className="btn" onClick={() => finalize(r.id)} disabled={isPending}>
                            Finalize
                          </button>
                        ) : (
                          <button className="btn" onClick={() => cancel(r.id)} disabled={isPending}>
                            Cancel (return CAC)
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </div>

        <div className="col-4">
          <section className="card">
            <h3>Tips</h3>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>Fixed: azonnali vétel ETH-ért.</li>
              <li>Auction: licit + buyout (villámár) opció.</li>
              <li>Refund: túllicitált ajánlat felvétele “Withdraw refunds”.</li>
            </ul>
          </section>
        </div>
      </div>
    </>
  )
}
