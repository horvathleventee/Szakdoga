'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAccount, useReadContract, useWriteContract, useWatchContractEvent } from 'wagmi'
import { keccak256, stringToHex } from 'viem'
import { cacRegistryAbi } from '../../abi/CacRegistry'
import { pinJsonToIPFS, pinFileToIPFS } from '../../lib/pinata'

const REG = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS
const GW = process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs/'

function ipfsToHttp(uri) {
  if (!uri) return ''
  if (uri.startsWith('ipfs://')) return GW.replace(/\/+$/, '/') + uri.replace('ipfs://', '')
  return uri
}

function shortAddr(a) {
  if (!a) return ''
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

export default function ProfilePage() {
  const { address, isConnected } = useAccount()

  const { data: isRegRaw, refetch: refetchIsReg } = useReadContract({
    abi: cacRegistryAbi,
    address: REG,
    functionName: 'isRegistered',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })
  const isReg = Boolean(isRegRaw)

  const { data: myProfile, refetch: refetchProfile } = useReadContract({
    abi: cacRegistryAbi,
    address: REG,
    functionName: 'profiles',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  const kyc = myProfile ? Boolean(myProfile[4]) : false
  const currentDocsURI = myProfile ? String(myProfile[3] || '') : ''

  const { data: kycNote, refetch: refetchNote } = useReadContract({
    abi: cacRegistryAbi,
    address: REG,
    functionName: 'kycNote',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  const { writeContract, isPending, error: txError, data: txHash } = useWriteContract()

  const [displayName, setDisplayName] = useState('Teszt Kft.')
  const [taxId, setTaxId] = useState('HU-12345678')
  const [contactEmail, setContactEmail] = useState('info@tesztkft.hu')
  const [addressCity, setAddressCity] = useState('Budapest')
  const [addressStreet, setAddressStreet] = useState('Fő u. 1.')

  const [ownershipFile, setOwnershipFile] = useState(null)
  const [uiWarn, setUiWarn] = useState('')
  const [uiInfo, setUiInfo] = useState('')

  const [docsIndex, setDocsIndex] = useState(null)
  const docsList = useMemo(() => (docsIndex?.docs && Array.isArray(docsIndex.docs) ? docsIndex.docs : []), [docsIndex])

  async function loadDocsIndexMaybe() {
    setDocsIndex(null)
    if (!currentDocsURI || !currentDocsURI.startsWith('ipfs://')) return

    try {
      const url = ipfsToHttp(currentDocsURI)
      const r = await fetch(url, { cache: 'no-store' })
      if (!r.ok) return
      const text = await r.text()

      let parsed = null
      try {
        parsed = JSON.parse(text)
      } catch {
        // régi: 1 db fájl volt docsURI
        parsed = {
          version: '1.0.0',
          owner: address,
          displayName,
          docs: [{ name: 'Tulajdoni lap (régi)', uri: currentDocsURI, addedAt: Math.floor(Date.now() / 1000) }],
        }
      }
      setDocsIndex(parsed)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!address) return
    loadDocsIndexMaybe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, currentDocsURI])

  async function buildMetadataURI() {
    const json = {
      version: '1.0.0',
      displayName,
      contact: { email: contactEmail },
      address: { city: addressCity, street: addressStreet },
    }
    try {
      const niceName = `CAC_${shortAddr(address)}_${displayName}_metadata`
      return await pinJsonToIPFS(json, {
        name: niceName,
        keyvalues: { app: 'CAC', owner: address, displayName, type: 'metadata' },
      })
    } catch {
      const raw = JSON.stringify(json)
      return `data:application/json;utf8,${encodeURIComponent(raw)}`
    }
  }

  async function uploadDocFile(file) {
    if (!file || !address) return ''
    const safeDisplay = String(displayName || 'Company').replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 32)
    const safeFile = String(file.name || 'doc').replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(0, 64)
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const pinName = `CAC_${address}_${safeDisplay}_DOC_${stamp}_${safeFile}`

    try {
      const uri = await pinFileToIPFS(file, {
        name: pinName,
        keyvalues: {
          app: 'CAC',
          owner: address,
          displayName: safeDisplay,
          type: 'ownership_deed',
          original: safeFile,
        },
      })
      return uri
    } catch {
      setUiWarn('Pinata upload nem sikerült (kulcs hiányzik/hibás?).')
      return ''
    }
  }

  async function appendDocToIndexAndSave(newDoc) {
    if (!address) return

    let idx = docsIndex
    if (!idx || !idx.docs || !Array.isArray(idx.docs)) {
      idx = { version: '1.0.0', owner: address, displayName, docs: [] }
    }

    const next = {
      ...idx,
      owner: address,
      displayName,
      docs: [...idx.docs, newDoc],
    }

    const safeDisplay = String(displayName || 'Company').replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 32)
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const name = `CAC_${address}_${safeDisplay}_DOC_INDEX_${stamp}`

    const indexUri = await pinJsonToIPFS(next, {
      name,
      keyvalues: { app: 'CAC', owner: address, displayName: safeDisplay, type: 'docs_index' },
    })

    await writeContract({
      abi: cacRegistryAbi,
      address: REG,
      functionName: 'updateDocs',
      args: [indexUri],
    })

    setDocsIndex(next)
    setUiInfo('Dokumentum hozzáadva (index frissítve).')
    refetchProfile()
    refetchIsReg()
  }

  async function doRegister() {
    if (!address) return
    if (isReg) return // extra védelem
    setUiInfo('')
    setUiWarn('')

    const taxIdHash = keccak256(stringToHex(taxId))
    const metadataURI = await buildMetadataURI()

    await writeContract({
      abi: cacRegistryAbi,
      address: REG,
      functionName: 'register',
      args: [taxIdHash, metadataURI, displayName],
    })

    // opcionális: ha már regisztrációkor volt kiválasztott fájl, hozzáadjuk
    if (ownershipFile) {
      const fileUri = await uploadDocFile(ownershipFile)
      if (fileUri) {
        await appendDocToIndexAndSave({
          name: ownershipFile.name || 'Tulajdoni lap',
          uri: fileUri,
          addedAt: Math.floor(Date.now() / 1000),
        })
      }
    }

    refetchProfile()
    refetchNote()
    refetchIsReg()
  }

  async function doUpdateMetaOnly() {
    if (!isReg) return
    setUiInfo('')
    setUiWarn('')
    const metadataURI = await buildMetadataURI()
    await writeContract({
      abi: cacRegistryAbi,
      address: REG,
      functionName: 'updateMetadata',
      args: [metadataURI],
    })
    setUiInfo('Metadata frissítve.')
    refetchProfile()
  }

  async function doAddDoc() {
    if (!isReg) return
    setUiInfo('')
    setUiWarn('')

    if (!ownershipFile) {
      setUiWarn('Válassz ki egy fájlt (PDF/JPG), majd Add document.')
      return
    }

    const fileUri = await uploadDocFile(ownershipFile)
    if (!fileUri) return

    await appendDocToIndexAndSave({
      name: ownershipFile.name || 'Tulajdoni lap',
      uri: fileUri,
      addedAt: Math.floor(Date.now() / 1000),
    })
  }

  // eseményeknél frissítés
  useWatchContractEvent({
    abi: cacRegistryAbi,
    address: REG,
    eventName: 'KycApproved',
    onLogs: () => {
      refetchProfile()
      refetchNote()
      refetchIsReg()
    },
  })
  useWatchContractEvent({
    abi: cacRegistryAbi,
    address: REG,
    eventName: 'KycDecision',
    onLogs: () => {
      refetchProfile()
      refetchNote()
      refetchIsReg()
    },
  })
  useWatchContractEvent({
    abi: cacRegistryAbi,
    address: REG,
    eventName: 'DocsUpdated',
    onLogs: () => {
      refetchProfile()
    },
  })

  // TX után is frissítsünk, hogy a gombok biztosan állapotot váltsanak
  useEffect(() => {
    if (!txHash) return
    refetchProfile()
    refetchNote()
    refetchIsReg()
  }, [txHash, refetchProfile, refetchNote, refetchIsReg])

  if (!isConnected) return <div className="card">Please connect your wallet.</div>

  return (
    <main className="page" style={{ display: 'grid', gap: 16 }}>
      <h1 className="page-title">Company profile</h1>

      {/* 1) PROFIL */}
      <section className="card col-12">
        <div className="grid grid-2">
          <label>
            Display name
            <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </label>
          <label>
            Tax ID
            <input className="input" value={taxId} onChange={(e) => setTaxId(e.target.value)} />
          </label>
          <label>
            Contact email
            <input className="input" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          </label>
          <label>
            City
            <input className="input" value={addressCity} onChange={(e) => setAddressCity(e.target.value)} />
          </label>
          <label>
            Street
            <input className="input" value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} />
          </label>
          <label>
            Ownership deed (PDF/JPG)
            <input
              className="input"
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => setOwnershipFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        {(uiWarn || uiInfo) && (
          <div style={{ marginTop: 10 }}>
            {uiInfo && <div style={{ color: '#16a34a' }}>{uiInfo}</div>}
            {uiWarn && <div style={{ color: '#eab308' }}>{uiWarn}</div>}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            gap: 10,
            marginTop: 14,
            alignItems: 'center',
            flexWrap: 'wrap',
            rowGap: 10,
          }}
        >
          {/* Register: ha már regisztrált, disabled */}
          <button className={`btn ${!isReg ? 'primary' : ''}`} onClick={doRegister} disabled={isPending || isReg}>
            {isPending ? 'Submitting…' : isReg ? 'Already registered' : 'Register'}
          </button>

          {/* Update/Add: csak regisztráltan */}
          <button className="btn" onClick={doUpdateMetaOnly} disabled={isPending || !isReg}>
            Update metadata
          </button>
          <button className="btn primary" onClick={doAddDoc} disabled={isPending || !isReg}>
            Add document (append)
          </button>

          <span className="subtle">
            KYC:{' '}
            <span className={`badge ${kyc ? 'ok' : 'warn'}`}>{kyc ? 'APPROVED' : 'PENDING/REJECTED'}</span>
          </span>
        </div>

        {!kyc && kycNote && kycNote.length > 0 && (
          <div style={{ marginTop: 10, color: '#b45309' }}>
            <b>Elutasítás indoka:</b> {kycNote}
          </div>
        )}

        {txError && <div style={{ color: 'crimson', marginTop: 10 }}>{txError.message}</div>}
      </section>

      {/* 2) DOCS */}
      <section className="card col-12">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0 }}>Uploaded ownership documents</h3>
          {currentDocsURI ? (
            <div className="subtle" style={{ fontSize: 12 }}>
              docsURI: <code>{currentDocsURI}</code>
            </div>
          ) : (
            <div className="subtle" style={{ fontSize: 12 }}>docsURI: —</div>
          )}
        </div>

        {!docsList.length ? (
          <div style={{ marginTop: 12 }}>Nincs feltöltött dokumentum-lista (vagy még nem index JSON).</div>
        ) : (
          <div className="grid grid-2" style={{ marginTop: 12 }}>
            {docsList.map((d, i) => (
              <div key={i} className="card" style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <b style={{ wordBreak: 'break-word' }}>{d.name || `Document #${i + 1}`}</b>
                  <span className="subtle" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>#{i + 1}</span>
                </div>

                <div className="subtle" style={{ fontSize: 12, marginTop: 6 }}>
                  Added: {d.addedAt ? new Date(Number(d.addedAt) * 1000).toLocaleString() : '—'}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <a className="btn primary" href={ipfsToHttp(d.uri)} target="_blank" rel="noreferrer">
                    Open
                  </a>
                  <button
                    className="btn"
                    onClick={() => {
                      navigator.clipboard?.writeText(String(d.uri || ''))
                      setUiInfo('IPFS URI másolva a vágólapra.')
                      setTimeout(() => setUiInfo(''), 2500)
                    }}
                  >
                    Copy URI
                  </button>
                </div>

                <div className="subtle" style={{ fontSize: 12, marginTop: 8, wordBreak: 'break-all' }}>
                  <code>{d.uri}</code>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="subtle" style={{ marginTop: 12 }}>
          A <code>docsURI</code> most egy <b>IPFS JSON index</b>, ami több dokumentumot listáz. Feltöltéskor a listát bővítjük.
        </p>
      </section>
    </main>
  )
}
