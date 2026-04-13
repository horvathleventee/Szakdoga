import { http, createPublicClient, parseAbiItem } from 'viem'
import { sepolia } from 'viem/chains'
import { cacRegistryAbi } from '../abi/CacRegistry'

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || process.env.RPC_URL
const REG = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS
const CAC = process.env.NEXT_PUBLIC_ALLOWANCE20_ADDRESS
const GATEWAY = process.env.PINATA_GATEWAY || process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs/'

const REGISTERED_EVENT = parseAbiItem(
  'event Registered(address indexed user, string displayName, bytes32 taxIdHash, string metadataURI)'
)
const SURRENDER_LOGGED_EVENT = parseAbiItem(
  'event SurrenderLogged(address indexed user, uint256 amount, uint16 periodId, uint256 timestamp, string displayName, bytes32 taxIdHash, string metadataURI, string docsURI)'
)

const client = createPublicClient({
  chain: sepolia,
  transport: http(RPC_URL),
})

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRateLimitError(error) {
  const text = String(error?.message || error?.details || error || '').toLowerCase()
  return text.includes('429') || text.includes('throughput') || text.includes('compute units per second')
}

async function withRetry(task, retries = 5, delayMs = 1000) {
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

export async function getLogsInChunksServer({ address, event, lookbackBlocks = 600n, chunkSize = 10n }) {
  const latestBlock = await withRetry(() => client.getBlockNumber())
  const fromBlock = latestBlock > lookbackBlocks ? latestBlock - lookbackBlocks : 0n

  const logs = []
  let start = fromBlock

  while (start <= latestBlock) {
    const end = start + chunkSize - 1n > latestBlock ? latestBlock : start + chunkSize - 1n
    const part = await withRetry(() =>
      client.getLogs({
        address,
        event,
        fromBlock: start,
        toBlock: end,
      })
    )
    logs.push(...part)
    await sleep(150)
    start = end + 1n
  }

  return logs
}

export async function getRegistrationRows() {
  const logs = await getLogsInChunksServer({ address: REG, event: REGISTERED_EVENT })
  const users = Array.from(new Set(logs.map((log) => log.args.user.toLowerCase())))

  const rows = []
  for (const user of users) {
    const res = await withRetry(() =>
      client.readContract({
        abi: cacRegistryAbi,
        address: REG,
        functionName: 'profiles',
        args: [user],
      })
    )
    const note = await withRetry(() =>
      client.readContract({
        abi: cacRegistryAbi,
        address: REG,
        functionName: 'kycNote',
        args: [user],
      })
    )

    const [displayName, taxIdHash, metadataURI, docsURI, kycApproved, exists] = res
    if (!exists) continue

    let metaParsed = null
    if (metadataURI) {
      try {
        const url = metadataURI.startsWith('ipfs://')
          ? GATEWAY.replace(/\/$/, '/') + metadataURI.slice('ipfs://'.length)
          : metadataURI
        const response = await fetch(url, { cache: 'no-store' })
        if (response.ok) metaParsed = await response.json().catch(() => null)
      } catch {
        // ignore
      }
    }

    rows.push({
      user,
      displayName,
      taxIdHash,
      metadataURI,
      docsURI,
      kycApproved,
      exists,
      metaParsed,
      kycNote: note || '',
    })
  }

  return rows
}

export async function getSurrenderRows() {
  const logs = await getLogsInChunksServer({ address: CAC, event: SURRENDER_LOGGED_EVENT })

  return logs
    .map((log, index) => ({
      key: `${log.blockHash}:${index}`,
      txHash: log.transactionHash,
      user: String(log.args.user),
      amount: String(log.args.amount),
      periodId: String(log.args.periodId),
      timestamp: Number(log.args.timestamp),
      displayName: log.args.displayName,
      metadataURI: log.args.metadataURI,
      docsURI: log.args.docsURI,
    }))
    .reverse()
}

export async function getOperatorAddress() {
  return withRetry(() =>
    client.readContract({
      abi: cacRegistryAbi,
      address: REG,
      functionName: 'operator',
    })
  )
}
