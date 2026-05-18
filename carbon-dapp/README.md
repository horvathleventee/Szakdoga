# carbon-dapp

A `carbon-dapp` a projekt fő webes felülete. Ez egy Next.js alapú decentralizált alkalmazás, amely a Sepolia hálózaton telepített karbonkredit contractokkal kommunikál.

## Élő oldal

https://carbon-bice-xi.vercel.app

Kapcsolódó kvótakezelő demo:

https://carbondummy.vercel.app

## Fő funkciók

- Wallet csatlakoztatás.
- Dashboard token egyenleggel és marketplace áttekintéssel.
- Vállalati profil létrehozása és dokumentumfeltöltés.
- Pinata/IPFS alapú metadata és fájltárolás.
- Admin oldal KYC jóváhagyáshoz és elutasításhoz.
- Karbonkredit mintelés kvóta alapján.
- Karbonkredit transfer és surrender.
- Riportok és surrender események.
- Tranzakciós receipt oldal QR támogatással.
- Piactéri oldalak több kereskedési móddal.

## Fontos oldalak

- `/`: dashboard
- `/profile`: vállalati profil és dokumentumfeltöltés
- `/admin`: admin/KYC jóváhagyás
- `/mint`: kvóta alapján történő mintelés
- `/reports`: surrender riportok
- `/receipt/[tx]`: tranzakciós bizonylat
- `/marketplace/sell-fixed`: fix áras eladás
- `/marketplace/open-auction`: nyílt aukció
- `/marketplace/blind-auction`: vak aukció
- `/marketplace/dutch`: holland aukció
- `/marketplace/buy-orders`: vételi ajánlatok
- `/marketplace/bundle`: csomagos eladás
- `/marketplace/offers`: direkt ajánlatok

## Technológiák

- Next.js
- React
- Wagmi
- Viem
- React Query
- Pinata / IPFS
- Vercel

## Telepítés

```powershell
cd carbon-dapp
npm install
```

## Lokális futtatás

```powershell
npm run dev
```

Alapértelmezett URL:

```text
http://localhost:3000
```

## Ellenőrzés

Lint:

```powershell
npm run lint
```

Production build:

```powershell
npm run build
```

Production szerver helyben:

```powershell
npm run start
```

## Környezeti változók

Helyben `.env.local` fájlban, Vercelen pedig Environment Variables alatt kell beállítani.

```env
NEXT_PUBLIC_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/...
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_ALLOWANCE20_ADDRESS=0x...
NEXT_PUBLIC_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_MARKET_FIXED_ADDRESS=0x...
NEXT_PUBLIC_MARKET_OPEN_AUCTION_ADDRESS=0x...
NEXT_PUBLIC_MARKET_BUY_ORDER_ADDRESS=0x...
NEXT_PUBLIC_MARKET_BLIND_AUCTION_ADDRESS=0x...
NEXT_PUBLIC_MARKET_DUTCH_ADDRESS=0x...
NEXT_PUBLIC_MARKET_BUNDLE_ADDRESS=0x...
NEXT_PUBLIC_MARKET_OFFER_ADDRESS=0x...
PINATA_JWT=...
PINATA_GATEWAY=https://gateway.pinata.cloud/ipfs/
NEXT_PUBLIC_PINATA_GATEWAY=https://gateway.pinata.cloud/ipfs/
```

Fontos: a `PINATA_JWT` nem publikus változó, ezért nem `NEXT_PUBLIC_` prefixszel szerepel. A feltöltési route-ok szerveroldalon használják.

## Vercel deploy

Ajánlott beállítás:

- Framework: Next.js
- Root directory: `carbon-dapp`
- Build command: `npm run build`
- Output: Next.js alapértelmezett

Deploy után ellenőrizni kell:

- a Sepolia RPC URL helyes-e,
- a contract címek az aktuális deployból származnak-e,
- a Pinata JWT működik-e,
- a wallet Sepolia hálózatra van-e állítva.

## Tipikus használati sorrend

1. Wallet csatlakoztatása.
2. Profil létrehozása a `/profile` oldalon.
3. Dokumentum feltöltése Pinata/IPFS segítségével.
4. Admin jóváhagyás a `/admin` oldalon.
5. Kvóta alapján CAC mintelés.
6. Transfer, surrender vagy marketplace tranzakció indítása.
7. Események és riportok ellenőrzése.

## Kapcsolódó modulok

- A contractokat a `../carbon-allowance` modul tartalmazza.
- A kvótakezelő demo a `../quota-calculator` modulban található.

## Biztonsági megjegyzés

Privát kulcsot nem kezel a frontend. A tranzakciókat a felhasználó saját walletje írja alá. A szerveroldali API route-oknál a Pinata JWT-t és az admin/profil feltöltési aláírásokat külön védeni kell.
