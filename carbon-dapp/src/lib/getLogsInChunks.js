const DEFAULT_CHUNK_SIZE = 10n
const DEFAULT_LOOKBACK_BLOCKS = 2000n

export async function getLogsInChunks(
  client,
  { address, event, fromBlock, toBlock, chunkSize = DEFAULT_CHUNK_SIZE, lookbackBlocks = DEFAULT_LOOKBACK_BLOCKS }
) {
  if (!client) return []

  const latestBlock = await client.getBlockNumber()
  const resolvedTo = toBlock === 'latest' || toBlock == null ? latestBlock : BigInt(toBlock)
  const resolvedFrom =
    fromBlock == null
      ? resolvedTo > lookbackBlocks
        ? resolvedTo - lookbackBlocks
        : 0n
      : BigInt(fromBlock)

  const logs = []
  let start = resolvedFrom

  while (start <= resolvedTo) {
    const end = start + chunkSize - 1n > resolvedTo ? resolvedTo : start + chunkSize - 1n
    const part = await client.getLogs({
      address,
      event,
      fromBlock: start,
      toBlock: end,
    })
    logs.push(...part)
    start = end + 1n
  }

  return logs
}
