const DEFAULT_CHUNK_SIZE = 10n
const DEFAULT_LOOKBACK_BLOCKS = 600n
const DEFAULT_RETRIES = 4
const DEFAULT_RETRY_DELAY_MS = 900

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRateLimitError(error) {
  const text = String(error?.message || error?.details || error || '').toLowerCase()
  return text.includes('429') || text.includes('throughput') || text.includes('compute units per second')
}

async function withRetry(task, retries = DEFAULT_RETRIES, delayMs = DEFAULT_RETRY_DELAY_MS) {
  let lastError

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await task()
    } catch (error) {
      lastError = error
      if (!isRateLimitError(error) || attempt === retries) break
      await sleep(delayMs * (attempt + 1))
    }
  }

  throw lastError
}

export async function getLogsInChunks(
  client,
  { address, event, fromBlock, toBlock, chunkSize = DEFAULT_CHUNK_SIZE, lookbackBlocks = DEFAULT_LOOKBACK_BLOCKS }
) {
  if (!client) return []

  const latestBlock = await withRetry(() => client.getBlockNumber())
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
    const part = await withRetry(() =>
      client.getLogs({
        address,
        event,
        fromBlock: start,
        toBlock: end,
      })
    )
    logs.push(...part)
    await sleep(120)
    start = end + 1n
  }

  return logs
}
