'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWatchContractEvent } from 'wagmi'
import { parseEther, formatEther } from 'viem'

import { allowance20Abi } from '../../../abi/Allowance20'
import { directOfferMarketAbi } from '../../../abi/DirectOffersMarket'
import { isHexAddress, prettyError, shortAddr } from '../../../lib/marketplaceHelpers'

const CAC = process.env.NEXT_PUBLIC_ALLOWANCE20_ADDRESS
const OFFERS = process.env.NEXT_PUBLIC_MARKET_OFFER_ADDRESS

function normalizeOffer(x) {
  if (Array.isArray(x)) {
    return {
      id: Number(x[0] ?? 0),
      buyer: String(x[1]),
      seller: String(x[2]),
      amountCAC: x[3],
      offerWei: x[4],
      status: Number(x[5]),
    }
  }
  return {
    id: Number(x.id ?? 0),
    buyer: String(x.buyer),
    seller: String(x.seller),
    amountCAC: x.amountCAC,
    offerWei: x.offerWei,
    status: Number(x.status),
  }
}

export default function MarketplaceOffersPage() {
  const { address, isConnected } = useAccount()
  const { writeContract, isPending, error: txError, data: txHash } = useWriteContract()

  const validCAC = isHexAddress(CAC)
  const validO = isHexAddress(OFFERS)
  const [notice, setNotice] = useState('')

  // CREATE OFFER
  const [ofSeller, setOfSeller] = useState('')
  const [ofAmount, setOfAmount] = useState('10')
  const [ofEth, setOfEth] = useState('0.2')

  function createOffer() {
    setNotice('')
    if (!ofSeller || !ofAmount || !ofEth) return
    writeContract({
      abi: directOfferMarketAbi,
      address: OFFERS,
      functionName: 'createOffer',
      args: [ofSeller, BigInt(ofAmount)],
      value: parseEther(ofEth),
    })
  }

  // allowance (seller accept needs)
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    abi: allowance20Abi,
    address: validCAC ? CAC : undefined,
    functionName: 'allowance',
    args: address && validCAC ? [address, OFFERS] : undefined,
    query: { enabled: !!address && validCAC && validO },
  })

  function needAllowanceFor(amountStr) {
    if (allowance === undefined || allowance === null) return true
    try { return BigInt(allowance) < BigInt(amountStr || '0') } catch { return true }
  }

  function approve(amountStr) {
    setNotice('')
    if (!amountStr || !validCAC) return
    writeContract({ abi: allowance20Abi, address: CAC, functionName: 'approve', args: [OFFERS, BigInt(amountStr)] })
  }

  // READ
  const { data: nextId, refetch: refetchNext } = useReadContract({
    abi: directOfferMarketAbi,
    address: validO ? OFFERS : undefined,
    functionName: 'nextId',
    query: { enabled: validO },
  })

  const ids = useMemo(() => {
    const n = nextId ? Number(nextId) : 0
    return n > 0 ? Array.from({ length: n }, (_, i) => i) : []
  }, [nextId])

  const { data: rows, refetch: refetchOffers } = useReadContracts({
    contracts: ids.map((id) => ({ abi: directOfferMarketAbi, address: OFFERS, functionName: 'offers', args: [BigInt(id)] })),
    query: { enabled: validO && ids.length > 0 },
  })

  const all = useMemo(() => {
    if (!rows) return []
    return rows.map((r) => (r?.result ? normalizeOffer(r.result) : null)).filter(Boolean)
  }, [rows])

  const active = useMemo(() => all.filter((o) => o.status === 0), [all])

  // Refund
  const { data: myRefund, refetch: refetchRefund } = useReadContract({
    abi: directOfferMarketAbi,
    address: validO ? OFFERS : undefined,
    functionName: 'pendingRefund',
    args: address ? [address] : undefined,
    query: { enabled: !!address && validO },
  })
  const refundWei = myRefund ?? 0n
  const canWithdraw = refundWei > 0n

  function withdrawRefund() {
    setNotice('')
    if (!canWithdraw) return
    writeContract({ abi: directOfferMarketAbi, address: OFFERS, functionName: 'withdrawRefund', args: [] })
  }

  // Actions
  function cancelOffer(id) {
    setNotice('')
    writeContract({ abi: directOfferMarketAbi, address: OFFERS, functionName: 'cancelOffer', args: [BigInt(id)] })
  }

  function acceptOffer(id, amountCAC) {
    setNotice('')
    if (needAllowanceFor(String(amountCAC))) {
      setNotice('To accept, Approve CAC -> OfferMarket first.')
      return
    }
    writeContract({ abi: directOfferMarketAbi, address: OFFERS, functionName: 'acceptOffer', args: [BigInt(id)] })
  }

  const doRefetchAll = () => { refetchAllowance(); refetchRefund(); refetchNext(); refetchOffers() }

  useWatchContractEvent({ abi: directOfferMarketAbi, address: validO ? OFFERS : undefined, eventName: 'Created', onLogs: doRefetchAll })
  useWatchContractEvent({ abi: directOfferMarketAbi, address: validO ? OFFERS : undefined, eventName: 'Accepted', onLogs: doRefetchAll })
  useWatchContractEvent({ abi: directOfferMarketAbi, address: validO ? OFFERS : undefined, eventName: 'Cancelled', onLogs: doRefetchAll })
  useWatchContractEvent({ abi: directOfferMarketAbi, address: validO ? OFFERS : undefined, eventName: 'Refunded', onLogs: doRefetchAll })

  useEffect(() => { if (txHash) doRefetchAll() }, [txHash]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setInterval(doRefetchAll, 10000); return () => clearInterval(t) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!validO) {
    return (
      <div className="card">
        <b>Missing NEXT_PUBLIC_MARKET_OFFER_ADDRESS</b>
        <div className="subtle" style={{ marginTop: 8 }}><code>{String(OFFERS)}</code></div>
      </div>
    )
  }

  if (!isConnected) return <div className="card">Please connect your wallet.</div>
  const errText = prettyError(txError)

  return (
    <>
      <h1 className="page-title">Marketplace • Offers</h1>

      <div className="cards">
        <div className="col-8">
          <section className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <h2 style={{ margin: 0 }}>Create offer</h2>
              <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={doRefetchAll}>Refresh</button>
            </div>

            <div className="grid grid-2" style={{ marginTop: 10 }}>
              <label>Seller address
                <input className="input" placeholder="0xseller…" value={ofSeller} onChange={(e) => setOfSeller(e.target.value)} />
              </label>
              <label>Amount (CAC)
                <input className="input" value={ofAmount} onChange={(e) => setOfAmount(e.target.value)} />
              </label>
            </div>

            <div className="grid grid-2" style={{ marginTop: 8 }}>
              <label>Offer (ETH)
                <input className="input" value={ofEth} onChange={(e) => setOfEth(e.target.value)} />
              </label>
              <div className="subtle" style={{ fontSize: 12, alignSelf: 'end' }}>
                Buyer escrow: ETH locked until accepted/cancelled.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn primary" onClick={createOffer} disabled={isPending || !ofSeller || !ofAmount || !ofEth}>
                Create offer
              </button>

              <button className="btn" onClick={withdrawRefund} disabled={isPending || !canWithdraw}>
                Withdraw refunds {canWithdraw ? `(${formatEther(refundWei)} ETH)` : ''}
              </button>

              <span className="subtle" style={{ fontSize: 12 }}>
                Allowance (seller): {allowance !== undefined ? allowance.toString() : '…'}
              </span>
            </div>

            {!!notice && <div style={{ marginTop: 8 }}>{notice}</div>}
            {!!errText && <div style={{ color: 'crimson', marginTop: 8 }}>{errText}</div>}
          </section>

          <section className="card" style={{ marginTop: 16 }}>
            <h2 style={{ margin: 0 }}>Active offers</h2>
            <div className="subtle" style={{ fontSize: 12, marginTop: 6 }}>
              nextId: {nextId !== undefined ? nextId.toString() : '…'} • loaded: {active.length}
            </div>

            {!active.length ? (
              <div style={{ marginTop: 10 }}>No active offers.</div>
            ) : (
              <div className="grid" style={{ marginTop: 10 }}>
                {active.map((o) => {
                  const isBuyer = String(o.buyer).toLowerCase() === address?.toLowerCase()
                  const isSeller = String(o.seller).toLowerCase() === address?.toLowerCase()

                  return (
                    <div key={`offer-${o.id}`} className="card" style={{ padding: 12 }}>
                      <div><b>ID:</b> {o.id}</div>
                      <div><b>Buyer:</b> {shortAddr(o.buyer)}</div>
                      <div><b>Seller:</b> {shortAddr(o.seller)}</div>
                      <div><b>Amount:</b> {o.amountCAC?.toString?.() || String(o.amountCAC)} CAC</div>
                      <div><b>Offer:</b> {formatEther(o.offerWei)} ETH</div>

                      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                        {isSeller && (
                          <>
                            <button className="btn" onClick={() => approve(String(o.amountCAC))} disabled={isPending || !validCAC}>
                              Approve {String(o.amountCAC)} CAC
                            </button>
                            <button className="btn primary" onClick={() => acceptOffer(o.id, o.amountCAC)} disabled={isPending}>
                              Accept (sell)
                            </button>
                          </>
                        )}

                        {isBuyer && (
                          <button className="btn" onClick={() => cancelOffer(o.id)} disabled={isPending}>
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
              <li>Buyer makes an offer to a seller address.</li>
              <li>Seller accepts → transfers CAC → receives escrow ETH.</li>
              <li>Cancel → refund via pendingRefund → Withdraw.</li>
            </ul>
          </section>
        </div>
      </div>
    </>
  )
}
