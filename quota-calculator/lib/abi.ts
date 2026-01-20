// quota-calculator/lib/abi.ts
export const allowance20Abi = [
  {
    inputs: [
      { internalType: 'address', name: 'user', type: 'address' },
      { internalType: 'uint256', name: 'quota', type: 'uint256' },
    ],
    name: 'setMintQuota',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: '', type: 'address' }],
    name: 'remainingQuota',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // csak akkor kell, ha a dApp-ból kvótából mintelsz:
  {
    inputs: [{ internalType: 'uint256', name: 'amount', type: 'uint256' }],
    name: 'mintFromQuota',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;
