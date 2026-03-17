'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { defineChain } from 'viem'
import { WagmiProvider, createConfig, createStorage, http } from 'wagmi'
import { injected } from 'wagmi/connectors'

const queryClient = new QueryClient()

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 31337)
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545'

const appChain = defineChain({
  id: chainId,
  name: chainId === 11155111 ? 'Sepolia' : 'Hardhat Local',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [rpcUrl] },
    public: { http: [rpcUrl] },
  },
  blockExplorers:
    chainId === 11155111
      ? { default: { name: 'Etherscan', url: 'https://sepolia.etherscan.io' } }
      : undefined,
})

export const wagmiConfig = createConfig({
  chains: [appChain],
  connectors: [injected({ shimDisconnect: true, target: 'metaMask' })],
  transports: {
    [appChain.id]: http(rpcUrl),
  },
  ssr: true,
  autoConnect: true,
  storage: createStorage({
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  }),
})

export function WagmiWrapper({ children }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}
