'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import QRCode from 'react-qr-code'
import { parseAbiItem } from 'viem'
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWaitForTransactionReceipt,
  useWatchContractEvent,
  useWriteContract,
} from 'wagmi'
import { cacRegistryAbi } from '../../abi/CacRegistry'
import { getLogsInChunks } from '../../lib/getLogsInChunks'

const REG = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS
const CAC = process.env.NEXT_PUBLIC_ALLOWANCE20_ADDRESS
const GATEWAY =
  (typeof process !== 'undefined' && (process.env.PINATA_GATEWAY || process.env.NEXT_PUBLIC_PINATA_GATEWAY)) ||
  'https://gateway.pinata.cloud/ipfs/'

const REGISTERED_EVENT = parseAbiItem(
  'event Registered(address indexed user, string displayName, bytes32 taxIdHash, string metadataURI)'
)
const SURRENDER_LOGGED_EVENT = parseAbiItem(
  'event SurrenderLogged(address indexed user, uint256 amount, uint16 periodId, uint256 timestamp, string displayName, bytes32 taxIdHash, string metadataURI, string docsURI)'
)

function resolveIpfs(uri) {
  if (!uri) return ''
  if (uri.startsWith('ipfs://')) return GATEWAY.replace(/\/$/, '/') + uri.slice('ipfs://'.length)
  return uri
}

export default function AdminPage() {
  const { address, isConnected } = useAccount()
  const client = usePublicClient()

  const { writeContract, isPending, error: txError, data: txHash } = useWriteContract()
  const { isSuccess: txMined } = useWaitForTransactionReceipt({ hash: txHash })

  const { data: operatorAddr } = useReadContract({
    abi: cacRegistryAbi,
    address: REG,
    functionName: 'operator',
  })

  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [rows, setRows] = useState([])

  const [surrLogs, setSurrLogs] = useState([])
  const [surrLoading, setSurrLoading] = useState(false)
  const [surrErr, setSurrErr] = useState('')

  const isOperator = useMemo(() => {
    if (!address || !operatorAddr) return false
    return address.toLowerCase() === operatorAddr.toLowerCase()
  }, [address, operatorAddr])

  const fetchMeta = useCallback(async (metadataURI) => {
    if (!metadataURI) return null
    try {
      const resp = await fetch(resolveIpfs(metadataURI))
      if (!resp.ok) return null
      return await resp.json().catch(() => null)
    } catch {
      return null
    }
  }, [])

  const load = useCallback(async () => {
    if (!client) return

    setLoading(true)
    setErr('')

    try {
      const logs = await getLogsInChunks(client, {
        address: REG,
        event: REGISTERED_EVENT,
        toBlock: 'latest',
      })

      const users = Array.from(new Set(logs.map((log) => log.args.user.toLowerCase())))
      if (!users.length) {
        setRows([])
        return
      }

      const profiles = await Promise.all(
        users.map(async (user) => {
          try {
            const res = await client.readContract({
              abi: cacRegistryAbi,
              address: REG,
              functionName: 'profiles',
              args: [user],
            })
            const note = await client.readContract({
              abi: cacRegistryAbi,
              address: REG,
              functionName: 'kycNote',
              args: [user],
            })
            return { user, ok: true, res, note }
          } catch (error) {
            return { user, ok: false, error }
          }
        })
      )

      const enriched = await Promise.all(
        profiles.map(async (profile) => {
          if (!profile.ok || !profile.res) return { user: profile.user, exists: false }

          const [displayName, taxIdHash, metadataURI, docsURI, kycApproved, exists] = profile.res
          const metaParsed = await fetchMeta(metadataURI)

          return {
            user: profile.user,
            displayName,
            taxIdHash,
            metadataURI,
            docsURI,
            kycApproved,
            exists,
            metaParsed,
            kycNote: profile.note || '',
          }
        })
      )

      setRows(enriched.filter((row) => row.exists))
    } catch (error) {
      setErr(error?.message || String(error))
    } finally {
      setLoading(false)
    }
  }, [client, fetchMeta])

  const loadSurrenders = useCallback(async () => {
    if (!client) return

    setSurrLoading(true)
    setSurrErr('')

    try {
      const logs = await getLogsInChunks(client, {
        address: CAC,
        event: SURRENDER_LOGGED_EVENT,
        toBlock: 'latest',
      })

      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const nextRows = logs
        .map((log, index) => {
          const txHash = log.transactionHash
          const url = `/receipt/${txHash}`
          return {
            key: `${log.blockHash}:${index}`,
            txHash,
            user: String(log.args.user),
            amount: String(log.args.amount),
            periodId: String(log.args.periodId),
            timestamp: Number(log.args.timestamp),
            displayName: log.args.displayName,
            url,
            payload: origin ? `${origin}${url}` : url,
          }
        })
        .reverse()

      setSurrLogs(nextRows)
    } catch (error) {
      setSurrErr(error?.message || String(error))
    } finally {
      setSurrLoading(false)
    }
  }, [client])

  useEffect(() => {
    if (client && isOperator) {
      load()
      loadSurrenders()
    }
  }, [client, isOperator, load, loadSurrenders])

  useEffect(() => {
    if (txMined) load()
  }, [txMined, load])

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
  useWatchContractEvent({
    abi: [SURRENDER_LOGGED_EVENT],
    address: CAC,
    eventName: 'SurrenderLogged',
    onLogs: () => loadSurrenders(),
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
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn" onClick={load} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <span className="subtle">
            Current operator: <code>{operatorAddr || '...'}</code>
          </span>
          {txError && <span style={{ color: 'crimson' }}>{txError.message}</span>}
          {err && <span style={{ color: 'crimson' }}>{err}</span>}
        </div>

        {!err && (
          <div className="subtle" style={{ marginTop: 10 }}>
            Showing recent registration events from a rolling block window to fit the Alchemy free-tier log limit.
          </div>
        )}

        {!rows.length ? (
          <div style={{ marginTop: 12 }}>No registrations found.</div>
        ) : (
          <div className="grid" style={{ marginTop: 12 }}>
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

                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0 }}>Surrenders (all users)</h2>
          <button className="btn" onClick={loadSurrenders} disabled={surrLoading}>
            {surrLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {surrErr && <div style={{ color: 'crimson', marginTop: 10 }}>{surrErr}</div>}
        {!surrErr && (
          <div className="subtle" style={{ marginTop: 8 }}>
            Showing recent surrender events from a rolling block window to fit the Alchemy free-tier log limit.
          </div>
        )}

        <div className="subtle" style={{ marginTop: 8 }}>Total events: {surrLogs.length}</div>

        {!surrLogs.length ? (
          <div style={{ marginTop: 12 }}>No surrender events.</div>
        ) : (
          <div className="grid" style={{ marginTop: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            {surrLogs.map((item) => (
              <div key={item.key} className="card" style={{ padding: 12, display: 'flex', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
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
                    <b>Tx:</b> <a href={item.url}>{item.txHash}</a>
                  </div>
                </div>

                <a href={item.url} title="Open receipt" style={{ display: 'block', width: 110, height: 110 }}>
                  <QRCode value={item.payload} size={110} />
                </a>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
