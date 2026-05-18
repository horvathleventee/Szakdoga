# Measurement Tools

Ez a mappa a szakdolgozati projekt mérési, validálási és benchmark segédeszközeit tartalmazza. A scriptek célja, hogy a build, lint, teszt, API válaszidő és Lighthouse eredmények ismételhetően mérhetők legyenek.

## Élő mérési célpontok

- Fő dApp: https://carbon-bice-xi.vercel.app
- Kvótakezelő demo: https://carbondummy.vercel.app

## Tartalom

- `run-validation.mjs`: automatikus validálási folyamat.
- `benchmark-api.mjs`: egyszerű API válaszidő benchmark.
- `run-lighthouse.ps1`: Lighthouse futtatását segítő PowerShell wrapper.

## 1. Automatikus validálás

Projektgyökérből futtatva:

```powershell
node .\tools\run-validation.mjs
```

A script ellenőrzi:

- `carbon-allowance` smart contract tesztek,
- `carbon-dapp` lint,
- `carbon-dapp` production build,
- `quota-calculator` production build.

Az eredményeket időbélyeges fájlokba tudja menteni, így a szakdolgozat mérési mellékleteihez is használható.

## 2. API benchmark

Fő dApp riport endpoint:

```powershell
node .\tools\benchmark-api.mjs --url "https://carbon-bice-xi.vercel.app/api/reports/surrenders" --runs 5
```

Admin surrender endpoint:

```powershell
node .\tools\benchmark-api.mjs --url "https://carbon-bice-xi.vercel.app/api/admin/surrenders" --runs 5
```

Kvótalekérdezés hosted környezetben:

```powershell
node .\tools\benchmark-api.mjs --url "https://carbondummy.vercel.app/api/get-quota?user=0xd46b3c48de6480a8ED4eE757E52Aab8F5cA33D35" --runs 5
```

Lokális kvótalekérdezés:

```powershell
node .\tools\benchmark-api.mjs --url "http://localhost:4000/api/get-quota?user=0xd46b3c48de6480a8ED4eE757E52Aab8F5cA33D35" --runs 5
```

POST példa a demo kvótabeállításhoz:

```powershell
node .\tools\benchmark-api.mjs --url "http://localhost:4000/api/set-quota" --method POST --body "{\"user\":\"0x...\",\"areaM2\":1000}" --runs 3
```

Mért értékek:

- átlagos válaszidő,
- minimum,
- maximum,
- P95,
- hibaarány.

## 3. Lighthouse mérés

Desktop mérés:

```powershell
.\tools\run-lighthouse.ps1 -Url "https://carbon-bice-xi.vercel.app/" -Mode desktop
```

Mobil mérés:

```powershell
.\tools\run-lighthouse.ps1 -Url "https://carbon-bice-xi.vercel.app/" -Mode mobile
```

Ha a Chrome nincs PATH-on:

```powershell
.\tools\run-lighthouse.ps1 -Url "https://carbon-bice-xi.vercel.app/" -Mode mobile -ChromePath "C:\Program Files\Google\Chrome\Application\chrome.exe"
```

## Javasolt mérési sorrend

1. `node .\tools\run-validation.mjs`
2. Lighthouse desktop mérés
3. Lighthouse mobile mérés
4. Lokális API benchmark
5. Hosted/Vercel API benchmark

## Megjegyzések

- Wallet popupot, MetaMask aláírást és valódi felhasználói döntéseket nem lehet teljesen automatizálni ezekkel a scriptekkel.
- A blokklánc-eseményeket olvasó endpointok válaszideje függ az RPC szolgáltatótól is.
- A `set-quota` író endpointot csak kis terheléssel érdemes mérni, mert on-chain műveletet indíthat.
