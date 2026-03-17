'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWatchContractEvent } from 'wagmi'
import { parseEther, formatEther } from 'viem'

import { allowance20Abi } from '../../../abi/Allowance20'
import { buyOrderMarketAbi } from '../../../abi/BuyOrderMarket'
import { isHexAddress, prettyError, shortAddr } from '../../../lib/marketplaceHelpers'

const CAC = process.env.NEXT_PUBLIC_ALLOWANCE20_ADDRESS
const BUY = process.env.NEXT_PUBLIC_MARKET_BUY_ORDER_ADDRESS

function normalizeBuyOrder(x) {
  if (Array.isArray(x)) {
    return { id: Number(x[0] ?? 0), buyer: String(x[1]), amountCAC: x[2], offerWei: x[3], status: Number(x[4]) }
  }
  return { id: Number(x.id ?? 0), buyer: String(x.buyer), amountCAC: x.amountCAC, offerWei: x.offerWei, status: Number(x.status) }
}

export default function MarketplaceBuyOrdersPage() {
  const { address, isConnected } = useAccount()
  const { writeContract, isPending, error: txError, data: txHash } = useWriteContract()

  const validCAC = isHexAddress(CAC)
  const validBUY = isHexAddress(BUY)

  const [notice, setNotice] = useState('')

  // CREATE
  const [brAmount, setBrAmount] = useState('20')
  const [brOfferEth, setBrOfferEth] = useState('0.5')

  function createBuyOrder() {
    setNotice('')
    if (!brAmount || !brOfferEth) return
    writeContract({
      abi: buyOrderMarketAbi,
      address: BUY,
      functionName: 'createBuyOrder',
      args: [BigInt(brAmount)],
      value: parseEther(brOfferEth),
    })
  }

  // allowance (seller fill needs)
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    abi: allowance20Abi,
    address: validCAC ? CAC : undefined,
    functionName: 'allowance',
    args: address && validCAC ? [address, BUY] : undefined,
    query: { enabled: !!address && validCAC && validBUY },
  })

  function needAllowanceFor(amountStr) {
    if (allowance === undefined || allowance === null) return true
    try { return BigInt(allowance) < BigInt(amountStr || '0') } catch { return true }
  }

  function approve(amountStr) {
    setNotice('')
    if (!amountStr || !validCAC) return
    writeContract({ abi: allowance20Abi, address: CAC, functionName: 'approve', args: [BUY, BigInt(amountStr)] })
  }

  // READ
  const { data: nextId, refetch: refetchNextId } = useReadContract({
    abi: buyOrderMarketAbi,
    address: validBUY ? BUY : undefined,
    functionName: 'nextId',
    query: { enabled: validBUY },
  })

  const ids = useMemo(() => {
    const n = nextId ? Number(nextId) : 0
    return n > 0 ? Array.from({ length: n }, (_, i) => i) : []
  }, [nextId])

  const { data: rows, refetch: refetchOrders } = useReadContracts({
    contracts: ids.map((id) => ({ abi: buyOrderMarketAbi, address: BUY, functionName: 'orders', args: [BigInt(id)] })),
    query: { enabled: validBUY && ids.length > 0 },
  })

  const all = useMemo(() => {
    if (!rows) return []
    return rows.map((r) => (r?.result ? normalizeBuyOrder(r.result) : null)).filter(Boolean)
  }, [rows])

  const active = useMemo(() => all.filter((o) => o.status === 0), [all])

  // Refund
  const { data: myRefund, refetch: refetchRefund } = useReadContract({
    abi: buyOrderMarketAbi,
    address: validBUY ? BUY : undefined,
    functionName: 'pendingRefund',
    args: address ? [address] : undefined,
    query: { enabled: !!address && validBUY },
  })
  const refundWei = myRefund ?? 0n
  const canWithdraw = refundWei > 0n

  function withdrawRefund() {
    setNotice('')
    if (!canWithdraw) return
    writeContract({ abi: buyOrderMarketAbi, address: BUY, functionName: 'withdrawRefund', args: [] })
  }

  // ACTIONS
  function fillBuyOrder(id, amountCAC) {
    setNotice('')
    if (needAllowanceFor(String(amountCAC))) {
      setNotice('To fill (sell), first Approve CAC -> BuyOrderMarket.')
      return
    }
    writeContract({ abi: buyOrderMarketAbi, address: BUY, functionName: 'fillBuyOrder', args: [BigInt(id)] })
  }

  function cancelBuyOrder(id) {
    setNotice('')
    writeContract({ abi: buyOrderMarketAbi, address: BUY, functionName: 'cancelBuyOrder', args: [BigInt(id)] })
  }

  const doRefetchAll = () => { refetchAllowance(); refetchRefund(); refetchNextId(); refetchOrders() }

  useWatchContractEvent({ abi: buyOrderMarketAbi, address: validBUY ? BUY : undefined, eventName: 'Created', onLogs: doRefetchAll })
  useWatchContractEvent({ abi: buyOrderMarketAbi, address: validBUY ? BUY : undefined, eventName: 'Filled', onLogs: doRefetchAll })
  useWatchContractEvent({ abi: buyOrderMarketAbi, address: validBUY ? BUY : undefined, eventName: 'Cancelled', onLogs: doRefetchAll })
  useWatchContractEvent({ abi: buyOrderMarketAbi, address: validBUY ? BUY : undefined, eventName: 'Refunded', onLogs: doRefetchAll })

  useEffect(() => { if (txHash) doRefetchAll() }, [txHash]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setInterval(doRefetchAll, 10000); return () => clearInterval(t) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!validBUY) {
    return (
      <div className="card">
        <b>Missing NEXT_PUBLIC_MARKET_BUY_ORDER_ADDRESS</b>
        <div className="subtle" style={{ marginTop: 8 }}><code>{String(BUY)}</code></div>
      </div>
    )
  }

  if (!isConnected) return <div className="card">Please connect your wallet.</div>
  const errText = prettyError(txError)

  return (
    <>
      <h1 className="page-title">Marketplace • Buy orders</h1>

      <div className="cards">
        <div className="col-8">
          <section className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <h2 style={{ margin: 0 }}>Create buy request</h2>
              <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={doRefetchAll}>Refresh</button>
            </div>

            <div className="grid grid-2" style={{ marginTop: 10 }}>
              <label>I want to buy (CAC)
                <input className="input" value={brAmount} onChange={(e) => setBrAmount(e.target.value)} />
              </label>
              <label>I pay (ETH)
                <input className="input" value={brOfferEth} onChange={(e) => setBrOfferEth(e.target.value)} />
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn primary" onClick={createBuyOrder} disabled={isPending || !brAmount || !brOfferEth}>Create</button>

              <button className="btn" onClick={withdrawRefund} disabled={isPending || !canWithdraw}>
                Withdraw refunds {canWithdraw ? `(${formatEther(refundWei)} ETH)` : ''}
              </button>

              <span className="subtle" style={{ fontSize: 12 }}>
                Allowance (for sellers): {allowance !== undefined ? allowance.toString() : '…'}
              </span>
            </div>

            {!!notice && <div style={{ marginTop: 8 }}>{notice}</div>}
            {!!errText && <div style={{ color: 'crimson', marginTop: 8 }}>{errText}</div>}
          </section>

          <section className="card" style={{ marginTop: 16 }}>
            <h2 style={{ margin: 0 }}>Active buy requests</h2>
            <div className="subtle" style={{ fontSize: 12, marginTop: 6 }}>
              nextId: {nextId !== undefined ? nextId.toString() : '…'} • loaded: {active.length}
            </div>

            {!active.length ? (
              <div style={{ marginTop: 10 }}>No active buy requests.</div>
            ) : (
              <div className="grid" style={{ marginTop: 10 }}>
                {active.map((o) => {
                  const isBuyer = String(o.buyer).toLowerCase() === address?.toLowerCase()
                  return (
                    <div key={`buy-${o.id}`} className="card" style={{ padding: 12 }}>
                      <div><b>ID:</b> {o.id}</div>
                      <div><b>Buyer:</b> {shortAddr(o.buyer)}</div>
                      <div><b>Amount:</b> {o.amountCAC?.toString?.() || String(o.amountCAC)} CAC</div>
                      <div><b>Offer:</b> {formatEther(o.offerWei)} ETH</div>

                      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                        {!isBuyer && (
                          <>
                            <button className="btn" onClick={() => approve(String(o.amountCAC))} disabled={isPending || !validCAC}>
                              Approve {String(o.amountCAC)} CAC
                            </button>
                            <button className="btn primary" onClick={() => fillBuyOrder(o.id, o.amountCAC)} disabled={isPending}>
                              Fill (sell)
                            </button>
                          </>
                        )}
                        {isBuyer && (
                          <button className="btn" onClick={() => cancelBuyOrder(o.id)} disabled={isPending}>
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
        </div>

        <div className="col-4">
          <section className="card">
            <h3>Notes</h3>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>Buyer locks ETH in escrow.</li>
              <li>Any seller can fill by transferring CAC via approve+fill.</li>
              <li>Buyer cancel → refund via pendingRefund → Withdraw.</li>
            </ul>
          </section>
        </div>
      </div>
    </>
  )
}
