# CAC Registry & Marketplace

Szakdolgozati projekt egy blokklanc-alapu karbonkredit rendszerhez.  
A repository egy teljes demo kornyezetet tartalmaz: okosszerzodesek, webes dApp, valamint egy kulon kvota-szamolo szolgaltatas.

## Projekt celja

A rendszer celja egy olyan karbonkredit-platform bemutatasa, ahol:

- a cegek regisztralhatnak es KYC jovahagyast kaphatnak,
- karbonkreditet (CAC) kaphatnak vagy kezelhetnek,
- karbonkreditet tudnak atadni es surrenderelni,
- tobbfele piacteri modban kereskedhetnek,
- a surrender es kvota folyamatok visszakovethetoen, blokklancon jelennek meg.

## Fobb komponensek

### `carbon-allowance`
Hardhat-alapu smart contract projekt.

Tartalma:
- `CacRegistry` a vallalati profilokhoz es KYC-hoz
- `Allowance20` a CAC tokenhez
- tobb marketplace contract:
  - fixed price
  - open auction
  - buy order
  - blind auction
  - dutch auction
  - bundle sale
  - direct offer

### `carbon-dapp`
Next.js alapu felhasznaloi felulet.

Funkciok:
- wallet connect
- dashboard
- profil es dokumentumfeltoltes
- admin / KYC approval
- surrender riportok
- marketplace oldalak
- receipt / QR alapu visszanezes

### `quota-calculator`
Kulon Next.js app a kvota szamitasahoz es on-chain kvotabeallitashoz.

## Technologiak

- Solidity
- Hardhat
- Next.js
- React
- Wagmi
- Viem
- Ethers
- Vercel
- Pinata / IPFS
- Sepolia teszthalozat

## Repository szerkezet

```text
Szakdoga-main/
|- carbon-allowance/     # smart contractok es deployment scriptek
|- carbon-dapp/          # fo webes dApp
|- quota-calculator/     # kulon kvota-szamolo app
|- szakdoga.txt          # kapcsolodo szoveges anyag
```

## Lokalis futtatas

### 1. Smart contractok

```powershell
cd carbon-allowance
npm install
npm run compile
npm test
```

Lokalis node:

```powershell
npm run node
```

Lokalis deploy:

```powershell
npm run deploy:all:local
```

### 2. dApp

```powershell
cd carbon-dapp
npm install
npm run build
npm run dev
```

### 3. Quota calculator

```powershell
cd quota-calculator
npm install
npm run build
npm run dev
```

## Kornyezeti valtozok

Erzekeny adatok nincsenek a README-ben. A valos `.env` es `.env.local` fajlok helyben kezelendok, es nem erdemes oket publikus repositoryba commitolni.

### `carbon-allowance/.env`

Tipikus valtozok:

```env
SEPOLIA_RPC_URL=...
PRIVATE_KEY=...
SERVER_PK=...
SERVER_ADDRESS=...
CAC_ADDRESS=...
```

### `carbon-dapp/.env.local`

Tipikus valtozok:

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

### `quota-calculator/.env.local`

```env
RPC_URL=...
CAC_ADDRESS=...
FACTOR_PER_M2=0.05
SERVER_PK=...
```

## Sepolia deployment

Contract deploy:

```powershell
cd carbon-allowance
npm run deploy:all:sepolia
```

Quota jogosultsag ujraadasa:

```powershell
npm run grant:quota:sepolia
```

A deploy script a frontend oldali cimek szinkronizalasat is segiti.

## Hosting

### `carbon-dapp`
Javasolt host: Vercel

Beallitasok:
- Framework: Next.js
- Root directory: `carbon-dapp`
- Production env-ek: a `carbon-dapp/.env.local` alapjan

### `quota-calculator`
Javasolt host: Vercel

Beallitasok:
- Framework: Next.js
- Root directory: `quota-calculator`
- Production env-ek: a `quota-calculator/.env.local` alapjan

## Megvalositott funkciok

- vallalati regisztracio
- KYC jovahagyas es elutasitas
- metadata es dokumentum IPFS feltoltes
- CAC token egyenleg es kvota kezeles
- surrender tranzakciok
- transfer tranzakciok
- piacteri modok kezelese
- riportok es surrender esemenyek listazasa
- receipt oldal QR tamogatassal
- Sepolia deploy es Vercel hosting

## Megjegyzesek

- A projekt szakdolgozati demo celra keszult.
- A frontend es a contractok Sepolian futtathatok.
- A Pinata es wallet kulcsok kulonosen erzekeny adatok, ezeket mindig biztonsagosan kell kezelni.
- Lighthouse vagy tovabbi teljesitmenyoptimalizalas eseten a dashboard mar szet lett bontva, hogy a marketplace statisztikak ne noveljek feleslegesen a kezdooldal indulasi JS-meretet.

## Hasznos parancsok

### Smart contracts

```powershell
cd carbon-allowance
npm run compile
npm test
npm run deploy:all:local
npm run deploy:all:sepolia
```

### dApp

```powershell
cd carbon-dapp
npm run lint
npm run build
npm run dev
```

### Quota calculator

```powershell
cd quota-calculator
npm run build
npm run dev
```

## Szerzo

Horvath Levente  
Szakdolgozati projekt
