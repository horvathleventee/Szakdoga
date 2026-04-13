import { NextResponse } from 'next/server'
import { verifyWalletAuthRequest } from '../../../../lib/walletAuth'

export async function POST(req) {
  try {
    await verifyWalletAuthRequest(req, 'pinata-upload')

    const { data, name, keyvalues } = await req.json()

    const rawJwt = String(process.env.PINATA_JWT || '').trim()
    if (!rawJwt) return new NextResponse('Missing PINATA_JWT', { status: 500 })
    const jwt = rawJwt.toLowerCase().startsWith('bearer ') ? rawJwt : `Bearer ${rawJwt}`

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
      return new NextResponse(`Pinata JSON upload failed: ${t}`, { status: 500 })
    }

    const j = await r.json()
    const cid = j.IpfsHash
    return NextResponse.json({ uri: `ipfs://${cid}` })
  } catch (e) {
    const message = e?.message || String(e)
    const status = message.toLowerCase().includes('wallet authentication') || message.toLowerCase().includes('signature')
      ? 401
      : 500
    return new NextResponse(message, { status })
  }
}
