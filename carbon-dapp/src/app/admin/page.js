'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useWatchContractEvent,
} from 'wagmi';
import QRCode from 'react-qr-code';
import { parseAbiItem } from 'viem';
import { cacRegistryAbi } from '../../abi/CacRegistry';

const REG = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS;
const CAC = process.env.NEXT_PUBLIC_ALLOWANCE20_ADDRESS; // ⬅️ surrender eventek innen jönnek
const GATEWAY =
  (typeof process !== 'undefined' && (process.env.PINATA_GATEWAY || process.env.NEXT_PUBLIC_PINATA_GATEWAY)) ||
  'https://gateway.pinata.cloud/ipfs/';

const RegisteredEvt = parseAbiItem(
  'event Registered(address indexed user, string displayName, bytes32 taxIdHash, string metadataURI)'
);

// részletes könyvelési event (Allowance20-ból)
const SurrenderLoggedEvt = parseAbiItem(
  'event SurrenderLogged(address indexed user, uint256 amount, uint16 periodId, uint256 timestamp, string displayName, bytes32 taxIdHash, string metadataURI, string docsURI)'
);
// ha inkább a rövid eventet akarod figyelni, ezt használd helyette:
// const SurrenderedEvt = parseAbiItem(
//   'event Surrendered(address indexed factory, uint256 amount, uint16 periodId, string evidenceURI, bytes32 vcHash)'
// );

function resolveIpfs(uri) {
  if (!uri) return '';
  if (uri.startsWith('ipfs://')) return GATEWAY.replace(/\/$/, '/') + uri.slice('ipfs://'.length);
  return uri;
}

export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const client = usePublicClient();

  const { writeContract, isPending, error: txError, data: txHash } = useWriteContract();
  const { isSuccess: txMined } = useWaitForTransactionReceipt({ hash: txHash });

  const { data: operatorAddr } = useReadContract({
    abi: cacRegistryAbi,
    address: REG,
    functionName: 'operator',
  });

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [rows, setRows] = useState([]);

  // --- SURRENDERS (minden user) ---
  const [surrLogs, setSurrLogs] = useState([]);
  const [surrLoading, setSurrLoading] = useState(false);
  const [surrErr, setSurrErr] = useState('');

  const isOperator = useMemo(() => {
    if (!address || !operatorAddr) return false;
    return address.toLowerCase() === operatorAddr.toLowerCase();
  }, [address, operatorAddr]);

  const fetchMeta = useCallback(async (metadataURI) => {
    if (!metadataURI) return null;
    try {
      const url = resolveIpfs(metadataURI);
      const resp = await fetch(url);
      if (!resp.ok) return null;
      return await resp.json().catch(() => null);
    } catch {
      return null;
    }
  }, []);

  const load = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    setErr('');
    try {
      const logs = await client.getLogs({
        address: REG,
        event: RegisteredEvt,
        fromBlock: 0n,
        toBlock: 'latest',
      });

      const users = Array.from(new Set(logs.map((l) => l.args.user.toLowerCase())));
      if (!users.length) {
        setRows([]);
        setLoading(false);
        return;
      }

      const profiles = await Promise.all(
        users.map(async (u) => {
          try {
            const res = await client.readContract({
              abi: cacRegistryAbi,
              address: REG,
              functionName: 'profiles',
              args: [u],
            });
            const note = await client.readContract({
              abi: cacRegistryAbi,
              address: REG,
              functionName: 'kycNote',
              args: [u],
            });
            return { user: u, ok: true, res, note };
          } catch (e) {
            return { user: u, ok: false, err: e };
          }
        })
      );

      const enriched = await Promise.all(
        profiles.map(async (p) => {
          if (!p.ok || !p.res) return { user: p.user, exists: false };
          const [displayName, taxIdHash, metadataURI, docsURI, kycApproved, exists] = p.res;
          const metaParsed = await fetchMeta(metadataURI);
          return {
            user: p.user,
            displayName,
            taxIdHash,
            metadataURI,
            docsURI,
            kycApproved,
            exists,
            metaParsed,
            kycNote: p.note || '',
          };
        })
      );

      setRows(enriched.filter((r) => r.exists));
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [client, fetchMeta]);

  // --- Surrenderek betöltése (MINDENKIT listázunk) ---
  const loadSurrenders = useCallback(async () => {
    if (!client) return;
    setSurrLoading(true); setSurrErr('');
    try {
      const logs = await client.getLogs({
        address: CAC,
        event: SurrenderLoggedEvt,
        fromBlock: 0n,
        toBlock: 'latest',
      });

      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const rows = logs.map((l, i) => {
        const a = l.args;
        const txHash = l.transactionHash;
        const url = `/receipt/${txHash}`;
        const payload = origin ? `${origin}${url}` : url;
        return {
          key: l.blockHash + ':' + i,
          txHash,
          blockNumber: l.blockNumber?.toString() ?? '—',
          user: String(a.user),
          amount: String(a.amount),
          periodId: String(a.periodId),
          timestamp: Number(a.timestamp),
          displayName: a.displayName,
          metadataURI: a.metadataURI,
          docsURI: a.docsURI,
          url,
          payload,
        };
      }).reverse();

      setSurrLogs(rows);
    } catch (e) {
      setSurrErr(e?.message || String(e));
    } finally {
      setSurrLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (client && isOperator) {
      load();
      loadSurrenders();
    }
  }, [client, isOperator, load, loadSurrenders]);

  useEffect(() => { if (txMined) load(); }, [txMined, load]);

  useWatchContractEvent({
    abi: cacRegistryAbi,
    address: REG,
    eventName: 'KycApproved',
    onLogs: () => load(),
  });
  useWatchContractEvent({
    abi: cacRegistryAbi,
    address: REG,
    eventName: 'KycDecision',
    onLogs: () => load(),
  });

  // surrender történt → frissítjük a listát
  useWatchContractEvent({
    abi: [SurrenderLoggedEvt],
    address: CAC,
    eventName: 'SurrenderLogged',
    onLogs: () => loadSurrenders(),
  });

  function approve(user) {
    writeContract({
      abi: cacRegistryAbi,
      address: REG,
      functionName: 'approveKyc',
      args: [user, true],
    });
  }

  function rejectWithReason(user) {
    const reason = window.prompt('Adj meg rövid indokot az elutasításhoz:');
    if (!reason) return;
    writeContract({
      abi: cacRegistryAbi,
      address: REG,
      functionName: 'rejectKyc',
      args: [user, reason],
    });
  }

  if (!isConnected) return <div className="card">Please connect your wallet.</div>;
  if (!isOperator) {
    return (
      <div className="card">
        <h2>Admin</h2>
        <p className="subtle">
          Only the operator can open this page.
          <br />
          Current operator: <code>{operatorAddr || '…'}</code>
          <br />
          Your address: <code>{address}</code>
        </p>
      </div>
    );
  }

  return (
    <main className="page">
      <h1 className="page-title">Admin – KYC approvals</h1>

      {/* KYC szekció */}
      <section className="card col-12">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button className="btn" onClick={load} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          {txError && <span style={{ color: 'crimson' }}>{txError.message}</span>}
          {err && <span style={{ color: 'crimson' }}>{err}</span>}
        </div>

        {!rows.length ? (
          <div style={{ marginTop: 12 }}>No registrations found.</div>
        ) : (
          <div className="grid" style={{ marginTop: 12 }}>
            {rows.map((r) => {
              const meta = r.metaParsed || {};
              const email = meta?.contact?.email || '—';
              const city = meta?.address?.city || '—';
              const street = meta?.address?.street || '—';
              const metaUrl = resolveIpfs(r.metadataURI);
              const docsUrl = resolveIpfs(r.docsURI);

              return (
                <div key={r.user} className="card" style={{ padding: 12 }}>
                  <div><b>User:</b> {r.user}</div>
                  <div><b>Name:</b> {r.displayName}</div>
                  <div style={{ marginTop: 6 }}>
                    <b>Contact email:</b> {email}
                  </div>
                  <div>
                    <b>City:</b> {city} &nbsp; <b>Street:</b> {street}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <b>Metadata JSON:</b>{' '}
                    {r.metadataURI ? (
                      <a href={metaUrl} target="_blank" rel="noreferrer">{r.metadataURI}</a>
                    ) : '—'}
                  </div>
                  <div>
                    <b>Ownership deed (PDF/JPG):</b>{' '}
                    {r.docsURI ? (
                      <a className="btn" href={docsUrl} target="_blank" rel="noreferrer">Open deed</a>
                    ) : <span style={{ color: '#eab308' }}>missing</span>}
                  </div>

                  <div style={{ marginTop: 6 }}>
                    <b>KYC state:</b>{' '}
                    <span className={`badge ${r.kycApproved ? 'ok' : 'warn'}`}>
                      {r.kycApproved ? 'APPROVED' : 'PENDING/REJECTED'}
                    </span>
                  </div>
                  {!r.kycApproved && r.kycNote && (
                    <div style={{ marginTop: 4, color: '#b45309' }}>
                      <b>Reject note:</b> {r.kycNote}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    {!r.kycApproved && (
                      <button className="btn" disabled={isPending} onClick={() => approve(r.user)} title="Approve KYC">
                        Approve
                      </button>
                    )}
                    <button
                      className="btn"
                      disabled={isPending}
                      onClick={() => rejectWithReason(r.user)}
                      title={r.kycApproved ? 'Revoke with reason' : 'Reject with reason'}
                    >
                      {r.kycApproved ? 'Revoke' : 'Reject'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SURRENDERS szekció — mindenki listázva */}
      <section className="card col-12" style={{ marginTop: 16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h2 style={{ margin: 0 }}>Surrenders (all users)</h2>
          <button className="btn" onClick={loadSurrenders} disabled={surrLoading}>
            {surrLoading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {surrErr && <div style={{ color:'crimson', marginTop:10 }}>{surrErr}</div>}

        <div className="subtle" style={{ marginTop: 8 }}>
          Total events: {surrLogs.length}
        </div>

        {!surrLogs.length ? (
          <div style={{ marginTop: 12 }}>No surrender events.</div>
        ) : (
          <div className="grid" style={{ marginTop: 12, gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            {surrLogs.map((it) => (
              <div key={it.key} className="card" style={{ padding: 12, display:'flex', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{it.displayName || it.user}</div>
                  <div className="subtle" style={{ fontSize: 12, marginTop: 4, overflowWrap:'anywhere' }}>
                    {it.user}
                  </div>
                  <div className="subtle" style={{ marginTop: 6 }}>
                    <b>Amount:</b> {it.amount} CAC &nbsp;•&nbsp; <b>Year:</b> {it.periodId}
                  </div>
                  <div className="subtle" style={{ marginTop: 2 }}>
                    <b>When:</b> {new Date(it.timestamp * 1000).toISOString()}
                  </div>
                  <div className="subtle" style={{ marginTop: 2, overflowWrap:'anywhere' }}>
                    <b>Tx:</b> <a href={it.url}>{it.txHash}</a>
                  </div>
                  
                </div>

                <a href={it.url} title="Open receipt" style={{ display:'block', width: 110, height: 110 }}>
                  <QRCode value={it.payload} size={110} />
                </a>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
