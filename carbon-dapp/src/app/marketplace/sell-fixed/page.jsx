'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWatchContractEvent } from 'wagmi'
import { parseEther, formatEther } from 'viem'

import { allowance20Abi } from '../../../abi/Allowance20'
import { fixedMarketAbi } from '../../../abi/FixedMarket'
import { isHexAddress, prettyError, shortAddr } from '../../../lib/marketplaceHelpers'

const CAC = process.env.NEXT_PUBLIC_ALLOWANCE20_ADDRESS
const FIXED = process.env.NEXT_PUBLIC_MARKET_FIXED_ADDRESS

function normalizeListing(x) {
  if (Array.isArray(x)) {
    return { id:Number(x[0]), seller:String(x[1]), amountCAC:x[2], priceWei:x[3], status:Number(x[4]) }
  }
  return { id:Number(x.id), seller:String(x.seller), amountCAC:x.amountCAC, priceWei:x.priceWei, status:Number(x.status) }
}

export default function FixedPage() {
  const { address, isConnected } = useAccount()
  const { writeContract, isPending, error: txError, data: txHash } = useWriteContract()
  const [notice, setNotice] = useState('')

  const validCAC = isHexAddress(CAC)
  const validFIX = isHexAddress(FIXED)

  const [amount, setAmount] = useState('10')
  const [priceEth, setPriceEth] = useState('0.1')

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    abi: allowance20Abi,
    address: validCAC ? CAC : undefined,
    functionName: 'allowance',
    args: address && validCAC && validFIX ? [address, FIXED] : undefined,
    query: { enabled: !!address && validCAC && validFIX },
  })

  function needAllowanceFor(a) {
    if (allowance == null) return true
    try { return BigInt(allowance) < BigInt(a || '0') } catch { return true }
  }

  function approve(a) {
    setNotice('')
    if (!validCAC || !validFIX) return
    writeContract({ abi: allowance20Abi, address: CAC, functionName: 'approve', args: [FIXED, BigInt(a || '0')] })
  }

  function create() {
    setNotice('')
    if (!amount || !priceEth) return
    if (needAllowanceFor(amount)) return
    writeContract({ abi: fixedMarketAbi, address: FIXED, functionName: 'listFixed', args: [BigInt(amount), parseEther(priceEth)] })
  }

  const { data: nextId, refetch: refetchNextId } = useReadContract({
    abi: fixedMarketAbi, address: validFIX ? FIXED : undefined, functionName: 'nextId',
    query: { enabled: validFIX }
  })

  const ids = useMemo(() => {
    const n = nextId ? Number(nextId) : 0
    return n > 0 ? Array.from({ length: n }, (_, i) => i) : []
  }, [nextId])

  const { data: rowsData, refetch: refetchRows } = useReadContracts({
    contracts: ids.map((id) => ({ abi: fixedMarketAbi, address: FIXED, functionName: 'listings', args: [BigInt(id)] })),
    query: { enabled: validFIX && ids.length > 0 },
  })

  const active = useMemo(() => {
    if (!rowsData) return []
    return rowsData
      .map((r) => (r?.result ? normalizeListing(r.result) : null))
      .filter(Boolean)
      .filter((r) => r.status === 0)
      .sort((a, b) => b.id - a.id)
  }, [rowsData])

  function buy(id, priceWei) {
    setNotice('')
    writeContract({ abi: fixedMarketAbi, address: FIXED, functionName: 'buy', args: [BigInt(id)], value: priceWei })
  }

  function cancel(id) {
    setNotice('')
    writeContract({ abi: fixedMarketAbi, address: FIXED, functionName: 'cancel', args: [BigInt(id)] })
  }

  const doRefetchAll = () => { refetchAllowance(); refetchNextId(); refetchRows() }

  useWatchContractEvent({ abi: fixedMarketAbi, address: validFIX ? FIXED : undefined, eventName: 'Listed', onLogs: doRefetchAll })
  useWatchContractEvent({ abi: fixedMarketAbi, address: validFIX ? FIXED : undefined, eventName: 'Bought', onLogs: doRefetchAll })
  useWatchContractEvent({ abi: fixedMarketAbi, address: validFIX ? FIXED : undefined, eventName: 'Cancelled', onLogs: doRefetchAll })

  useEffect(() => { if (txHash) doRefetchAll() }, [txHash]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setInterval(doRefetchAll, 10000); return () => clearInterval(t) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!validFIX) return <div className="card"><b>Missing NEXT_PUBLIC_MARKET_FIXED_ADDRESS</b></div>
  if (!isConnected) return <div className="card">Please connect your wallet.</div>

  const errText = prettyError(txError)

  return (
    <>
      <h1 className="page-title">Marketplace • Sell fixed</h1>

      <section className="card">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <h2 style={{margin:0}}>Create fixed listing</h2>
          <button className="btn" onClick={doRefetchAll} style={{padding:'6px 10px'}}>Refresh</button>
        </div>

        <div className="grid grid-2" style={{marginTop:10}}>
          <label>Amount (CAC)
            <input className="input" value={amount} onChange={e=>setAmount(e.target.value)} />
          </label>
          <label>Price (ETH)
            <input className="input" value={priceEth} onChange={e=>setPriceEth(e.target.value)} />
          </label>
        </div>

        <div style={{display:'flex', gap:10, marginTop:10, flexWrap:'wrap', alignItems:'center'}}>
          <button className="btn" onClick={() => approve(amount)} disabled={isPending || !amount || !validCAC}>Approve</button>
          <button className="btn primary" onClick={create} disabled={isPending || !amount || !priceEth || needAllowanceFor(amount) || !validCAC}>
            List fixed
          </button>
          <span className="subtle" style={{fontSize:12}}>Allowance: {allowance !== undefined ? allowance.toString() : '…'}</span>
        </div>

        {!!notice && <div style={{marginTop:8}}>{notice}</div>}
        {!!errText && <div style={{marginTop:8, color:'crimson'}}>{errText}</div>}
      </section>

      <section className="card" style={{marginTop:16}}>
        <h2 style={{marginTop:0}}>Active fixed listings</h2>
        <div className="subtle" style={{fontSize:12}}>nextId: {nextId?.toString?.() ?? '…'} • loaded: {active.length}</div>

        {!active.length ? (
          <div style={{marginTop:10}}>No active fixed listings.</div>
        ) : (
          <div className="grid" style={{marginTop:10}}>
            {active.map((r) => {
              const mine = r.seller?.toLowerCase() === address?.toLowerCase()
              return (
                <div key={r.id} className="card" style={{padding:12}}>
                  <div><b>ID:</b> {r.id}</div>
                  <div><b>Seller:</b> {shortAddr(r.seller)}</div>
                  <div><b>Amount:</b> {String(r.amountCAC)} CAC</div>
                  <div><b>Price:</b> {formatEther(r.priceWei)} ETH</div>

                  <div style={{display:'flex', gap:8, marginTop:10, flexWrap:'wrap'}}>
                    <button className="btn primary" onClick={() => buy(r.id, r.priceWei)} disabled={isPending}>
                      Buy
                    </button>
                    {mine && (
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
    </>
  )
}
