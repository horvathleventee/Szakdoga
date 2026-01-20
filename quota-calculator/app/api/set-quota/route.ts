import { NextResponse } from 'next/server'
import { ethers, isAddress, getAddress } from 'ethers'
import { allowance20Abi } from 'lib/abi'

export const runtime = 'nodejs'

const RPC_URL = process.env.RPC_URL ?? ''
const CAC_ADDRESS = (process.env.CAC_ADDRESS ?? '') as `0x${string}`
const FACTOR = Number(process.env.FACTOR_PER_M2 ?? '0.05')
const SERVER_PK = process.env.SERVER_PK ?? '' // <- EZT kell az .env-be

export async function POST(req: Request) {
  try {
    if (!RPC_URL || !CAC_ADDRESS) {
      return NextResponse.json(
        { error: 'Szerver hibás konfiguráció (RPC_URL / CAC_ADDRESS hiányzik).' },
        { status: 500 }
      )
    }
    if (!SERVER_PK || !SERVER_PK.startsWith('0x')) {
      return NextResponse.json(
        { error: 'SERVER_PK (privát kulcs) hiányzik vagy hibás a .env-ben.' },
        { status: 500 }
      )
    }

    const { user, areaM2 } = (await req.json()) as { user?: string; areaM2?: number }

    if (!user || !isAddress(user)) {
      return NextResponse.json({ error: 'user és areaM2 kell; user legyen érvényes cím' }, { status: 400 })
    }
    if (!areaM2 || areaM2 <= 0) {
      return NextResponse.json({ error: 'areaM2 > 0 kell' }, { status: 400 })
    }

    const toMint = Math.floor(areaM2 * FACTOR) // egész CAC
    if (toMint <= 0) {
      return NextResponse.json({ error: 'kerekítés után 0 lett a kvóta' }, { status: 400 })
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const wallet = new ethers.Wallet(SERVER_PK, provider)
    const cac = new ethers.Contract(CAC_ADDRESS, allowance20Abi, wallet)

    // <- FIGYELEM: setMintQuota a függvény neve
    const tx = await cac.setMintQuota(getAddress(user), BigInt(toMint))
    const rc = await tx.wait()

    return NextResponse.json({ ok: true, toMint, txHash: rc?.hash ?? tx.hash })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
