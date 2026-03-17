import { NextResponse } from 'next/server'
import { getRegistrationRows } from '../../../../lib/serverChain'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const rows = await getRegistrationRows()
    return NextResponse.json({ rows })
  } catch (error) {
    return NextResponse.json({ error: error?.message || String(error) }, { status: 500 })
  }
}
