import { recoverMessageAddress } from 'viem'

const AUTH_WINDOW_MS = 5 * 60 * 1000

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
