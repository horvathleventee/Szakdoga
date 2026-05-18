# CAC Registry & Marketplace

Szakdolgozati projekt egy Ethereum-alapú karbonkredit-nyilvántartó és kereskedelmi rendszer prototípusához. A repository tartalmazza az okosszerződéseket, a fő webes dApp-ot, a kvótakezelő segédalkalmazást, valamint a mérési és validálási segédeszközöket.

## Élő demók

- Fő dApp: https://carbon-bice-xi.vercel.app
- Kvótakezelő demo app: https://carbondummy.vercel.app

## Projekt célja

A rendszer célja annak bemutatása, hogy a blokklánc-technológia hogyan használható karbonkreditek nyilvántartására, átruházására, beváltására és piactéri kereskedelmére. A megoldás Sepolia teszthálózaton működik, MetaMask/wallet alapú interakcióval, IPFS-alapú dokumentumtárolással és többféle kereskedési modellel.

## Fő komponensek

- `carbon-allowance`: Hardhat projekt Solidity okosszerződésekkel és deploy scriptekkel.
- `carbon-dapp`: Next.js alapú fő felhasználói felület, admin oldallal, profillal, riportokkal és marketplace funkciókkal.
- `quota-calculator`: külön Next.js alkalmazás kvótalekérdezéshez és demo kvótabeállításhoz.
- `tools`: validálási, benchmark és Lighthouse segédscriptek.

## Fő funkciók

- Wallet csatlakoztatás Sepolia hálózaton.
- Vállalati profil és KYC jellegű adminisztratív jóváhagyás.
- Dokumentum- és metadata-feltöltés Pinata/IPFS használatával.
- CAC token mintelés kvóta alapján.
- Token átadás és karbonkredit beváltás.
- Riportok, surrender események és tranzakciós receipt oldal.
- Több piactéri modell: fix ár, nyílt aukció, vak aukció, holland aukció, vételi ajánlat, csomagos eladás és direkt ajánlat.

## Technológiák

- Solidity, Hardhat, OpenZeppelin
- Next.js, React
- Wagmi, Viem, Ethers
- MetaMask / wallet integráció
- Pinata / IPFS
- Vercel
- Sepolia Ethereum teszthálózat

## Repository szerkezet

```text
Szakdoga-main/
|- carbon-allowance/     # Solidity contractok és deployment scriptek
|- carbon-dapp/          # fő Next.js dApp
|- quota-calculator/     # kvóta kalkulátor és demo API
|- tools/                # mérési és validálási segédeszközök
|- README.md             # projekt összefoglaló
```

## Előfeltételek

- Node.js és npm
- MetaMask vagy más böngészős wallet
- Sepolia test ETH a deployer / teszt wallet címen
- Sepolia RPC URL például Alchemy vagy Infura szolgáltatótól
- Pinata JWT dokumentumfeltöltéshez

## Lokális futtatás

### 1. Smart contractok

```powershell
cd carbon-allowance
npm install
npm run compile
npm test
```

Lokális Hardhat node:

```powershell
npm run node
```

Másik terminálban lokális deploy:

```powershell
npm run deploy:all:local
```

Sepolia deploy:

```powershell
npm run deploy:all:sepolia
```

A deploy script a contract címeket `.addr.*.local` fájlokba menti, és frissíti a `carbon-dapp/.env.local`, illetve `quota-calculator/.env.local` fájlokat is.

### 2. Fő dApp

```powershell
cd carbon-dapp
npm install
npm run dev
```

Alapértelmezett helyi URL:

```text
http://localhost:3000
```

Build és lint ellenőrzés:

```powershell
npm run lint
npm run build
```

### 3. Kvótakezelő demo

```powershell
cd quota-calculator
npm install
npm run dev
```

Alapértelmezett helyi URL:

```text
http://localhost:4000
```

Build ellenőrzés:

```powershell
npm run build
```

## Környezeti változók

Éles vagy publikus repositoryba privát kulcsot, RPC kulcsot és Pinata JWT-t nem szabad commitolni. A következő értékek csak példák.

### `carbon-allowance/.env`

```env
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/...
PRIVATE_KEY=0x...
SERVER_PK=0x...
SERVER_ADDRESS=0x...
OPERATOR=0x...
```

### `carbon-dapp/.env.local`

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

### `quota-calculator/.env.local`

```env
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/...
CAC_ADDRESS=0x...
FACTOR_PER_M2=0.05
SERVER_PK=0x...
```

## Hosting Vercelen

### `carbon-dapp`

- Root directory: `carbon-dapp`
- Framework: Next.js
- Production URL: https://carbon-bice-xi.vercel.app
- Environment variables: a `carbon-dapp/.env.local` alapján

### `quota-calculator`

- Root directory: `quota-calculator`
- Framework: Next.js
- Production URL: https://carbondummy.vercel.app
- Environment variables: a `quota-calculator/.env.local` alapján

## Hasznos parancsok

Smart contractok:

```powershell
cd carbon-allowance
npm run compile
npm test
npm run deploy:all:sepolia
npm run grant:quota:sepolia
```

Fő dApp:

```powershell
cd carbon-dapp
npm run lint
npm run build
npm run dev
```

Kvóta kalkulátor:

```powershell
cd quota-calculator
npm run build
npm run dev
```

Mérések:

```powershell
node .\tools\run-validation.mjs
node .\tools\benchmark-api.mjs --url "https://carbon-bice-xi.vercel.app/api/reports/surrenders" --runs 5
```

## Biztonsági megjegyzések

- A `PRIVATE_KEY`, `SERVER_PK`, `PINATA_JWT` és RPC kulcsok titkos adatok.
- A frontendben csak `NEXT_PUBLIC_*` változók legyenek publikusak.
- A Pinata JWT szerveroldali környezeti változóként kezelendő.
- Sepolia deployment után a Vercel env-eket is frissíteni kell az új contract címekkel.

## Szerző

Horváth Levente
Szakdolgozati projekt
