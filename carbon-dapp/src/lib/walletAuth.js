import { recoverMessageAddress } from 'viem'

const AUTH_WINDOW_MS = 5 * 60 * 1000
const CACHE_PREFIX = 'cac.walletAuth'

export function buildWalletAuthMessage({ address, purpose, timestamp }) {
  return [
    'CAC Wallet Authentication',
    `Purpose: ${purpose}`,
    `Address: ${address.toLowerCase()}`,
    `Timestamp: ${timestamp}`,
  ].join('\n')
}

export async function createWalletAuthHeaders({ address, purpose, signMessageAsync }) {
  if (!address) throw new Error('Wallet is not connected.')
  if (!signMessageAsync) throw new Error('Wallet signing is unavailable.')

  const timestamp = Date.now().toString()
  const message = buildWalletAuthMessage({ address, purpose, timestamp })
  const signature = await signMessageAsync({ message })

  return {
    'x-wallet-address': address,
    'x-wallet-purpose': purpose,
    'x-wallet-timestamp': timestamp,
    'x-wallet-signature': signature,
  }
}

function getCacheKey(address, purpose) {
  return `${CACHE_PREFIX}:${purpose}:${String(address).toLowerCase()}`
}

function canUseCachedAuth(cached, address, purpose) {
  if (!cached) return false
  if (String(cached.address || '').toLowerCase() !== String(address || '').toLowerCase()) return false
  if (cached.purpose !== purpose) return false
  const ts = Number(cached.timestamp)
  if (!Number.isFinite(ts)) return false
  return Math.abs(Date.now() - ts) <= AUTH_WINDOW_MS
}

export async function getWalletAuthHeaders({ address, purpose, signMessageAsync, forceRefresh = false }) {
  const cacheKey = getCacheKey(address, purpose)

  if (!forceRefresh && typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const raw = window.sessionStorage.getItem(cacheKey)
      if (raw) {
        const cached = JSON.parse(raw)
        if (canUseCachedAuth(cached, address, purpose)) {
          return {
            'x-wallet-address': cached.address,
            'x-wallet-purpose': cached.purpose,
            'x-wallet-timestamp': cached.timestamp,
            'x-wallet-signature': cached.signature,
          }
        }
      }
    } catch {
      // ignore bad cache
    }
  }

  const headers = await createWalletAuthHeaders({ address, purpose, signMessageAsync })

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.setItem(
        cacheKey,
        JSON.stringify({
          address,
          purpose,
          timestamp: headers['x-wallet-timestamp'],
          signature: headers['x-wallet-signature'],
        })
      )
    } catch {
      // ignore cache write failures
    }
  }

  return headers
}

export function clearWalletAuthCache(address, purpose) {
  if (typeof window === 'undefined' || !window.sessionStorage || !address) return

  if (purpose) {
    window.sessionStorage.removeItem(getCacheKey(address, purpose))
    return
  }

  const prefix = `${CACHE_PREFIX}:`
  const normalized = String(address).toLowerCase()
  const keysToDelete = []
  for (let i = 0; i < window.sessionStorage.length; i += 1) {
    const key = window.sessionStorage.key(i)
    if (!key || !key.startsWith(prefix)) continue
    if (key.endsWith(`:${normalized}`)) keysToDelete.push(key)
  }
  for (const key of keysToDelete) {
    window.sessionStorage.removeItem(key)
  }
}

export async function verifyWalletAuthRequest(req, expectedPurpose) {
  const address = String(req.headers.get('x-wallet-address') || '').trim()
  const purpose = String(req.headers.get('x-wallet-purpose') || '').trim()
  const timestamp = String(req.headers.get('x-wallet-timestamp') || '').trim()
  const signature = String(req.headers.get('x-wallet-signature') || '').trim()

  if (!address || !timestamp || !signature) {
    throw new Error('Missing wallet authentication headers.')
  }
  if (purpose !== expectedPurpose) {
    throw new Error('Invalid wallet authentication purpose.')
  }

  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > AUTH_WINDOW_MS) {
    throw new Error('Wallet authentication expired.')
  }

  const message = buildWalletAuthMessage({ address, purpose, timestamp })
  const recovered = await recoverMessageAddress({ message, signature })
  if (recovered.toLowerCase() !== address.toLowerCase()) {
    throw new Error('Wallet signature verification failed.')
  }

  return address
}
