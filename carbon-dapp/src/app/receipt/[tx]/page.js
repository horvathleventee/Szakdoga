'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { usePublicClient } from 'wagmi';
import { decodeEventLog } from 'viem';
import { allowance20Abi } from '../../../abi/Allowance20'

const CAC = process.env.NEXT_PUBLIC_ALLOWANCE20_ADDRESS;

export default function ReceiptPage() {
  const { tx } = useParams();               // /receipt/[tx]
  const client = usePublicClient();
  const [state, setState] = useState({ loading: true, error: '', found: false, data: null });

  useEffect(() => {
    if (!client || !tx) return;

    (async () => {
      try {
        setState(s => ({ ...s, loading: true, error: '' }));

        // 1) Tx receipt
        const receipt = await client.getTransactionReceipt({ hash: tx });

        // 2) Event(ek) dekódolása – Surrendered VAGY SurrenderLogged
        let parsed = null;

        for (const log of receipt.logs) {
          if (log.address.toLowerCase() !== CAC?.toLowerCase()) continue;

          try {
            const ev = decodeEventLog({
              abi: allowance20Abi,
              data: log.data,
              topics: log.topics,
            });

            if (ev?.eventName === 'Surrendered') {
              parsed = {
                type: 'Surrendered',
                factory: String(ev.args.factory),
                amount: ev.args.amount?.toString?.() ?? String(ev.args.amount),
                periodId: String(ev.args.periodId),
                evidenceURI: String(ev.args.evidenceURI),
                vcHash: String(ev.args.vcHash),
              };
              break;
            }

            if (ev?.eventName === 'SurrenderLogged') {
              parsed = {
                type: 'SurrenderLogged',
                user: String(ev.args.user),
                amount: ev.args.amount?.toString?.() ?? String(ev.args.amount),
                periodId: String(ev.args.periodId),
                // on-chain timestamp a logban nincs, de az esemény tartalmazza:
                timestamp: Number(ev.args.timestamp),
                displayName: String(ev.args.displayName),
                taxIdHash: String(ev.args.taxIdHash),
                metadataURI: String(ev.args.metadataURI),
                docsURI: String(ev.args.docsURI),
              };
              break;
            }
          } catch {
            // nem ez az event – mehet tovább
          }
        }

        if (!parsed) {
          setState({ loading: false, error: '', found: false, data: null });
          return;
        }

        // 3) Ha nincs timestamp az eventben (Surrendered eset), kérünk blokkot
        let timestamp = parsed.timestamp;
        if (!timestamp) {
          const block = await client.getBlock({ blockHash: receipt.blockHash });
          timestamp = Number(block.timestamp);
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
        });
      } catch (e) {
        setState({ loading: false, error: e?.message || String(e), found: false, data: null });
      }
    })();
  }, [client, tx]);

  if (state.loading) return <div className="card">Loading…</div>;
  if (state.error)   return <div className="card" style={{color:'crimson'}}>{state.error}</div>;
  if (!state.found)  return <div className="card">No surrender event found in this tx</div>;

  const d = state.data;
  const date = new Date(d.timestamp * 1000).toLocaleString();

  return (
    <main className="page">
      <h1 className="page-title">Surrender receipt</h1>
      <section className="card col-12">
        <div><b>Tx:</b> {d.txHash}</div>
        <div><b>Block:</b> {d.blockNumber}</div>
        <div><b>Time:</b> {date}</div>
        <div style={{marginTop:8}}>
          <b>Event:</b> {d.type}
        </div>
        <div className="grid" style={{marginTop:8}}>
          <div><b>User/Factory:</b> {d.user || d.factory}</div>
          <div><b>Amount:</b> {d.amount} CAC</div>
          <div><b>Period:</b> {d.periodId}</div>
          {d.displayName && <div><b>Display name:</b> {d.displayName}</div>}
          {d.taxIdHash && <div><b>Tax ID hash:</b> {d.taxIdHash}</div>}
          {d.metadataURI && <div><b>Metadata:</b> <a href={d.metadataURI} target="_blank" rel="noreferrer">{d.metadataURI}</a></div>}
          {d.docsURI && <div><b>Docs:</b> <a href={d.docsURI} target="_blank" rel="noreferrer">{d.docsURI}</a></div>}
          {d.vcHash && <div><b>VC hash:</b> {d.vcHash}</div>}
          {d.evidenceURI && <div><b>Evidence:</b> {d.evidenceURI}</div>}
        </div>
      </section>
    </main>
  );
}
