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

import { cmpBig, isHexAddress, normalizeBuyOrder, prettyError, unitPriceWeiPerCAC } from '../../../lib/marketplaceHelpers'

const CAC = process.env.NEXT_PUBLIC_ALLOWANCE20_ADDRESS
const MKT2 = process.env.NEXT_PUBLIC_MARKET_V2_ADDRESS

export default function MarketplaceBuyPage() {
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

  // ---------------- CREATE BUY REQUEST ----------------
  const [brAmount, setBrAmount] = useState('20')
  const [brOfferEth, setBrOfferEth] = useState('0.5')

  function createBuyRequest() {
    setNotice('')
    if (!brAmount || !brOfferEth) return
    writeContract({
      abi: marketV2Abi,
      address: MKT2,
      functionName: 'createBuyOrder',
      args: [BigInt(brAmount)],
      value: parseEther(brOfferEth),
    })
  }

  // ---------------- allowance (seller fill-hez) ----------------
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

  // ---------------- READ BUY ORDERS ----------------
  const { data: nextBuyId, refetch: refetchNextBuyId } = useReadContract({
    abi: marketV2Abi,
    address: MKT2,
    functionName: 'nextBuyId',
    query: { enabled: validMKT },
  })

  const buyIds = useMemo(() => {
    const n = nextBuyId ? Number(nextBuyId) : 0
    return n > 0 ? Array.from({ length: n }, (_, i) => i) : []
  }, [nextBuyId])

  const { data: buyData, refetch: refetchBuyOrders, isFetching: isLoadingBuy } = useReadContracts({
    contracts: buyIds.map((id) => ({
      abi: marketV2Abi,
      address: MKT2,
      functionName: 'getBuyOrder',
      args: [BigInt(id)],
    })),
    query: { enabled: validMKT && buyIds.length > 0 },
  })

  const allBuy = useMemo(() => {
    if (!buyData) return []
    return buyData
      .map((r, i) => (r?.result ? { id: buyIds[i], ...normalizeBuyOrder(r.result) } : null))
      .filter(Boolean)
  }, [buyData, buyIds])

  const activeBuy = useMemo(() => allBuy.filter((o) => Number(o.status) === 0), [allBuy])

  // ---------------- FILTER / SORT ----------------
  const [mineFilter, setMineFilter] = useState('all') // all|mine|others
  const [sortBy, setSortBy] = useState('new') // new|priceAsc|priceDesc

  const shownBuy = useMemo(() => {
    let rows = activeBuy.slice()

    if (mineFilter !== 'all') {
      rows = rows.filter((o) => {
        const isMine = o.buyer?.toLowerCase() === address?.toLowerCase()
        return mineFilter === 'mine' ? isMine : !isMine
      })
    }

    if (sortBy === 'new') rows.sort((a, b) => b.id - a.id)
    else if (sortBy === 'priceAsc') rows.sort((a, b) => cmpBig(unitPriceWeiPerCAC(a), unitPriceWeiPerCAC(b)))
    else if (sortBy === 'priceDesc') rows.sort((a, b) => cmpBig(unitPriceWeiPerCAC(b), unitPriceWeiPerCAC(a)))

    return rows
  }, [activeBuy, mineFilter, sortBy, address])

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
    writeContract({ abi: marketV2Abi, address: MKT2, functionName: 'withdrawRefund', args: [] })
  }

  // ---------------- ACTIONS ----------------
  function fillBuyOrder(id, amountCAC) {
    setNotice('')
    if (needAllowanceFor(String(amountCAC))) {
      setNotice('Eladáshoz előbb Approve-olnod kell a marketplace felé a CAC-ot.')
      return
    }
    writeContract({
      abi: marketV2Abi,
      address: MKT2,
      functionName: 'fillBuyOrder',
      args: [BigInt(id)],
    })
  }

  function cancelBuyOrder(id) {
    setNotice('')
    writeContract({
      abi: marketV2Abi,
      address: MKT2,
      functionName: 'cancelBuyOrder',
      args: [BigInt(id)],
    })
  }

  // ---------------- REFETCH ----------------
  const doRefetchAll = () => {
    refetchAllowance()
    refetchRefund()
    refetchNextBuyId()
    refetchBuyOrders()
  }

  useWatchContractEvent({ abi: marketV2Abi, address: MKT2, eventName: 'BuyOrderCreated', onLogs: doRefetchAll })
  useWatchContractEvent({ abi: marketV2Abi, address: MKT2, eventName: 'BuyOrderFilled', onLogs: doRefetchAll })
  useWatchContractEvent({ abi: marketV2Abi, address: MKT2, eventName: 'BuyOrderCancelled', onLogs: doRefetchAll })
  useWatchContractEvent({ abi: marketV2Abi, address: MKT2, eventName: 'Refunded', onLogs: doRefetchAll })

  useEffect(() => {
    if (!txHash) return
    doRefetchAll()
  }, [txHash])

  useEffect(() => {
    const t = setInterval(() => doRefetchAll(), 10000)
    return () => clearInterval(t)
  }, [])

  if (!isConnected) return <div className="card">Please connect your wallet.</div>

  const errText = prettyError(txError)
  const selectStyle = { maxWidth: 220, color: 'var(--text)', background: 'var(--panel)' }
  const optionStyle = { color: '#111', background: '#fff' }

  return (
    <>
      <h1 className="page-title">Marketplace • Buy requests</h1>

      <div className="cards">
        <div className="col-8">
          <section className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Create buy request</h2>
              <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={doRefetchAll}>
                Refresh
              </button>
            </div>

            <div className="grid grid-2">
              <label>
                I want to buy (CAC)
                <input className="input" value={brAmount} onChange={(e) => setBrAmount(e.target.value)} />
              </label>
              <label>
                I pay (ETH)
                <input className="input" value={brOfferEth} onChange={(e) => setBrOfferEth(e.target.value)} />
              </label>
            </div>

            <div className="subtle" style={{ fontSize: 12, marginTop: 6 }}>
              Ez on-chain escrow: az ETH a szerződésben marad, amíg valaki el nem adja neked a CAC-ot.
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn primary" onClick={createBuyRequest} disabled={isPending || !brAmount || !brOfferEth}>
                Create buy request
              </button>
              <button className="btn" onClick={withdrawRefund} disabled={isPending || !canWithdraw}>
                Withdraw refunds {canWithdraw ? `(${formatEther(refundWei)} ETH)` : ''}
              </button>
            </div>

            {!!notice && <div style={{ marginTop: 8 }}>{notice}</div>}
            {!!errText && <div style={{ color: 'crimson', marginTop: 8 }}>{errText}</div>}
          </section>

          <section className="card" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ margin: 0 }}>Active buy requests</h2>
                <div className="subtle" style={{ fontSize: 12 }}>
                  nextBuyId: {nextBuyId !== undefined ? nextBuyId.toString() : '…'} • loaded: {activeBuy.length}
                  {isLoadingBuy ? ' • loading…' : ''}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <select className="input" style={selectStyle} value={mineFilter} onChange={(e) => setMineFilter(e.target.value)}>
                  <option style={optionStyle} value="all">All</option>
                  <option style={optionStyle} value="mine">My requests</option>
                  <option style={optionStyle} value="others">Others</option>
                </select>
                <select className="input" style={selectStyle} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option style={optionStyle} value="new">Newest</option>
                  <option style={optionStyle} value="priceAsc">Unit price ↑</option>
                  <option style={optionStyle} value="priceDesc">Unit price ↓</option>
                </select>
              </div>
            </div>

            {!shownBuy.length ? (
              <div style={{ marginTop: 8 }}>No active buy requests (with current filters).</div>
            ) : (
              <div className="grid" style={{ marginTop: 10 }}>
                {shownBuy.map((o) => {
                  const isMine = o.buyer?.toLowerCase() === address?.toLowerCase()
                  const unitWei = unitPriceWeiPerCAC(o)
                  return (
                    <div key={`buy-${o.id}`} className="card" style={{ padding: 12 }}>
                      <div><b>ID:</b> {o.id}</div>
                      <div><b>Buyer:</b> {o.buyer}</div>
                      <div><b>Wants:</b> {o.amountCAC?.toString?.() || String(o.amountCAC)} CAC</div>
                      <div><b>Pays:</b> {formatEther(o.offerWei)} ETH</div>
                      <div className="subtle" style={{ fontSize: 12 }}>
                        Unit: ~{formatEther(unitWei)} ETH / CAC
                      </div>

                      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {!isMine ? (
                          <>
                            <button className="btn" onClick={() => approve(String(o.amountCAC))} disabled={isPending || !validCAC}>
                              Approve {String(o.amountCAC)} CAC
                            </button>
                            <button className="btn primary" onClick={() => fillBuyOrder(o.id, o.amountCAC)} disabled={isPending}>
                              Sell {String(o.amountCAC)} CAC → get {formatEther(o.offerWei)} ETH
                            </button>
                          </>
                        ) : (
                          <button className="btn" onClick={() => cancelBuyOrder(o.id)} disabled={isPending}>
                            Cancel buy request
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        <div className="col-4">
          <section className="card">
            <h3>Notes</h3>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li><b>Create</b>: ETH escrow a szerződésben (nem a te walletedben).</li>
              <li><b>Fill</b>: az eladó CAC transferFrom-ot csinál → ezért kell Approve.</li>
              <li><b>Refund</b>: minden visszajáró összeget a <code>pendingRefund</code>-ból veszel fel.</li>
              <li className="subtle">Allowance: {allowance !== undefined ? allowance.toString() : '…'}</li>
            </ul>
          </section>
        </div>
      </div>
    </>
  )
}
