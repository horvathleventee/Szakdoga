# carbon-allowance

A `carbon-allowance` a szakdolgozati projekt smart contract es deployment resze.  
Ez a csomag kezeli a CAC tokenhez, a registryhez es a marketplace modokhoz tartozo Solidity szerzodeseket.

## Fobb elemek

- `CacRegistry`
  - vallalati profilok
  - KYC statusz
  - operator jogosultsagok
- `Allowance20`
  - CAC token
  - kvota kezeles
  - surrender funkcio
- marketplace contractok
  - fixed price
  - open auction
  - buy order
  - blind auction
  - dutch auction
  - bundle sale
  - direct offer

## Technologiak

- Solidity
- Hardhat
- OpenZeppelin Contracts
- dotenv

## Fontos scriptek

- `scripts/deploy.js`
- `scripts/deploy_all.js`
- `scripts/grant_quota_role.js`
- `scripts/sync-env.js`
- `scripts/mint.js`
- `scripts/surrender.js`

## Futtatas lokalban

Telepites:

```powershell
cd carbon-allowance
npm install
```

Compile:

```powershell
npm run compile
```

Teszt:

```powershell
npm test
```

Lokalis node:

```powershell
npm run node
```

Lokalis teljes deploy:

```powershell
npm run deploy:all:local
```

## Sepolia deploy

```powershell
cd carbon-allowance
npm run deploy:all:sepolia
```

Quota setter jog adasa:

```powershell
npm run grant:quota:sepolia
```

## Szükséges env valtozok

Peldak:

```env
SEPOLIA_RPC_URL=...
PRIVATE_KEY=...
SERVER_PK=...
SERVER_ADDRESS=...
CAC_ADDRESS=...
```

## Kimeneti fajlok

A deploy folyamat letrehozhat `.addr.*.local` fajlokat. Ezek lokalis segedfajlok, nem szuksegesek a repositoryban, ezert erdemes ignore-olni oket.

## Kapcsolat a frontenddel

Ez a projekt a deploy utan a frontendhez szukseges cimeket is eloallitja, amelyeket a `carbon-dapp` es a `quota-calculator` tud felhasznalni.

## Megjegyzes

Production vagy publikus demo kornyezetben kulonosen fontos:

- a deployer kulcs biztonsagos kezelese
- a backend wallet kulon kezelese
- a helyes Sepolia RPC beallitas
- a frontend env-ek szinkronban tartasa az uj contract cimekkel
