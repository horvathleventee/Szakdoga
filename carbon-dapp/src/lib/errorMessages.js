function collectErrorText(error, seen = new Set()) {
  if (!error) return ''
  if (typeof error === 'string') return error
  if (seen.has(error)) return ''
  if (typeof error === 'object') seen.add(error)

  const parts = []
  for (const key of ['shortMessage', 'details', 'message', 'name', 'code']) {
    const value = error?.[key]
    if (value !== undefined && value !== null) parts.push(String(value))
  }

  if (error?.cause) parts.push(collectErrorText(error.cause, seen))
  if (Array.isArray(error?.errors)) {
    for (const item of error.errors) parts.push(collectErrorText(item, seen))
  }

  return parts.filter(Boolean).join('\n')
}

function stripTechnicalDetails(message) {
  return String(message || '')
    .replace(/^Error:\s*/i, '')
    .split(/\nRequest Arguments:/i)[0]
    .split(/\nContract Call:/i)[0]
    .split(/\nDocs:/i)[0]
    .split(/\nDetails:/i)[0]
    .split(/\nVersion:/i)[0]
    .trim()
}

function extractRevertReason(text) {
  const patterns = [
    /reverted with (?:the following )?reason:\s*"?([^"\n]+)"?/i,
    /execution reverted:?\s*"?([^"\n]+)"?/i,
    /reason="([^"]+)"/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) return match[1].trim()
  }

  return ''
}

function explainContractReason(reason) {
  const normalized = String(reason || '').toLowerCase()
  if (!normalized) return ''

  if (normalized.includes('quota exceeded')) {
    return 'A megadott mennyiseg nagyobb, mint a rendelkezesre allo kvota.'
  }
  if (normalized.includes('amount=0') || normalized.includes('deposit=0')) {
    return 'Adj meg 0-nal nagyobb mennyiseget.'
  }
  if (normalized.includes('not registered') || normalized.includes('no profile')) {
    return 'Ehhez a muvelethez elobb regisztralt profil szukseges.'
  }
  if (normalized.includes('kyc not approved')) {
    return 'A muvelethez jovahagyott KYC/profil szukseges.'
  }
  if (normalized.includes('not operator') || normalized.includes('admin access denied')) {
    return 'Ehhez a muvelethez nincs admin/operator jogosultsagod.'
  }
  if (normalized.includes('allowance') || normalized.includes('approve')) {
    return 'Elobb jovahagyasra van szukseg az adott szerzodes fele.'
  }
  if (normalized.includes('already exists')) {
    return 'Ehhez a wallethez mar letezik regisztralt profil.'
  }
  if (normalized.includes('not active')) {
    return 'Ez az ajanlat vagy aukcio mar nem aktiv.'
  }
  if (normalized.includes('commit ended')) {
    return 'A vak aukcio commit idoszaka mar lezarult.'
  }
  if (normalized.includes('reveal not started')) {
    return 'A vak aukcio reveal idoszaka meg nem kezdodott el.'
  }
  if (normalized.includes('reveal ended')) {
    return 'A vak aukcio reveal idoszaka mar lezarult.'
  }
  if (normalized.includes('bad reveal')) {
    return 'A felfedett vak licit nem egyezik a korabban bekuldott commitmenttel.'
  }
  if (normalized.includes('insufficient balance')) {
    return 'Nincs eleg CAC tokened ehhez a muvelethez.'
  }

  return ''
}

export function prettyError(error, fallback = 'A muvelet nem sikerult. Probald ujra kesobb.') {
  if (!error) return ''

  const raw = collectErrorText(error)
  const text = raw.toLowerCase()

  if (
    text.includes('user rejected') ||
    text.includes('user denied') ||
    text.includes('denied transaction signature') ||
    text.includes('rejected the request') ||
    text.includes('4001')
  ) {
    return 'A tranzakciot elutasitottad a walletben. Nem tortent valtozas.'
  }

  if (text.includes('insufficient funds')) {
    return 'Nincs eleg Sepolia ETH a tranzakcio gas dijahoz.'
  }

  if (text.includes('connector not connected') || text.includes('provider not found') || text.includes('no wallet')) {
    return 'Csatlakoztasd a walleted, majd probald ujra.'
  }

  if (text.includes('invalid address') || text.includes('address is invalid') || text.includes('ens')) {
    return 'Ervenytelen Ethereum-cim. Ellenorizd, hogy 0x-szel kezdodo, 42 karakteres cimet adtal-e meg.'
  }

  if (text.includes('wallet authentication expired')) {
    return 'A wallet-alairas lejart. Inditsd ujra a muveletet, es ird ala ujra a kerest.'
  }

  if (text.includes('missing wallet authentication') || text.includes('wallet signature verification failed')) {
    return 'A muvelethez ervenyes wallet-alairas szukseges. Probald ujra az alairast.'
  }

  if (text.includes('invalid wallet authentication purpose')) {
    return 'A wallet-alairas nem ehhez a muvelethez tartozik. Inditsd ujra a folyamatot.'
  }

  if (text.includes('pinata') || text.includes('invalid_credentials')) {
    if (text.includes('missing pinata_jwt') || text.includes('invalid_credentials') || text.includes('signature is invalid')) {
      return 'A Pinata feltoltes nem sikerult. Ellenorizni kell a szerver oldali PINATA_JWT beallitast.'
    }
    return 'A Pinata feltoltes nem sikerult. Probald ujra, vagy ellenorizd a feltoltendo fajlt.'
  }

  if (text.includes('failed to fetch') || text.includes('http request failed') || text.includes('429') || text.includes('eth_getlogs')) {
    return 'Nem sikerult elerni a blokklanc RPC szolgaltatot. Varj par masodpercet, majd frissits vagy probald ujra.'
  }

  const reason = extractRevertReason(raw)
  const contractMessage = explainContractReason(reason || raw)
  if (contractMessage) return contractMessage

  const cleaned = stripTechnicalDetails(
    error?.shortMessage ||
    error?.details ||
    error?.message ||
    (typeof error === 'string' ? error : '')
  )

  return cleaned || fallback
}
