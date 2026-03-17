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
import { bundleSaleMarketAbi } from '../../../abi/BundleSaleMarket'
import { isHexAddress, prettyError, shortAddr } from '../../../lib/marketplaceHelpers'

const CAC = process.env.NEXT_PUBLIC_ALLOWANCE20_ADDRESS
const BUNDLE = process.env.NEXT_PUBLIC_MARKET_BUNDLE_ADDRESS

const SAFE_GAS = 800_000n

function normalizeBundleHead(x) {
  // getBundle returns: (_id, seller, totalCAC, remainingCAC, tierCount, status)
  if (!Array.isArray(x)) return null
  return {
    id: Number(x[0] ?? 0),
    seller: String(x[1]),
    totalCAC: BigInt(x[2] ?? 0),
    remainingCAC: BigInt(x[3] ?? 0),
    tierCount: Number(x[4] ?? 0),
    status: Number(x[5] ?? 0),
  }
}

export default function MarketplaceBundlePage() {
  const { address, isConnected } = useAccount()
  const { writeContract, isPending, error: txError, data: txHash } = useWriteContract()

  const validCAC = isHexAddress(CAC)
  const validB = isHexAddress(BUNDLE)

  const [notice, setNotice] = useState('')

  /**
   * ---------------- CREATE (tiered) ----------------
   */
  const [inventory, setInventory] = useState('70') // total CAC deposit
  const [tiers, setTiers] = useState([
    { amount: '10', priceEth: '5' },
    { amount: '20', priceEth: '9' },
    { amount: '40', priceEth: '16' },
  ])

  const inventoryBI = useMemo(() => {
    try {
      return BigInt(inventory || '0')
    } catch {
      return 0n
    }
  }, [inventory])

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    abi: allowance20Abi,
    address: validCAC ? CAC : undefined,
    functionName: 'allowance',
    args: address && validCAC ? [address, BUNDLE] : undefined,
    query: { enabled: !!address && validCAC && validB },
  })

  function needAllowanceFor(amountBI) {
    if (allowance === undefined || allowance === null) return true
    try {
      return BigInt(allowance) < BigInt(amountBI)
    } catch {
      return true
    }
  }

  function approve() {
    setNotice('')
    if (!validCAC) return
    if (inventoryBI <= 0n) {
      setNotice('Inventory must be > 0.')
      return
    }
    try {
      writeContract({
        abi: allowance20Abi,
        address: CAC,
        functionName: 'approve',
        args: [BUNDLE, inventoryBI],
        gas: SAFE_GAS,
      })
    } catch (e) {
      setNotice(prettyError(e))
    }
  }

  function addTier() {
    setTiers((t) => [...t, { amount: '10', priceEth: '1' }])
  }
  function removeTier(i) {
    setTiers((t) => t.filter((_, idx) => idx !== i))
  }
  function updateTier(i, key, val) {
    setTiers((t) => t.map((row, idx) => (idx === i ? { ...row, [key]: val } : row)))
  }

  function createBundle() {
    setNotice('')
    if (inventoryBI <= 0n) {
      setNotice('Inventory must be > 0.')
      return
    }
    if (!tiers.length) {
      setNotice('Add at least 1 tier.')
      return
    }

    let amounts = []
    let prices = []

    try {
      for (const t of tiers) {
        const a = BigInt(t.amount || '0')
        const p = parseEther(t.priceEth || '0')
        if (a <= 0n) {
          setNotice('Tier amount must be > 0.')
          return
        }
        if (p <= 0n) {
          setNotice('Tier price must be > 0.')
          return
        }
        amounts.push(a)
        prices.push(p)
      }
    } catch {
      setNotice('Invalid tier input (amount or price).')
      return
    }

    const maxTier = amounts.reduce((m, x) => (x > m ? x : m), 0n)
    if (maxTier > inventoryBI) {
      setNotice(`Inventory must be >= max tier amount (${maxTier.toString()} CAC).`)
      return
    }

    if (needAllowanceFor(inventoryBI)) {
      setNotice('Approve needed first (allowance is lower than inventory).')
      return
    }

    try {
      writeContract({
        abi: bundleSaleMarketAbi,
        address: BUNDLE,
        functionName: 'listBundle',
        args: [inventoryBI, amounts, prices],
        gas: SAFE_GAS,
      })
    } catch (e) {
      setNotice(prettyError(e))
    }
  }

  /**
   * ---------------- READ ----------------
   */
  const { data: nextId, refetch: refetchNextId } = useReadContract({
    abi: bundleSaleMarketAbi,
    address: validB ? BUNDLE : undefined,
    functionName: 'nextId',
    query: { enabled: validB },
  })

  const ids = useMemo(() => {
    const n = nextId ? Number(nextId) : 0
    return n > 0 ? Array.from({ length: n }, (_, i) => i) : []
  }, [nextId])

  const { data: headsRaw, refetch: refetchHeads } = useReadContracts({
    contracts: ids.map((id) => ({
      abi: bundleSaleMarketAbi,
      address: BUNDLE,
      functionName: 'getBundle',
      args: [BigInt(id)],
    })),
    query: { enabled: validB && ids.length > 0 },
  })

  const heads = useMemo(() => {
    if (!headsRaw) return []
    return headsRaw.map((r) => (r?.result ? normalizeBundleHead(r.result) : null)).filter(Boolean)
  }, [headsRaw])

  const active = useMemo(
    () => heads.filter((b) => b.status === 0 && b.remainingCAC > 0n),
    [heads]
  )

  const tierCalls = useMemo(
    () =>
      active.map((b) => ({
        abi: bundleSaleMarketAbi,
        address: BUNDLE,
        functionName: 'getTiers',
        args: [BigInt(b.id)],
      })),
    [active]
  )

  const { data: tiersRaw, refetch: refetchTiers } = useReadContracts({
    contracts: tierCalls,
    query: { enabled: validB && tierCalls.length > 0 },
  })

  const tiersById = useMemo(() => {
    const map = new Map()
    if (!tiersRaw) return map

    for (let i = 0; i < active.length; i++) {
      const b = active[i]
      const r = tiersRaw[i]?.result
      if (!r) continue
      const amounts = Array.isArray(r[0]) ? r[0].map((x) => BigInt(x)) : []
      const prices = Array.isArray(r[1]) ? r[1].map((x) => BigInt(x)) : []
      map.set(b.id, { amounts, prices })
    }
    return map
  }, [tiersRaw, active])

  /**
   * ✅ Tier selection state per bundle (hook-safe)
   */
  const [selectedTierById, setSelectedTierById] = useState({})

  // Keep selected tier index in range when tiers load/change
  useEffect(() => {
    setSelectedTierById((prev) => {
      const next = { ...prev }
      for (const b of active) {
        const t = tiersById.get(b.id)
        const n = Math.min(t?.amounts?.length || 0, t?.prices?.length || 0)
        const cur = Number(next[b.id] ?? 0)
        if (n <= 0) {
          next[b.id] = 0
        } else if (cur >= n) {
          next[b.id] = 0
        }
      }
      return next
    })
  }, [active, tiersById])

  function setTier(bundleId, tierIndex) {
    setSelectedTierById((prev) => ({ ...prev, [bundleId]: tierIndex }))
  }

  function buyTier(bundleId, tierIndex, priceWei) {
    setNotice('')
    try {
      writeContract({
        abi: bundleSaleMarketAbi,
        address: BUNDLE,
        functionName: 'buyTier',
        args: [BigInt(bundleId), BigInt(tierIndex)],
        value: priceWei,
        gas: SAFE_GAS,
      })
    } catch (e) {
      setNotice(prettyError(e))
    }
  }

  function cancel(bundleId) {
    setNotice('')
    try {
      writeContract({
        abi: bundleSaleMarketAbi,
        address: BUNDLE,
        functionName: 'cancel',
        args: [BigInt(bundleId)],
        gas: SAFE_GAS,
      })
    } catch (e) {
      setNotice(prettyError(e))
    }
  }

  const doRefetchAll = () => {
    refetchAllowance()
    refetchNextId()
    refetchHeads()
    refetchTiers()
  }

  useWatchContractEvent({ abi: bundleSaleMarketAbi, address: validB ? BUNDLE : undefined, eventName: 'Listed', onLogs: doRefetchAll })
  useWatchContractEvent({ abi: bundleSaleMarketAbi, address: validB ? BUNDLE : undefined, eventName: 'Bought', onLogs: doRefetchAll })
  useWatchContractEvent({ abi: bundleSaleMarketAbi, address: validB ? BUNDLE : undefined, eventName: 'Cancelled', onLogs: doRefetchAll })

  useEffect(() => { if (txHash) doRefetchAll() }, [txHash]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setInterval(doRefetchAll, 8000); return () => clearInterval(t) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!validB) {
    return (
      <div className="card">
        <b>Missing NEXT_PUBLIC_MARKET_BUNDLE_ADDRESS</b>
        <div className="subtle" style={{ marginTop: 8 }}>
          <code>{String(BUNDLE)}</code>
        </div>
      </div>
    )
  }

  if (!isConnected) return <div className="card">Please connect your wallet.</div>
  const errText = prettyError(txError)

  return (
    <>
      <h1 className="page-title">Marketplace • Bundle sale (tiers)</h1>

      <div className="cards">
        <div className="col-8">
          <section className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <h2 style={{ margin: 0 }}>Create bundle tiers</h2>
              <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={doRefetchAll}>
                Refresh
              </button>
            </div>

            <div className="grid grid-2" style={{ marginTop: 10 }}>
              <label>Inventory (total CAC deposited)
                <input className="input" value={inventory} onChange={(e) => setInventory(e.target.value)} />
              </label>
              <div className="subtle" style={{ alignSelf: 'end', fontSize: 12 }}>
                Buyers purchase one tier at a time; inventory decreases.
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div className="subtle" style={{ fontSize: 12, marginBottom: 6 }}>Tiers (amount → price)</div>

              <div style={{ display: 'grid', gap: 8 }}>
                {tiers.map((t, i) => (
                  <div key={`tier-${i}`} className="card" style={{ padding: 10 }}>
                    <div className="grid grid-3" style={{ gap: 10 }}>
                      <label>Amount (CAC)
                        <input className="input" value={t.amount} onChange={(e) => updateTier(i, 'amount', e.target.value)} />
                      </label>
                      <label>Price (ETH)
                        <input className="input" value={t.priceEth} onChange={(e) => updateTier(i, 'priceEth', e.target.value)} />
                      </label>
                      <div style={{ display: 'flex', alignItems: 'end', gap: 8 }}>
                        <button className="btn" onClick={() => removeTier(i)} disabled={tiers.length <= 1}>
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="btn" onClick={addTier}>Add tier</button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn" onClick={approve} disabled={isPending || !validCAC || inventoryBI <= 0n}>
                Approve inventory
              </button>

              <button
                className="btn primary"
                onClick={createBundle}
                disabled={isPending || inventoryBI <= 0n || needAllowanceFor(inventoryBI)}
                title={needAllowanceFor(inventoryBI) ? 'Approve inventory first' : ''}
              >
                Create bundle tiers
              </button>

              <span className="subtle" style={{ fontSize: 12 }}>
                Allowance: {allowance !== undefined ? allowance.toString() : '…'}
              </span>
            </div>

            {!!notice && <div style={{ marginTop: 8 }}>{notice}</div>}
            {!!errText && <div style={{ color: 'crimson', marginTop: 8 }}>{errText}</div>}
          </section>

          <section className="card" style={{ marginTop: 16 }}>
            <h2 style={{ margin: 0 }}>Active bundles</h2>
            <div className="subtle" style={{ fontSize: 12, marginTop: 6 }}>
              nextId: {nextId !== undefined ? nextId.toString() : '…'} • loaded(active): {active.length}
            </div>

            {!active.length ? (
              <div style={{ marginTop: 10 }}>No active bundles.</div>
            ) : (
              <div className="grid" style={{ marginTop: 10 }}>
                {active.map((b) => {
                  const mine = b.seller?.toLowerCase() === address?.toLowerCase()
                  const t = tiersById.get(b.id) || { amounts: [], prices: [] }

                  const amounts = Array.isArray(t.amounts) ? t.amounts : []
                  const prices = Array.isArray(t.prices) ? t.prices : []
                  const n = Math.min(amounts.length, prices.length)

                  const sel = Number(selectedTierById[b.id] ?? 0)
                  const tierIndex = n > 0 ? Math.min(sel, n - 1) : 0

                  const amount = n > 0 ? amounts[tierIndex] : 0n
                  const price = n > 0 ? prices[tierIndex] : 0n

                  return (
                    <div key={`bundle-${b.id}`} className="card" style={{ padding: 12 }}>
                      <div><b>ID:</b> {b.id}</div>
                      <div><b>Seller:</b> {shortAddr(b.seller)}</div>
                      <div><b>Inventory:</b> {b.remainingCAC.toString()} / {b.totalCAC.toString()} CAC</div>

                      <div style={{ marginTop: 10 }}>
                        <div className="subtle" style={{ fontSize: 12, marginBottom: 6 }}>Choose tier</div>
                        {n === 0 ? (
                          <div className="subtle">Loading tiers…</div>
                        ) : (
                          <select
                            className="input"
                            style={{ width: '100%', color: 'var(--text)', background: 'var(--panel)' }}
                            value={String(tierIndex)}
                            onChange={(e) => setTier(b.id, Number(e.target.value))}
                          >
                            {Array.from({ length: n }, (_, i) => (
                              <option key={`tieropt-${b.id}-${i}`} value={String(i)} style={{ color: '#111', background: '#fff' }}>
                                {amounts[i].toString()} CAC → {formatEther(prices[i])} ETH
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                        <button
                          className="btn primary"
                          onClick={() => buyTier(b.id, tierIndex, price)}
                          disabled={isPending || n === 0 || amount <= 0n || amount > b.remainingCAC}
                          title={amount > b.remainingCAC ? 'Not enough inventory for this tier' : ''}
                        >
                          Buy {amount.toString()} CAC ({formatEther(price)} ETH)
                        </button>

                        {mine && (
                          <button className="btn" onClick={() => cancel(b.id)} disabled={isPending}>
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
              <li>Tier selection is stored in parent state (hook-safe).</li>
              <li>Uses getBundle + getTiers, so listázás nem fog “eltűnni” a dinamikus tömb miatt.</li>
              <li>SAFE_GAS included to avoid 21M fallback.</li>
            </ul>
          </section>
        </div>
      </div>
    </>
  )
}
