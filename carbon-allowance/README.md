# carbon-allowance

A `carbon-allowance` a projekt okosszerződéses rétege. Ez a mappa tartalmazza a Solidity contractokat, a Hardhat konfigurációt, a deploy scripteket és a contract teszteket.

## Kapcsolódó élő demók

- Fő dApp: https://carbon-bice-xi.vercel.app
- Kvótakezelő demo app: https://carbondummy.vercel.app

## Szerepe a rendszerben

Ez a modul felel a karbonkredit-token, a vállalati registry, a KYC státuszok, a kvótakezelés és a piactéri contractok blokklánc oldali működéséért. A frontend és a kvótakezelő alkalmazás ezekkel a contractokkal kommunikál.

## Fontos contractok

- `contracts/CacRegistry.sol`: vállalati profilok, KYC státusz, operator jogosultság.
- `contracts/Allowance20.sol`: CAC token, kvóta alapján történő mintelés, surrender funkció.
- `contracts/FixedMarket.sol`: fix áras eladás.
- `contracts/OpenAuctionMarket.sol`: nyílt aukció.
- `contracts/BuyOrderMarket.sol`: vételi ajánlatok.
- `contracts/BlindAuctionMarket.sol`: commit-reveal alapú vak aukció.
- `contracts/DutchAuctionMarket.sol`: holland aukció.
- `contracts/BundleSaleMarket.sol`: csomagos értékesítés.
- `contracts/DirectOfferMarket.sol`: direkt ajánlatos kereskedés.

## Előfeltételek

- Node.js és npm
- Sepolia RPC URL
- Sepolia test ETH a deployer címen
- Privát kulcs a deployhoz

## Telepítés

```powershell
cd carbon-allowance
npm install
```

## Compile

```powershell
npm run compile
```

## Tesztek

```powershell
npm test
```

## Lokális futtatás

Első terminálban Hardhat node:

```powershell
npm run node
```

Második terminálban teljes lokális deploy:

```powershell
npm run deploy:all:local
```

## Sepolia deploy

`.env` példa:

```env
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/...
PRIVATE_KEY=0x...
SERVER_PK=0x...
SERVER_ADDRESS=0x...
OPERATOR=0x...
```

Deploy:

```powershell
npm run deploy:all:sepolia
```

Kvótaállító jogosultság újraadása:

```powershell
npm run grant:quota:sepolia
```

## Fontos scriptek

- `scripts/deploy_all.js`: teljes contract rendszer deployolása.
- `scripts/sync-env.js`: contract címek szinkronizálása frontend env fájlokba.
- `scripts/grant_quota_role.js`: quota setter jogosultság kiosztása.
- `scripts/mint.js`: teszt mintelés.
- `scripts/surrender.js`: teszt surrender tranzakció.
- `scripts/admin_kyc.js`: admin/KYC műveletek tesztelése.

## Deploy után keletkező fájlok

A deploy script `.addr.*.local` fájlokat hozhat létre. Ezek lokális segédfájlok a contract címekhez. Publikus repositoryba általában nem szükséges őket commitolni, mert a deploy során újragenerálhatók.

## Kapcsolat a többi modullal

Sikeres deploy után a script frissítheti:

- `../carbon-dapp/.env.local`
- `../quota-calculator/.env.local`

Ez azért fontos, mert a frontend és a kvótakezelő csak akkor tud helyesen működni, ha az aktuális Sepolia contract címeket használja.

## Gyakori hibák

- `insufficient funds`: nincs elég Sepolia ETH a deployer walleten.
- `missing private key`: nincs beállítva `PRIVATE_KEY`.
- `missing RPC URL`: nincs beállítva `SEPOLIA_RPC_URL`.
- frontend hibás contract címeket olvas: deploy után újra kell szinkronizálni az env fájlokat, majd újra kell deployolni a frontendet is.

## Biztonsági megjegyzés

A `.env` fájl privát kulcsokat tartalmazhat. Ezeket nem szabad commitolni, képernyőképen megosztani vagy publikus helyre feltölteni.
