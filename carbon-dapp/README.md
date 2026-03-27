# carbon-dapp

A `carbon-dapp` a szakdolgozati projekt fo felhasznaloi felulete.  
Ez egy Next.js alapu webalkalmazas, amely a Sepolia halozaton futtathato CAC smart contractokhoz kapcsolodik.

## Fobb funkciok

- wallet connect
- dashboard es token egyenleg megjelenites
- vallalati profilkezeles
- KYC status megjelenites
- dokumentum- es metadata-feltoltes Pinata / IPFS hasznalataval
- admin oldal KYC jovahagyashoz
- surrender riportok
- receipt oldal QR tamogatassal
- tobbfele marketplace oldal

## Technologiak

- Next.js 16
- React 19
- Wagmi
- Viem
- React Query
- Pinata / IPFS

## Mappa szerepe

Ez a csomag csak a frontendet tartalmazza.  
A contract deployment es a blokklanc oldali logika a `../carbon-allowance` projektben talalhato.

## Futtatas lokalban

```powershell
cd carbon-dapp
npm install
npm run dev
```

Build ellenorzes:

```powershell
npm run lint
npm run build
```

## Szükséges env valtozok

Peldak:

```env
NEXT_PUBLIC_RPC_URL=...
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_ALLOWANCE20_ADDRESS=...
NEXT_PUBLIC_REGISTRY_ADDRESS=...
NEXT_PUBLIC_MARKET_FIXED_ADDRESS=...
NEXT_PUBLIC_MARKET_OPEN_AUCTION_ADDRESS=...
NEXT_PUBLIC_MARKET_BUY_ORDER_ADDRESS=...
NEXT_PUBLIC_MARKET_BLIND_AUCTION_ADDRESS=...
NEXT_PUBLIC_MARKET_DUTCH_ADDRESS=...
NEXT_PUBLIC_MARKET_BUNDLE_ADDRESS=...
NEXT_PUBLIC_MARKET_OFFER_ADDRESS=...
PINATA_JWT=...
PINATA_GATEWAY=...
NEXT_PUBLIC_PINATA_GATEWAY=...
```

Az env-eket helyileg `.env.local` fajlban, productionben pedig Vercel environment variable-kent erdemes kezelni.

## Fontos oldalak

- `/` dashboard
- `/profile` vallalati profil es dokumentumok
- `/admin` KYC approval
- `/reports` surrender riportok
- `/receipt/[tx]` tranzakcios receipt
- `/marketplace/*` piacteri oldalak

## Hosting

Javasolt hosting: Vercel

Ajánlott beallitas:
- Framework: Next.js
- Root directory: `carbon-dapp`
- Production env-ek: a helyi `.env.local` alapjan

## Megjegyzes

A projektben tobb oldal blokklanc adatokat olvas es tranzakciokat kuld. Emiatt production hasznalatnal kiemelten fontos:

- a helyes RPC URL
- a pontos contract cimek
- a Pinata token biztonsagos kezelese
- a wallet csatlakozas Sepolia halozaton
