import { NextResponse } from 'next/server'
import { ethers, isAddress, getAddress } from 'ethers'
import { allowance20Abi } from 'lib/abi'

export const runtime = 'nodejs'

const RPC_URL = process.env.RPC_URL ?? ''
const CAC_ADDRESS = (process.env.CAC_ADDRESS ?? '') as `0x${string}`
const FACTOR = Number(process.env.FACTOR_PER_M2 ?? '0.05')

export async function GET(req: Request) {
  try {
    if (!RPC_URL || !CAC_ADDRESS) {
      return NextResponse.json(
        { error: 'Szerver hibás konfiguráció (RPC_URL / CAC_ADDRESS hiányzik).' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(req.url)
    const meta = searchParams.get('meta')
    const user = searchParams.get('user')

    if (meta === 'factor') {
      return NextResponse.json({ factor: FACTOR })
    }

    if (!user || !isAddress(user)) {
      return NextResponse.json({ error: 'user param kell (érvényes EVM cím)' }, { status: 400 })
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const c = new ethers.Contract(CAC_ADDRESS, allowance20Abi, provider)

    // <- FIGYELEM: remainingQuota a mapping neve
    const remaining: bigint = await c.remainingQuota(getAddress(user))

    return NextResponse.json({ remaining: Number(remaining) })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
