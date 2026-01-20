'use client'
import { useEffect, useState } from 'react'
import { useAccount, useReadContract, useWriteContract } from 'wagmi'
import { allowance20Abi } from '../../abi/Allowance20'

const CAC = process.env.NEXT_PUBLIC_ALLOWANCE20_ADDRESS

export default function MintFromQuotaPage() {
  const { address, isConnected } = useAccount()
  const { data: remaining, refetch } = useReadContract({
    abi: allowance20Abi,
    address: CAC,
    functionName: 'remainingQuota',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  const { writeContract, isPending, error: txError, data: txHash } = useWriteContract()
  const [amt, setAmt] = useState('0')

  useEffect(() => { if (txHash) refetch() }, [txHash, refetch])

  const can = Number(remaining ?? 0n)
  const nAmt = Math.max(0, Math.floor(Number(amt || '0')))
  const over = nAmt > can

  function doMint() {
    if (!isConnected) return
    if (!nAmt || over) return
    writeContract({
      abi: allowance20Abi,
      address: CAC,
      functionName: 'mintFromQuota',
      args: [BigInt(nAmt)],
    })
  }

  return (
    <main className="page">
      <h1 className="page-title">Mint from quota</h1>
      <section className="card col-6">
        <div className="kpi">{isConnected ? String(can) : '…'}<small> &nbsp;quota left</small></div>

        <div style={{marginTop:12}}>
          <label>Amount to mint (max {can})
            <input className="input" value={amt} onChange={e=>setAmt(e.target.value)} inputMode="numeric"/>
          </label>
          {over && <div style={{color:'crimson', marginTop:6}}>Too much — max {can}.</div>}
        </div>

        <div style={{display:'flex', gap:12, marginTop:12}}>
          <button className="btn" onClick={doMint} disabled={!isConnected || isPending || !nAmt || over}>
            {isPending ? 'Minting…' : 'Mint'}
          </button>
          {txError && <span style={{color:'crimson', fontSize:12}}>{txError.message}</span>}
        </div>

        <p className="subtle" style={{marginTop:10}}>
          A kvótát a **külön dummy oldal** állítja be on-chain a <code>setMintQuota(user, quota)</code> hívással.
        </p>
      </section>
    </main>
  )
}
