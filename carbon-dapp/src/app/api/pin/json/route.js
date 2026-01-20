import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const { data, name, keyvalues } = await req.json()

    const jwt = process.env.PINATA_JWT
    if (!jwt) return new NextResponse('Missing PINATA_JWT', { status: 500 })

    const payload = {
      pinataContent: data,
      ...(name || keyvalues ? { pinataMetadata: { name: name || undefined, keyvalues: keyvalues || undefined } } : {}),
    }

    const r = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: jwt, // nálad "Bearer ...."
      },
      body: JSON.stringify(payload),
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
