import { keccak256, encodePacked } from 'viem'

export const isHexAddress = (x) => typeof x === 'string' && /^0x[0-9a-fA-F]{40}$/.test(x)

export function nowSec() {
  return Math.floor(Date.now() / 1000)
}

export function genSalt32() {
  const a = new Uint8Array(32)
  crypto.getRandomValues(a)
  return (
    '0x' +
    Array.from(a)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  )
}

export function makeBlindCommitment({ bidWei, salt, bidder }) {
  return keccak256(encodePacked(['uint256', 'bytes32', 'address'], [bidWei, salt, bidder]))
}

export function prettyError(err) {
  const msg = err?.shortMessage || err?.message || String(err || '')
  if (!msg) return ''
  if (msg.includes('User rejected')) return 'Tranzakció elutasítva a walletben.'
  if (msg.includes('end too soon')) return 'Túl rövid aukció: legalább 2 perc kell.'
  if (msg.includes('commit too soon')) return 'Commit fázis túl rövid (min 2 perc javasolt).'
  if (msg.includes('reveal too soon')) return 'Reveal fázis túl rövid (min 2 perc javasolt).'
  if (msg.includes('no refund')) return 'Nincs felvehető refund.'
  if (msg.includes('already committed')) return 'Már commitáltál erre az aukcióra.'
  if (msg.includes('no commit')) return 'Nincs commit ehhez az aukcióhoz (előbb commit).'
  if (msg.includes('bad reveal')) return 'Rossz reveal adatok (salt/bid mismatch).'
  if (msg.includes('quota exceeded')) return 'Nincs elég kvótád.'
  return msg
}

export function cmpBig(a, b) {
  if (a === b) return 0
  return a < b ? -1 : 1
}

// Fixed: priceWei; Auction: highestBid>0 ? highestBid : reserveWei
export function displayPriceWei(listing) {
  if (Number(listing.saleType) === 0) return listing.priceWei
  return listing.highestBid && listing.highestBid !== 0n ? listing.highestBid : listing.reserveWei
}

export function normalizeListing(x) {
  if (Array.isArray(x)) {
    return {
      id: Number(x[0] ?? 0),
      seller: String(x[1]),
      amountCAC: x[2],
      saleType: x[3],
      status: x[4],
      priceWei: x[5],
      reserveWei: x[6],
      buyoutWei: x[7],
      endTime: x[8],
      highestBidder: x[9],
      highestBid: x[10],
    }
  }
  return {
    id: Number(x.id ?? 0),
    seller: String(x.seller),
    amountCAC: x.amountCAC,
    saleType: x.saleType,
    status: x.status,
    priceWei: x.priceWei,
    reserveWei: x.reserveWei,
    buyoutWei: x.buyoutWei,
    endTime: x.endTime,
    highestBidder: x.highestBidder,
    highestBid: x.highestBid,
  }
}

export function normalizeBuyOrder(x) {
  if (Array.isArray(x)) {
    return {
      id: Number(x[0] ?? 0),
      buyer: String(x[1]),
      amountCAC: x[2],
      offerWei: x[3],
      status: x[4],
    }
  }
  return {
    id: Number(x.id ?? 0),
    buyer: String(x.buyer),
    amountCAC: x.amountCAC,
    offerWei: x.offerWei,
    status: x.status,
  }
}

export function normalizeBlind(x) {
  if (Array.isArray(x)) {
    return {
      id: Number(x[0] ?? 0),
      seller: String(x[1]),
      amountCAC: x[2],
      reserveWei: x[3],
      buyoutWei: x[4],
      commitEndTime: x[5],
      revealEndTime: x[6],
      status: x[7],
      highestBidder: x[8],
      highestBid: x[9],
      commitCount: x[10],
    }
  }
  return {
    id: Number(x.id ?? 0),
    seller: String(x.seller),
    amountCAC: x.amountCAC,
    reserveWei: x.reserveWei,
    buyoutWei: x.buyoutWei,
    commitEndTime: x.commitEndTime,
    revealEndTime: x.revealEndTime,
    status: x.status,
    highestBidder: x.highestBidder,
    highestBid: x.highestBid,
    commitCount: x.commitCount,
  }
}

export function unitPriceWeiPerCAC(order) {
  try {
    const a = BigInt(order.amountCAC || 0n)
    if (a === 0n) return 0n
    return BigInt(order.offerWei || 0n) / a
  } catch {
    return 0n
  }
}
