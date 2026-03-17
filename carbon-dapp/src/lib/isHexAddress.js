export const isHexAddress = (x) => typeof x === 'string' && /^0x[0-9a-fA-F]{40}$/.test(x)
