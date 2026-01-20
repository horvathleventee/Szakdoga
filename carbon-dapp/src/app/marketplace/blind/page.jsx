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

import {
  cmpBig,
  genSalt32,
  isHexAddress,
  makeBlindCommitment,
  normalizeBlind,
  prettyError,
  nowSec,
} from '../../../lib/marketplaceHelpers'

const CAC = process.env.NEXT_PUBLIC_ALLOWANCE20_ADDRESS
const MKT2 = process.env.NEXT_PUBLIC_MARKET_V2_ADDRESS

export default function MarketplaceBlindPage() {
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

  // ---------------- CREATE BLIND ----------------
  const [blAmount, setBlAmount] = useState('10')
  const [blReserveEth, setBlReserveEth] = useState('0.05')
  const [blBuyoutEth, setBlBuyoutEth] = useState('0')
  const [blCommitMins, setBlCommitMins] = useState('10')
  const [blRevealMins, setBlRevealMins] = useState('10')

  // allowance (seller list blind)
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
    writeContract({ abi: allowance20Abi, address: CAC, functionName: 'approve', args: [MKT2, BigInt(amountStr)] })
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
      abi: marketV2Abi,
      address: MKT2,
      functionName: 'listBlindAuction',
      args: [BigInt(blAmount), reserve, buyout, commitEnd, revealEnd],
    })
  }

  // ---------------- READ BLIND AUCTIONS ----------------
  const { data: nextBlindId, refetch: refetchNextBlindId } = useReadContract({
    abi: marketV2Abi,
    address: MKT2,
    functionName: 'nextBlindId',
    query: { enabled: validMKT },
  })

  const blindIds = useMemo(() => {
    const n = nextBlindId ? Number(nextBlindId) : 0
    return n > 0 ? Array.from({ length: n }, (_, i) => i) : []
  }, [nextBlindId])

  const { data: blindData, refetch: refetchBlind, isFetching: isLoadingBlind } = useReadContracts({
    contracts: blindIds.map((id) => ({ abi: marketV2Abi, address: MKT2, functionName: 'getBlindAuction', args: [BigInt(id)] })),
    query: { enabled: validMKT && blindIds.length > 0 },
  })

  const allBlind = useMemo(() => {
    if (!blindData) return []
    return blindData
      .map((r, i) => (r?.result ? { id: blindIds[i], ...normalizeBlind(r.result) } : null))
      .filter(Boolean)
  }, [blindData, blindIds])

  const activeBlind = useMemo(() => allBlind.filter((a) => Number(a.status) === 0), [allBlind])

  // ---------------- FILTER / SORT ----------------
  const [mineFilter, setMineFilter] = useState('all') // all|mine|others
  const [phaseFilter, setPhaseFilter] = useState('all') // all|commit|reveal|ended
  const [sortBy, setSortBy] = useState('new') // new|endingSoon|priceAsc|priceDesc

  const shownBlind = useMemo(() => {
    const now = nowSec()
    let rows = activeBlind.slice()

    if (mineFilter !== 'all') {
      rows = rows.filter((a) => {
        const isMine = a.seller?.toLowerCase() === address?.toLowerCase()
        return mineFilter === 'mine' ? isMine : !isMine
      })
    }

    if (phaseFilter !== 'all') {
      rows = rows.filter((a) => {
        const inCommit = now < Number(a.commitEndTime)
        const inReveal = now >= Number(a.commitEndTime) && now < Number(a.revealEndTime)
        const ended = now >= Number(a.revealEndTime)
        if (phaseFilter === 'commit') return inCommit
        if (phaseFilter === 'reveal') return inReveal
        if (phaseFilter === 'ended') return ended
        return true
      })
    }

    if (sortBy === 'new') rows.sort((a, b) => b.id - a.id)
    else if (sortBy === 'endingSoon') rows.sort((a, b) => Number(a.revealEndTime) - Number(b.revealEndTime))
    else if (sortBy === 'priceAsc') rows.sort((a, b) => cmpBig(a.reserveWei, b.reserveWei))
    else if (sortBy === 'priceDesc') rows.sort((a, b) => cmpBig(b.reserveWei, a.reserveWei))

    return rows
  }, [activeBlind, mineFilter, phaseFilter, sortBy, address])

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
  const [blindBidEthById, setBlindBidEthById] = useState({})
  const bidInput = (id) => String(blindBidEthById[id] ?? '')
  const setBidEth = (id, v) => setBlindBidEthById((s) => ({ ...s, [id]: v }))

  function blindStorageKey(id) {
    return `cac_blind_${MKT2}_${address}_${id}`
  }

  function commitBlind(id) {
    setNotice('')
    const bidEth = String(blindBidEthById[id] ?? '')
    if (!bidEth || Number(bidEth) <= 0) {
      setNotice('Adj meg egy licit összeget ETH-ban (commit).')
      return
    }
    if (!address) return

    const bidWei = parseEther(bidEth)
    const salt = genSalt32()
    const commitment = makeBlindCommitment({ bidWei, salt, bidder: address })

    // store for reveal
    localStorage.setItem(blindStorageKey(id), JSON.stringify({ bidEth, salt }))

    writeContract({
      abi: marketV2Abi,
      address: MKT2,
      functionName: 'commitBlindBid',
      args: [BigInt(id), commitment],
      value: bidWei, // deposit
    })
  }

  function revealBlind(id) {
    setNotice('')
    const raw = localStorage.getItem(blindStorageKey(id))
    if (!raw) {
      setNotice('Nincs eltárolt salt/bid ehhez az aukcióhoz ezen a böngészőn. (Commitnál mentjük localStorage-be.)')
      return
    }
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      setNotice('Hibás localStorage adat a revealhez. Commitelj újra.')
      return
    }
    const bidWei = parseEther(String(parsed.bidEth))
    const salt = parsed.salt

    writeContract({
      abi: marketV2Abi,
      address: MKT2,
      functionName: 'revealBlindBid',
      args: [BigInt(id), bidWei, salt],
    })
  }

  function finalizeBlind(id) {
    setNotice('')
    writeContract({ abi: marketV2Abi, address: MKT2, functionName: 'finalizeBlind', args: [BigInt(id)] })
  }

  function cancelBlind(id) {
    setNotice('')
    writeContract({ abi: marketV2Abi, address: MKT2, functionName: 'cancelBlind', args: [BigInt(id)] })
  }

  function prepareUnrevealedRefund(id) {
    setNotice('')
    writeContract({ abi: marketV2Abi, address: MKT2, functionName: 'prepareUnrevealedRefund', args: [BigInt(id)] })
  }

  // ---------------- REFETCH ----------------
  const doRefetchAll = () => {
    refetchAllowance()
    refetchRefund()
    refetchNextBlindId()
    refetchBlind()
  }

  useWatchContractEvent({ abi: marketV2Abi, address: MKT2, eventName: 'ListedBlind', onLogs: doRefetchAll })
  useWatchContractEvent({ abi: marketV2Abi, address: MKT2, eventName: 'BlindCommitted', onLogs: doRefetchAll })
  useWatchContractEvent({ abi: marketV2Abi, address: MKT2, eventName: 'BlindRevealed', onLogs: doRefetchAll })
  useWatchContractEvent({ abi: marketV2Abi, address: MKT2, eventName: 'BlindFinalized', onLogs: doRefetchAll })
  useWatchContractEvent({ abi: marketV2Abi, address: MKT2, eventName: 'BlindCancelled', onLogs: doRefetchAll })
  useWatchContractEvent({ abi: marketV2Abi, address: MKT2, eventName: 'UnrevealedRefundPrepared', onLogs: doRefetchAll })
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
      <h1 className="page-title">Marketplace • Blind auctions</h1>

      <div className="cards">
        <div className="col-8">
          {/* Create */}
          <section className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Create blind auction</h2>
              <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={doRefetchAll}>
                Refresh
              </button>
            </div>

            <div className="grid grid-2">
              <label>
                Amount (CAC)
                <input className="input" value={blAmount} onChange={(e) => setBlAmount(e.target.value)} />
              </label>
              <label>
                Reserve (ETH)
                <input className="input" value={blReserveEth} onChange={(e) => setBlReserveEth(e.target.value)} />
              </label>
            </div>
            <div className="grid grid-2" style={{ marginTop: 8 }}>
              <label>
                Buyout (ETH, 0 = none)
                <input className="input" value={blBuyoutEth} onChange={(e) => setBlBuyoutEth(e.target.value)} />
              </label>
              <label>
                Commit minutes (min 2)
                <input className="input" value={blCommitMins} onChange={(e) => setBlCommitMins(e.target.value)} />
              </label>
            </div>
            <div className="grid grid-2" style={{ marginTop: 8 }}>
              <label>
                Reveal minutes (min 2)
                <input className="input" value={blRevealMins} onChange={(e) => setBlRevealMins(e.target.value)} />
              </label>
              <div className="subtle" style={{ fontSize: 12, alignSelf: 'end' }}>
                Commit: hash + deposit • Reveal: bid + salt
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => approve(blAmount)} disabled={isPending || !blAmount || !validCAC}>
                Approve
              </button>
              <button
                className="btn"
                onClick={listBlind}
                disabled={
                  isPending ||
                  !blAmount ||
                  !blReserveEth ||
                  Number(blCommitMins) < 2 ||
                  Number(blRevealMins) < 2 ||
                  needAllowanceFor(blAmount) ||
                  !validCAC
                }
                title={
                  Number(blCommitMins) < 2 || Number(blRevealMins) < 2
                    ? 'Commit/Reveal min 2 perc'
                    : needAllowanceFor(blAmount)
                      ? 'Approve first'
                      : ''
                }
              >
                List blind auction
              </button>
              <button className="btn" onClick={withdrawRefund} disabled={isPending || !canWithdraw}>
                Withdraw refunds {canWithdraw ? `(${formatEther(refundWei)} ETH)` : ''}
              </button>
              <span className="subtle" style={{ fontSize: 12 }}>
                Allowance: {allowance !== undefined ? allowance.toString() : '…'}
              </span>
            </div>

            {!!notice && <div style={{ marginTop: 8 }}>{notice}</div>}
            {!!errText && <div style={{ color: 'crimson', marginTop: 8 }}>{errText}</div>}
          </section>

          {/* Active blind auctions */}
          <section className="card" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ margin: 0 }}>Active blind auctions</h2>
                <div className="subtle" style={{ fontSize: 12 }}>
                  nextBlindId: {nextBlindId !== undefined ? nextBlindId.toString() : '…'} • loaded: {activeBlind.length}
                  {isLoadingBlind ? ' • loading…' : ''}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <select className="input" style={selectStyle} value={mineFilter} onChange={(e) => setMineFilter(e.target.value)}>
                  <option style={optionStyle} value="all">All</option>
                  <option style={optionStyle} value="mine">My auctions</option>
                  <option style={optionStyle} value="others">Others</option>
                </select>
                <select className="input" style={selectStyle} value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)}>
                  <option style={optionStyle} value="all">All phases</option>
                  <option style={optionStyle} value="commit">Commit</option>
                  <option style={optionStyle} value="reveal">Reveal</option>
                  <option style={optionStyle} value="ended">Ended</option>
                </select>
                <select className="input" style={selectStyle} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option style={optionStyle} value="new">Newest</option>
                  <option style={optionStyle} value="endingSoon">Ending soon</option>
                  <option style={optionStyle} value="priceAsc">Reserve ↑</option>
                  <option style={optionStyle} value="priceDesc">Reserve ↓</option>
                </select>
              </div>
            </div>

            {!shownBlind.length ? (
              <div style={{ marginTop: 8 }}>No active blind auctions (with current filters).</div>
            ) : (
              <div className="grid" style={{ marginTop: 10 }}>
                {shownBlind.map((a) => {
                  const now = nowSec()
                  const inCommit = now < Number(a.commitEndTime)
                  const inReveal = now >= Number(a.commitEndTime) && now < Number(a.revealEndTime)
                  const ended = now >= Number(a.revealEndTime)

                  const isSeller = a.seller?.toLowerCase() === address?.toLowerCase()
                  const hasWinner = a.highestBidder && a.highestBidder !== '0x0000000000000000000000000000000000000000'

                  return (
                    <div key={`blind-${a.id}`} className="card" style={{ padding: 12 }}>
                      <div><b>ID:</b> {a.id}</div>
                      <div><b>Seller:</b> {a.seller}</div>
                      <div><b>Amount:</b> {a.amountCAC?.toString?.() || String(a.amountCAC)} CAC</div>
                      <div><b>Reserve:</b> {formatEther(a.reserveWei)} ETH</div>
                      <div><b>Commit ends:</b> {new Date(Number(a.commitEndTime) * 1000).toLocaleString()}</div>
                      <div><b>Reveal ends:</b> {new Date(Number(a.revealEndTime) * 1000).toLocaleString()}</div>
                      <div><b>Highest (revealed):</b> {formatEther(a.highestBid || 0n)} ETH</div>
                      <div className="subtle" style={{ fontSize: 12, marginTop: 6 }}>
                        Phase: {inCommit ? 'COMMIT' : inReveal ? 'REVEAL' : ended ? 'ENDED' : '—'}
                      </div>

                      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {inCommit && (
                          <>
                            <input
                              className="input"
                              style={{ maxWidth: 140 }}
                              value={bidInput(a.id)}
                              onChange={(e) => setBidEth(a.id, e.target.value)}
                              placeholder="Bid ETH"
                            />
                            <button className="btn primary" onClick={() => commitBlind(a.id)} disabled={isPending}>
                              Commit bid
                            </button>
                          </>
                        )}

                        {inReveal && (
                          <button className="btn primary" onClick={() => revealBlind(a.id)} disabled={isPending}>
                            Reveal bid
                          </button>
                        )}

                        {ended && isSeller && (
                          hasWinner ? (
                            <button className="btn primary" onClick={() => finalizeBlind(a.id)} disabled={isPending}>
                              Finalize
                            </button>
                          ) : (
                            <button className="btn" onClick={() => cancelBlind(a.id)} disabled={isPending}>
                              Cancel (no winner)
                            </button>
                          )
                        )}

                        {ended && (
                          <button className="btn" onClick={() => prepareUnrevealedRefund(a.id)} disabled={isPending}>
                            Prepare unrevealed refund
                          </button>
                        )}

                        {isSeller && (
                          <span className="subtle" style={{ fontSize: 12 }}>(Seller tools)</span>
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
              <li><b>Commit</b>: küldesz ETH depositot + hash-t (bid összeg elrejtve).</li>
              <li><b>Reveal</b>: később felfeded a bid + salt párost.</li>
              <li><b>Refund</b>: túllicitált / visszajáró összegek a <code>pendingRefund</code>-ból vehetők fel.</li>
              <li className="subtle">Ha másik böngészőn/PC-n reveal-elsz, nem lesz meg a localStorage (salt).</li>
            </ul>
          </section>
        </div>
      </div>
    </>
  )
}
