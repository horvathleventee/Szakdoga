'use client'
import { useEffect, useMemo, useState } from 'react'
import { usePublicClient } from 'wagmi'
import { formatEther } from 'viem'
import { cacMarketAbi } from '../abi/CacMarketplace'

// yyyy-mm-dd kulcs
const dayKey = (tsSec) => new Date(Number(tsSec) * 1000).toISOString().slice(0, 10)

/**
 * Purchased események beolvasása és napi átlag egységár számítása.
 * Egységár = listing.priceWei / listing.amount a vásárlás blokkjában.
 */
export function useMarketSales({ marketAddress, lookbackBlocks = 50000n }) {
  const client = usePublicClient()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!client || !marketAddress) return
      setLoading(true)
      try {
        const latest = await client.getBlockNumber()
        const fromBlock = latest > lookbackBlocks ? latest - lookbackBlocks : 0n
        const toBlock = latest

        // Purchased event logok
        const logs = await client.getLogs({
          address: marketAddress,
          abi: cacMarketAbi,
          eventName: 'Purchased',
          fromBlock,
          toBlock,
        })

        const enriched = await Promise.all(
          logs.map(async (l) => {
            // blokk timestamp
            const blk = await client.getBlock({ blockNumber: l.blockNumber })
            // listing állapot a vásárlás blokkjában
            const listing = await client.readContract({
              address: marketAddress,
              abi: cacMarketAbi,
              functionName: 'listings',
              args: [l.args.id],
              blockNumber: l.blockNumber,
            })
            const [, amount, priceWei] = listing // [seller, amount, priceWei, active]
            const unitEth = Number(formatEther(priceWei)) / Number(amount || 1n)
            return { day: dayKey(blk.timestamp), unitEth }
          })
        )

        if (!cancelled) setRows(enriched)
      } catch (e) {
        if (!cancelled) setRows([])
        // opcionálisan: console.warn(e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [client, marketAddress, lookbackBlocks])

  // napi átlag
  const byDay = useMemo(() => {
    const map = new Map()
    for (const r of rows) {
      const arr = map.get(r.day) ?? []
      arr.push(r.unitEth)
      map.set(r.day, arr)
    }
    return Array.from(map.entries()).map(([day, arr]) => ({
      day,
      avgEth: arr.reduce((a, b) => a + b, 0) / arr.length,
    })).sort((a, b) => a.day.localeCompare(b.day))
  }, [rows])

  return { byDay, loading }
}
