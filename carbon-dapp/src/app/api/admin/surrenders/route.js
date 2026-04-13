import { NextResponse } from 'next/server'
import { getOperatorAddress, getSurrenderRows } from '../../../../lib/serverChain'
import { verifyWalletAuthRequest } from '../../../../lib/walletAuth'

export const runtime = 'nodejs'

export async function GET(req) {
  try {
    const address = await verifyWalletAuthRequest(req, 'admin-read')
    const operator = await getOperatorAddress()
    if (address.toLowerCase() !== String(operator).toLowerCase()) {
      return NextResponse.json({ error: 'Admin access denied.' }, { status: 403 })
    }
    const rows = await getSurrenderRows()
    return NextResponse.json({ rows })
  } catch (error) {
    const message = error?.message || String(error)
    const status = message.toLowerCase().includes('wallet authentication') || message.toLowerCase().includes('signature')
      ? 401
      : 500
    return NextResponse.json({ error: message }, { status })
  }
}
