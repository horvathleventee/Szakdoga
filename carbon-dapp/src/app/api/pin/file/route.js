import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const jwt = process.env.PINATA_JWT
    if (!jwt) return new NextResponse('Missing PINATA_JWT', { status: 500 })

    const incoming = await req.formData()
    const file = incoming.get('file')
    const name = incoming.get('name') || ''
    const keyvaluesRaw = incoming.get('keyvalues') || '{}'

    if (!file) return new NextResponse('Missing file', { status: 400 })

    let keyvalues = {}
    try { keyvalues = JSON.parse(String(keyvaluesRaw)) } catch {}

    const fd = new FormData()
    fd.append('file', file)

    const meta = {
      ...(name ? { name } : {}),
      ...(keyvalues && Object.keys(keyvalues).length ? { keyvalues } : {}),
    }
    if (Object.keys(meta).length) {
      fd.append('pinataMetadata', JSON.stringify(meta))
    }

    // opcionális: pinning options
    // fd.append('pinataOptions', JSON.stringify({ cidVersion: 1 }))

    const r = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: { Authorization: jwt },
      body: fd,
    })

    if (!r.ok) {
      const t = await r.text()
      return new NextResponse(t, { status: 500 })
    }

    const j = await r.json()
    const cid = j.IpfsHash
    return NextResponse.json({ uri: `ipfs://${cid}` })
  } catch (e) {
    return new NextResponse(e?.message || String(e), { status: 500 })
  }
}
