import { NextResponse } from 'next/server'
import { getSurrenderRows } from '../../../../lib/serverChain'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const rows = await getSurrenderRows()
    return NextResponse.json({ rows })
  } catch (error) {
    return NextResponse.json({ error: error?.message || String(error) }, { status: 500 })
  }
}
