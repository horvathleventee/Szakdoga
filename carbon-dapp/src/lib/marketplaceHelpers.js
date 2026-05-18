export function isHexAddress(a) {
  return typeof a === 'string' && /^0x[a-fA-F0-9]{40}$/.test(a)
}

export function shortAddr(a) {
  return a ? a.slice(0, 6) + '...' + a.slice(-4) : ''
}

export function nowSec() {
  return Math.floor(Date.now() / 1000)
}

// bigint comparator: returns -1,0,1
export function cmpBig(a, b) {
  try {
    const A = BigInt(a ?? 0)
    const B = BigInt(b ?? 0)
    return A === B ? 0 : A > B ? 1 : -1
  } catch {
    return 0
  }
}

export { prettyError } from './errorMessages'
