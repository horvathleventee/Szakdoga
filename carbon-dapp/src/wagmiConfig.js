import { http, createConfig } from 'wagmi'
import { defineChain } from 'viem'

// Egyedi chain definíció a Hardhat lokális lánchoz
const localChain = defineChain({
  id: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID),
  name: 'Hardhat Local',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_RPC_URL] },
  },
})

// Itt MOST NEM adunk meg connectors-t.
// Ezt kliens oldalon fogjuk létrehozni, amire kattintasz.
export const wagmiConfig = createConfig({
  chains: [localChain],
  transports: {
    [localChain.id]: http(process.env.NEXT_PUBLIC_RPC_URL),
  },
})
