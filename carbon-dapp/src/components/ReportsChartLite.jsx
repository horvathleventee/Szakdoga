'use client'

import { useEffect, useState, useMemo } from 'react'
import { usePublicClient } from 'wagmi'
import { parseAbiItem } from 'viem'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

// Ennek BITRE pontosan egyeznie kell a CacMarketplace.sol-ban lévő eventtel
const PURCHASED_EVENT = parseAbiItem(
  'event Purchased(uint256 indexed listingId, address indexed buyer, uint256 amount, uint256 priceWei, address indexed seller)'
)

export default function ReportsChartLite({ marketAddress }) {
  const client = usePublicClient()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    if (!client || !marketAddress) return
    try {
      setLoading(true)
      setError('')

      // 1) összes Purchased log a piactérről
      const logs = await client.getLogs({
        address: marketAddress,
        event: PURCHASED_EVENT,
        fromBlock: 0n,
        toBlock: 'latest',
      })

      if (!logs.length) {
        setRows([])
        return
      }

      // 2) minden loghoz lekérjük a block timestampet
      const trades = await Promise.all(
        logs.map(async (l) => {
          try {
            const block = await client.getBlock({ blockHash: l.blockHash })
            const tsMs = Number(block.timestamp) * 1000

            const amount = l.args.amount
            const priceWei = l.args.priceWei
            if (!amount || !priceWei || amount === 0n) return null

            // unit price (ETH/CAC)
            const unitEth =
              Number(priceWei) / Number(amount) / 1e18

            // napi bucket kulcs (UTC 00:00)
            const d = new Date(tsMs)
            d.setUTCHours(0, 0, 0, 0)
            const dayKey = d.getTime()

            return { dayKey, unitEth }
          } catch {
            return null
          }
        })
      )

      // 3) aggregálás napokra (átlagár)
      const byDay = new Map()
      for (const t of trades) {
        if (!t) continue
        const arr = byDay.get(t.dayKey) || []
        arr.push(t.unitEth)
        byDay.set(t.dayKey, arr)
      }

      const data = Array.from(byDay.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([dayKey, arr]) => {
          const avg =
            arr.reduce((sum, v) => sum + v, 0) / arr.length
          const dateLabel = new Date(dayKey)
            .toISOString()
            .slice(5, 10) // 'MM-DD'
          return { date: dateLabel, avg }
        })

      setRows(data)
    } catch (e) {
      console.error(e)
      setError(e.shortMessage || e.message || String(e))
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  // első betöltés
  useEffect(() => {
    load()
  }, [client, marketAddress])

  const hasData = rows.length > 0

  return (
    <div
      className="card"
      style={{
        height: 260,                // FIX magasság
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 4,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16 }}>
          Average unit price by day
        </h3>
        <button
          className="btn"
          onClick={load}
          disabled={loading}
          style={{ padding: '4px 14px' }}
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div
          style={{
            color: 'crimson',
            fontSize: 12,
            marginTop: 4,
          }}
        >
          {error}
        </div>
      )}

      {!error && !hasData && !loading && (
        <div
          style={{
            fontSize: 12,
            color: '#9ca3af',
            marginTop: 4,
          }}
        >
          No trades yet. Make a purchase to see price history.
        </div>
      )}

      {/* Chart area */}
      <div style={{ flex: 1, marginTop: 4 }}>
        {hasData && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#9ca3af' }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                width={40}
                allowDecimals
              />
              <Tooltip
                contentStyle={{
                  background: '#111827',
                  border: '1px solid #374151',
                  fontSize: 11,
                }}
                formatter={(v) => [`${v.toFixed(4)} ETH/CAC`, 'Avg']}
              />
              <Line
                type="monotone"
                dataKey="avg"
                dot={false}
                strokeWidth={2}
                // szín alapértelmezett / böngésző, nem kell állítanod
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
