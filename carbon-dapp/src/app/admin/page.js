'use client'

import { useEffect, useMemo, useState } from 'react'
import QRCode from 'react-qr-code'
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWatchContractEvent,
  useWriteContract,
} from 'wagmi'
import { cacRegistryAbi } from '../../abi/CacRegistry'

const REG = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS
const GATEWAY =
  (typeof process !== 'undefined' && (process.env.PINATA_GATEWAY || process.env.NEXT_PUBLIC_PINATA_GATEWAY)) ||
  'https://gateway.pinata.cloud/ipfs/'

function resolveIpfs(uri) {
  if (!uri) return ''
  if (uri.startsWith('ipfs://')) return GATEWAY.replace(/\/$/, '/') + uri.slice('ipfs://'.length)
  return uri
}

export default function AdminPage() {
  const { address, isConnected } = useAccount()
  const { writeContract, isPending, error: txError, data: txHash } = useWriteContract()
  const { isSuccess: txMined } = useWaitForTransactionReceipt({ hash: txHash })

  const { data: operatorAddr } = useReadContract({
    abi: cacRegistryAbi,
    address: REG,
    functionName: 'operator',
  })

  const operatorLoaded = Boolean(operatorAddr)
  const isOperator = useMemo(() => {
    if (!address || !operatorAddr) return false
    return address.toLowerCase() === operatorAddr.toLowerCase()
  }, [address, operatorAddr])

  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [rows, setRows] = useState([])

  const [surrLogs, setSurrLogs] = useState([])
  const [surrLoading, setSurrLoading] = useState(false)
  const [surrErr, setSurrErr] = useState('')

  async function load() {
    try {
      setLoading(true)
      setErr('')
      const response = await fetch('/api/admin/registrations', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Failed to load registrations')
      setRows(data.rows || [])
    } catch (error) {
      setErr(error?.message || String(error))
    } finally {
      setLoading(false)
    }
  }

  async function loadSurrenders() {
    try {
      setSurrLoading(true)
      setSurrErr('')
      const response = await fetch('/api/admin/surrenders', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Failed to load surrender events')
      setSurrLogs(data.rows || [])
    } catch (error) {
      setSurrErr(error?.message || String(error))
    } finally {
      setSurrLoading(false)
    }
  }

  useEffect(() => {
    if (isOperator) {
      load()
      loadSurrenders()
    }
  }, [isOperator])

  useEffect(() => {
    if (txMined) load()
  }, [txMined])

  useWatchContractEvent({
    abi: cacRegistryAbi,
    address: REG,
    eventName: 'KycApproved',
    onLogs: () => load(),
  })
  useWatchContractEvent({
    abi: cacRegistryAbi,
    address: REG,
    eventName: 'KycDecision',
    onLogs: () => load(),
  })

  function approve(user) {
    writeContract({
      abi: cacRegistryAbi,
      address: REG,
      functionName: 'approveKyc',
      args: [user, true],
    })
  }

  function rejectWithReason(user) {
    const reason = window.prompt('Add a short rejection reason:')
    if (!reason) return
    writeContract({
      abi: cacRegistryAbi,
      address: REG,
      functionName: 'rejectKyc',
      args: [user, reason],
    })
  }

  if (!isConnected) return <div className="card">Please connect your wallet.</div>
  if (!operatorLoaded) return <div className="card">Loading operator permissions...</div>
  if (!isOperator) {
    return (
      <div className="card">
        <h2>Admin</h2>
        <p className="subtle">
          Only the operator can open this page.
          <br />
          Current operator: <code>{operatorAddr || '...'}</code>
          <br />
          Your address: <code>{address}</code>
        </p>
      </div>
    )
  }

  return (
    <main className="page">
      <h1 className="page-title">Admin - KYC approvals</h1>

      <section className="card col-12">
        <div className="toolbar">
          <button className="btn" onClick={load} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <span className="subtle">
            Current operator: <code>{operatorAddr || '...'}</code>
          </span>
          {txError && <span style={{ color: 'crimson' }}>{txError.message}</span>}
          {err && <span style={{ color: 'crimson' }}>{err}</span>}
        </div>

        {!rows.length ? (
          <div style={{ marginTop: 12 }}>No registrations found.</div>
        ) : (
          <div className="stack" style={{ marginTop: 12 }}>
            {rows.map((row) => {
              const meta = row.metaParsed || {}
              const email = meta?.contact?.email || '-'
              const city = meta?.address?.city || '-'
              const street = meta?.address?.street || '-'
              const metaUrl = resolveIpfs(row.metadataURI)
              const docsUrl = resolveIpfs(row.docsURI)

              return (
                <div key={row.user} className="card" style={{ padding: 12 }}>
                  <div><b>User:</b> {row.user}</div>
                  <div><b>Name:</b> {row.displayName}</div>
                  <div style={{ marginTop: 6 }}><b>Contact email:</b> {email}</div>
                  <div><b>City:</b> {city} &nbsp; <b>Street:</b> {street}</div>
                  <div style={{ marginTop: 6 }}>
                    <b>Metadata JSON:</b>{' '}
                    {row.metadataURI ? <a href={metaUrl} target="_blank" rel="noreferrer">{row.metadataURI}</a> : '-'}
                  </div>
                  <div>
                    <b>Ownership deed:</b>{' '}
                    {row.docsURI ? (
                      <a className="btn" href={docsUrl} target="_blank" rel="noreferrer">Open deed</a>
                    ) : (
                      <span style={{ color: '#eab308' }}>missing</span>
                    )}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <b>KYC state:</b>{' '}
                    <span className={`badge ${row.kycApproved ? 'ok' : 'warn'}`}>
                      {row.kycApproved ? 'APPROVED' : 'PENDING/REJECTED'}
                    </span>
                  </div>
                  {!row.kycApproved && row.kycNote && (
                    <div style={{ marginTop: 4, color: '#b45309' }}>
                      <b>Reject note:</b> {row.kycNote}
                    </div>
                  )}
                  <div className="inline-actions" style={{ marginTop: 10 }}>
                    {!row.kycApproved && (
                      <button className="btn" disabled={isPending} onClick={() => approve(row.user)}>
                        Approve
                      </button>
                    )}
                    <button className="btn" disabled={isPending} onClick={() => rejectWithReason(row.user)}>
                      {row.kycApproved ? 'Revoke' : 'Reject'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="card col-12" style={{ marginTop: 16 }}>
        <div className="toolbar">
          <h2 style={{ margin: 0 }}>Surrenders (all users)</h2>
          <button className="btn" onClick={loadSurrenders} disabled={surrLoading}>
            {surrLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        {surrErr && <div style={{ color: 'crimson', marginTop: 10 }}>{surrErr}</div>}
        <div className="subtle" style={{ marginTop: 8 }}>Total events: {surrLogs.length}</div>
        {!surrLogs.length ? (
          <div style={{ marginTop: 12 }}>No surrender events.</div>
        ) : (
          <div className="qr-list" style={{ marginTop: 12 }}>
            {surrLogs.map((item) => (
              <div key={item.key} className="card qr-list-card" style={{ padding: 12 }}>
                <div className="qr-list-content">
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{item.displayName || item.user}</div>
                  <div className="subtle" style={{ fontSize: 12, marginTop: 4, overflowWrap: 'anywhere' }}>
                    {item.user}
                  </div>
                  <div className="subtle" style={{ marginTop: 6 }}>
                    <b>Amount:</b> {item.amount} CAC &nbsp;|&nbsp; <b>Year:</b> {item.periodId}
                  </div>
                  <div className="subtle" style={{ marginTop: 2 }}>
                    <b>When:</b> {new Date(item.timestamp * 1000).toISOString()}
                  </div>
                  <div className="subtle" style={{ marginTop: 2, overflowWrap: 'anywhere' }}>
                    <b>Tx:</b> <a href={`/receipt/${item.txHash}`}>{item.txHash}</a>
                  </div>
                </div>
                <a href={`/receipt/${item.txHash}`} title="Open receipt" className="qr-list-aside">
                  <div className="qr-frame">
                    <QRCode value={typeof window !== 'undefined' ? `${window.location.origin}/receipt/${item.txHash}` : `/receipt/${item.txHash}`} size={110} />
                  </div>
                </a>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
