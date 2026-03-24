'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useWriteContract,
  useWatchContractEvent,
} from 'wagmi'
import { injected } from 'wagmi/connectors'

import { allowance20Abi } from '../abi/Allowance20'
import { cacRegistryAbi } from '../abi/CacRegistry'

const CAC = process.env.NEXT_PUBLIC_ALLOWANCE20_ADDRESS
const REG = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS

const isHexAddress = (x) => typeof x === 'string' && /^0x[0-9a-fA-F]{40}$/.test(x)

const DashboardMarketOverview = dynamic(() => import('../components/DashboardMarketOverview'), {
  ssr: false,
  loading: () => (
    <section className="card col-8">
      <h3 style={{ margin: 0 }}>Marketplace overview</h3>
      <div className="subtle" style={{ marginTop: 10 }}>Loading market stats...</div>
    </section>
  ),
})

function short(addr) {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : ''
}

export default function Dashboard() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const { address, isConnected, status: accountStatus } = useAccount()
  const { connect, connectors, status: connectStatus, error: connectError } = useConnect()
  const { disconnect } = useDisconnect()

  const validCAC = isHexAddress(CAC)
  const validREG = isHexAddress(REG)
  const busy = !mounted || connectStatus !== 'idle' || accountStatus === 'reconnecting'

  function doConnect() {
    if (busy || isConnected) return
    const inj = connectors.find((c) => c.id === 'injected' || c.type === 'injected') || injected()
    connect({ connector: inj })
  }

  const { writeContract, isPending: isTxPending, error: txError, data: txHash } = useWriteContract()

  const { data: balance, refetch: refetchBal } = useReadContract({
    abi: allowance20Abi,
    address: validCAC ? CAC : undefined,
    functionName: 'balanceOf',
    args: mounted && address && validCAC ? [address] : undefined,
    query: { enabled: mounted && !!address && validCAC },
  })

  const { data: quota, refetch: refetchQuota } = useReadContract({
    abi: allowance20Abi,
    address: validCAC ? CAC : undefined,
    functionName: 'remainingQuota',
    args: mounted && address && validCAC ? [address] : undefined,
    query: { enabled: mounted && !!address && validCAC },
  })

  const { data: myProfile, refetch: refetchProfile } = useReadContract({
    abi: cacRegistryAbi,
    address: validREG ? REG : undefined,
    functionName: 'profiles',
    args: mounted && address && validREG ? [address] : undefined,
    query: { enabled: mounted && !!address && validREG },
  })
  const isApproved = myProfile ? Boolean(myProfile[4]) : false

  const periodId = new Date().getFullYear()
  const ZERO32 = '0x' + '00'.repeat(32)
  const evidenceURI = 'data:application/json;utf8,%7B%7D'

  const [sAmount, setSAmount] = useState('10')
  const [tTo, setTTo] = useState('')
  const [tAmount, setTAmount] = useState('5')

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
  }

  useEffect(() => {
    if (!txHash) return
    refetchBal()
    refetchQuota()
    refetchProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txHash])

  useWatchContractEvent({
    abi: allowance20Abi,
    address: validCAC ? CAC : undefined,
    eventName: 'Surrendered',
    onLogs: () => {
      refetchBal()
      refetchQuota()
    },
  })

  if (!mounted) return null

  return (
    <>
      <h1 className="page-title">Dashboard</h1>

      <div className="cards">
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
                {busy ? 'Please wait...' : 'Connect wallet'}
              </button>
            ) : (
              <button className="btn" onClick={() => disconnect()}>Disconnect</button>
            )}

            {isConnected && (
              <span className="subtle" style={{ fontSize: 12 }}>
                Quota: <b>{quota !== undefined ? quota.toString() : '...'}</b>
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

        <DashboardMarketOverview refreshTrigger={txHash} />

        <section className="card col-6">
          <h3 style={{ marginTop: 0 }}>Surrender credits</h3>
          <p className="subtle">Adj meg egy mennyiseget (egesz CAC). A tobbi demo automatikus.</p>

          <label>
            Amount (whole CAC)
            <input className="input" value={sAmount} onChange={(e) => setSAmount(e.target.value)} inputMode="numeric" />
          </label>

          <div className="subtle" style={{ marginTop: 8, fontSize: 12 }}>
            Period: {periodId} • Evidence: auto
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn"
              onClick={doSurrender}
              disabled={!isConnected || isTxPending || !sAmount || !isApproved}
              title={!isApproved ? 'KYC pending/rejected - surrender disabled' : ''}
            >
              {isTxPending ? 'Submitting...' : 'Surrender now'}
            </button>
            {txError && <span style={{ color: 'crimson', fontSize: 12 }}>{txError.message}</span>}
          </div>
        </section>

        <section className="card col-6">
          <h3 style={{ marginTop: 0 }}>Transfer credits</h3>
          <p className="subtle">Kreditek atkuldese masik walletre ERC-20 transferrel.</p>

          <div className="grid grid-2">
            <label>
              Recipient address
              <input className="input" placeholder="0xrecipient..." value={tTo} onChange={(e) => setTTo(e.target.value)} />
            </label>
            <label>
              Amount
              <input className="input" value={tAmount} onChange={(e) => setTAmount(e.target.value)} inputMode="numeric" />
            </label>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            <button className="btn" onClick={doTransfer} disabled={!isConnected || isTxPending || !tTo || !tAmount}>
              {isTxPending ? 'Submitting...' : 'Transfer'}
            </button>
          </div>
        </section>
      </div>
    </>
  )
}
