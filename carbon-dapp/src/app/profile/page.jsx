'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAccount, useReadContract, useSignMessage, useWriteContract, useWatchContractEvent } from 'wagmi'
import { keccak256, stringToHex } from 'viem'
import { cacRegistryAbi } from '../../abi/CacRegistry'
import { pinJsonToIPFS, pinFileToIPFS } from '../../lib/pinata'
import { createWalletAuthHeaders } from '../../lib/walletAuth'

const REG = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS
const GW = process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs/'

function ipfsToHttp(uri) {
  if (!uri) return ''
  if (uri.startsWith('ipfs://')) return GW.replace(/\/+$/, '/') + uri.replace('ipfs://', '')
  return uri
}

function shortAddr(a) {
  if (!a) return ''
  return `${a.slice(0, 6)}...${a.slice(-4)}`
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
  const { signMessageAsync } = useSignMessage()

  const [displayName, setDisplayName] = useState('Teszt Kft.')
  const [taxId, setTaxId] = useState('HU-12345678')
  const [contactEmail, setContactEmail] = useState('info@tesztkft.hu')
  const [addressCity, setAddressCity] = useState('Budapest')
  const [addressStreet, setAddressStreet] = useState('Fo u. 1.')

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
      const response = await fetch(url, { cache: 'no-store' })
      if (!response.ok) return
      const text = await response.text()

      let parsed = null
      try {
        parsed = JSON.parse(text)
      } catch {
        parsed = {
          version: '1.0.0',
          owner: address,
          displayName,
          docs: [{ name: 'Ownership deed (legacy)', uri: currentDocsURI, addedAt: Math.floor(Date.now() / 1000) }],
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

  async function buildMetadataURI(authHeaders) {
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
        authHeaders,
      })
    } catch (error) {
      setUiWarn(`Pinata metadata upload failed, using inline fallback: ${error?.message || 'unknown error'}`)
      const raw = JSON.stringify(json)
      return `data:application/json;utf8,${encodeURIComponent(raw)}`
    }
  }

  async function uploadDocFile(file, authHeaders) {
    if (!file || !address) return ''

    const safeDisplay = String(displayName || 'Company').replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 32)
    const safeFile = String(file.name || 'doc').replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(0, 64)
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const pinName = `CAC_${address}_${safeDisplay}_DOC_${stamp}_${safeFile}`

    try {
      return await pinFileToIPFS(file, {
        name: pinName,
        keyvalues: {
          app: 'CAC',
          owner: address,
          displayName: safeDisplay,
          type: 'ownership_deed',
          original: safeFile,
        },
        authHeaders,
      })
    } catch (error) {
      setUiWarn(`Pinata upload failed: ${error?.message || 'missing or invalid server PINATA_JWT'}`)
      return ''
    }
  }

  async function appendDocToIndexAndSave(newDoc, authHeaders) {
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
      authHeaders,
    })

    await writeContract({
      abi: cacRegistryAbi,
      address: REG,
      functionName: 'updateDocs',
      args: [indexUri],
    })

    setDocsIndex(next)
    setUiInfo('Document added and docs index updated.')
    refetchProfile()
    refetchIsReg()
  }

  async function doRegister() {
    if (!address || isReg) return
    setUiInfo('')
    setUiWarn('')

    const taxIdHash = keccak256(stringToHex(taxId))
    const authHeaders = await createWalletAuthHeaders({
      address,
      purpose: 'pinata-upload',
      signMessageAsync,
    })
    const metadataURI = await buildMetadataURI(authHeaders)

    await writeContract({
      abi: cacRegistryAbi,
      address: REG,
      functionName: 'register',
      args: [taxIdHash, metadataURI, displayName],
    })

    if (ownershipFile) {
      const fileUri = await uploadDocFile(ownershipFile, authHeaders)
      if (fileUri) {
        await appendDocToIndexAndSave({
          name: ownershipFile.name || 'Ownership deed',
          uri: fileUri,
          addedAt: Math.floor(Date.now() / 1000),
        }, authHeaders)
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
    const authHeaders = await createWalletAuthHeaders({
      address,
      purpose: 'pinata-upload',
      signMessageAsync,
    })
    const metadataURI = await buildMetadataURI(authHeaders)
    await writeContract({
      abi: cacRegistryAbi,
      address: REG,
      functionName: 'updateMetadata',
      args: [metadataURI],
    })
    setUiInfo('Metadata updated.')
    refetchProfile()
  }

  async function doAddDoc() {
    if (!isReg) return
    setUiInfo('')
    setUiWarn('')

    if (!ownershipFile) {
      setUiWarn('Select a PDF or image first, then click Add document.')
      return
    }

    const authHeaders = await createWalletAuthHeaders({
      address,
      purpose: 'pinata-upload',
      signMessageAsync,
    })
    const fileUri = await uploadDocFile(ownershipFile, authHeaders)
    if (!fileUri) return

    await appendDocToIndexAndSave({
      name: ownershipFile.name || 'Ownership deed',
      uri: fileUri,
      addedAt: Math.floor(Date.now() / 1000),
    }, authHeaders)
  }

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

        <div style={{ display: 'flex', gap: 10, marginTop: 14, alignItems: 'center', flexWrap: 'wrap', rowGap: 10 }}>
          <button className={`btn ${!isReg ? 'primary' : ''}`} onClick={doRegister} disabled={isPending || isReg}>
            {isPending ? 'Submitting...' : isReg ? 'Already registered' : 'Register'}
          </button>

          <button className="btn" onClick={doUpdateMetaOnly} disabled={isPending || !isReg}>
            Update metadata
          </button>
          <button className="btn primary" onClick={doAddDoc} disabled={isPending || !isReg}>
            Add document
          </button>

          <span className="subtle">
            KYC: <span className={`badge ${kyc ? 'ok' : 'warn'}`}>{kyc ? 'APPROVED' : 'PENDING/REJECTED'}</span>
          </span>
        </div>

        {!kyc && kycNote && kycNote.length > 0 && (
          <div style={{ marginTop: 10, color: '#b45309' }}>
            <b>Rejection reason:</b> {kycNote}
          </div>
        )}

        {txError && <div style={{ color: 'crimson', marginTop: 10 }}>{txError.message}</div>}
      </section>

      <section className="card col-12">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0 }}>Uploaded ownership documents</h3>
          {currentDocsURI ? (
            <div className="subtle" style={{ fontSize: 12 }}>
              docsURI: <code>{currentDocsURI}</code>
            </div>
          ) : (
            <div className="subtle" style={{ fontSize: 12 }}>docsURI: -</div>
          )}
        </div>

        {!docsList.length ? (
          <div style={{ marginTop: 12 }}>No uploaded document list yet.</div>
        ) : (
          <div className="grid grid-2" style={{ marginTop: 12 }}>
            {docsList.map((doc, index) => (
              <div key={index} className="card" style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <b style={{ wordBreak: 'break-word' }}>{doc.name || `Document #${index + 1}`}</b>
                  <span className="subtle" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>#{index + 1}</span>
                </div>

                <div className="subtle" style={{ fontSize: 12, marginTop: 6 }}>
                  Added: {doc.addedAt ? new Date(Number(doc.addedAt) * 1000).toLocaleString() : '-'}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <a className="btn primary" href={ipfsToHttp(doc.uri)} target="_blank" rel="noreferrer">
                    Open
                  </a>
                  <button
                    className="btn"
                    onClick={() => {
                      navigator.clipboard?.writeText(String(doc.uri || ''))
                      setUiInfo('IPFS URI copied to clipboard.')
                      setTimeout(() => setUiInfo(''), 2500)
                    }}
                  >
                    Copy URI
                  </button>
                </div>

                <div className="subtle" style={{ fontSize: 12, marginTop: 8, wordBreak: 'break-all' }}>
                  <code>{doc.uri}</code>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="subtle" style={{ marginTop: 12 }}>
          The <code>docsURI</code> now points to an IPFS JSON index that can contain multiple uploaded documents.
        </p>
      </section>
    </main>
  )
}
