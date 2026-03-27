'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import QRCode from 'react-qr-code'
import { usePublicClient } from 'wagmi'
import { decodeEventLog } from 'viem'
import { allowance20Abi } from '../../../abi/Allowance20'

const CAC = process.env.NEXT_PUBLIC_ALLOWANCE20_ADDRESS

export default function ReceiptPage() {
  const { tx } = useParams()
  const client = usePublicClient()
  const [state, setState] = useState({ loading: true, error: '', found: false, data: null })

  useEffect(() => {
    if (!client || !tx) return

    ;(async () => {
      try {
        setState((current) => ({ ...current, loading: true, error: '' }))

        const receipt = await client.getTransactionReceipt({ hash: tx })
        let parsed = null

        for (const log of receipt.logs) {
          if (log.address.toLowerCase() !== CAC?.toLowerCase()) continue

          try {
            const event = decodeEventLog({
              abi: allowance20Abi,
              data: log.data,
              topics: log.topics,
            })

            if (event?.eventName === 'Surrendered') {
              parsed = {
                type: 'Surrendered',
                factory: String(event.args.factory),
                amount: event.args.amount?.toString?.() ?? String(event.args.amount),
                periodId: String(event.args.periodId),
                evidenceURI: String(event.args.evidenceURI),
                vcHash: String(event.args.vcHash),
              }
              break
            }

            if (event?.eventName === 'SurrenderLogged') {
              parsed = {
                type: 'SurrenderLogged',
                user: String(event.args.user),
                amount: event.args.amount?.toString?.() ?? String(event.args.amount),
                periodId: String(event.args.periodId),
                timestamp: Number(event.args.timestamp),
                displayName: String(event.args.displayName),
                taxIdHash: String(event.args.taxIdHash),
                metadataURI: String(event.args.metadataURI),
                docsURI: String(event.args.docsURI),
              }
              break
            }
          } catch {
            // Ignore unrelated logs in the transaction receipt.
          }
        }

        if (!parsed) {
          setState({ loading: false, error: '', found: false, data: null })
          return
        }

        let timestamp = parsed.timestamp
        if (!timestamp) {
          const block = await client.getBlock({ blockHash: receipt.blockHash })
          timestamp = Number(block.timestamp)
        }

        setState({
          loading: false,
          error: '',
          found: true,
          data: {
            txHash: tx,
            blockNumber: receipt.blockNumber?.toString?.() ?? String(receipt.blockNumber),
            timestamp,
            ...parsed,
          },
        })
      } catch (error) {
        setState({
          loading: false,
          error: error?.message || String(error),
          found: false,
          data: null,
        })
      }
    })()
  }, [client, tx])

  if (state.loading) return <div className="card">Loading...</div>
  if (state.error) return <div className="card" style={{ color: 'crimson' }}>{state.error}</div>
  if (!state.found) return <div className="card">No surrender event found in this transaction.</div>

  const data = state.data
  const formattedDate = new Date(data.timestamp * 1000).toLocaleString()
  const receiptUrl = typeof window !== 'undefined' ? window.location.href : data.txHash

  return (
    <main className="page">
      <h1 className="page-title">Surrender receipt</h1>

      <div className="receipt-shell">
        <section className="card receipt-hero">
          <div className="stack">
            <div>
              <div className="subtle">Verified on-chain event</div>
              <h2 style={{ margin: '6px 0 0' }}>{data.type}</h2>
            </div>

            <div className="receipt-meta">
              <div className="receipt-box">
                <span className="receipt-label">Amount</span>
                <div className="receipt-value">{data.amount} CAC</div>
              </div>
              <div className="receipt-box">
                <span className="receipt-label">Reporting year</span>
                <div className="receipt-value">{data.periodId}</div>
              </div>
              <div className="receipt-box">
                <span className="receipt-label">User / factory</span>
                <div className="receipt-value">{data.user || data.factory}</div>
              </div>
              <div className="receipt-box">
                <span className="receipt-label">Confirmed at</span>
                <div className="receipt-value">{formattedDate}</div>
              </div>
            </div>
          </div>

          <div className="qr-panel">
            <div className="qr-frame">
              <QRCode value={receiptUrl} size={160} />
            </div>
            <div className="subtle">Scan to reopen this receipt</div>
          </div>
        </section>

        <section className="card">
          <div className="receipt-meta">
            <div className="receipt-box">
              <span className="receipt-label">Transaction hash</span>
              <div className="receipt-value">{data.txHash}</div>
            </div>
            <div className="receipt-box">
              <span className="receipt-label">Block number</span>
              <div className="receipt-value">{data.blockNumber}</div>
            </div>

            {data.displayName && (
              <div className="receipt-box">
                <span className="receipt-label">Display name</span>
                <div className="receipt-value">{data.displayName}</div>
              </div>
            )}
            {data.taxIdHash && (
              <div className="receipt-box">
                <span className="receipt-label">Tax ID hash</span>
                <div className="receipt-value">{data.taxIdHash}</div>
              </div>
            )}
            {data.metadataURI && (
              <div className="receipt-box">
                <span className="receipt-label">Metadata</span>
                <div className="receipt-value link-wrap">
                  <a href={data.metadataURI} target="_blank" rel="noreferrer">{data.metadataURI}</a>
                </div>
              </div>
            )}
            {data.docsURI && (
              <div className="receipt-box">
                <span className="receipt-label">Docs</span>
                <div className="receipt-value link-wrap">
                  <a href={data.docsURI} target="_blank" rel="noreferrer">{data.docsURI}</a>
                </div>
              </div>
            )}
            {data.vcHash && (
              <div className="receipt-box">
                <span className="receipt-label">VC hash</span>
                <div className="receipt-value">{data.vcHash}</div>
              </div>
            )}
            {data.evidenceURI && (
              <div className="receipt-box">
                <span className="receipt-label">Evidence</span>
                <div className="receipt-value link-wrap">{data.evidenceURI}</div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
