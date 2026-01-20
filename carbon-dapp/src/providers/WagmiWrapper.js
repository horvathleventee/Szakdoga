'use client'
import { WagmiProvider, createConfig, createStorage, http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { hardhat } from 'wagmi/chains'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

// Ezt a configot modul-szinten hozzuk létre (ne komponensben)
export const wagmiConfig = createConfig({
  chains: [hardhat],
  connectors: [
    // VÁLASSZ: 'metaMask' vagy 'rabby' (ha több wallet be van kapcsolva)
    injected({ shimDisconnect: true, target: 'metaMask' }),
  ],
  transports: {
    [hardhat.id]: http('http://127.0.0.1:8545'),
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
