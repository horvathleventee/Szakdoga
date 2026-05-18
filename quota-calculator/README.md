# quota-calculator

A `quota-calculator` egy külön Next.js alapú segédalkalmazás, amely a karbonkredit-kvóták demo számítását és lekérdezését végzi. A fő dApp mellett fut, és azt szemlélteti, hogyan kapcsolható külső kvótaforrás vagy számítási logika az on-chain tokenkezeléshez.

## Élő oldal

https://carbondummy.vercel.app

Kapcsolódó fő dApp:

https://carbon-bice-xi.vercel.app

## Szerepe a rendszerben

Ez a modul nem a teljes karbonkredit-piacteret kezeli, hanem a kvótához kapcsolódó részfolyamatot mutatja be:

- adott wallet címhez tartozó kvóta lekérdezése,
- terület alapján demo kvóta számítása,
- kvóta beállítása a CAC contracton keresztül,
- a fő dApp mintelési folyamatának támogatása.

## Technológiák

- Next.js
- React
- TypeScript
- Ethers
- Vercel

## Telepítés

```powershell
cd quota-calculator
npm install
```

## Lokális futtatás

```powershell
npm run dev
```

Alapértelmezett URL:

```text
http://localhost:4000
```

## Build

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
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/...
CAC_ADDRESS=0x...
FACTOR_PER_M2=0.05
SERVER_PK=0x...
```

Változók szerepe:

- `RPC_URL`: Sepolia RPC endpoint.
- `CAC_ADDRESS`: az `Allowance20` contract címe.
- `FACTOR_PER_M2`: demo számítási faktor.
- `SERVER_PK`: az a backend wallet privát kulcsa, amely jogosult kvótát állítani.

## API végpontok

Kvóta lekérdezése:

```text
GET /api/get-quota?user=0x...
```

Faktor lekérdezése:

```text
GET /api/get-quota?meta=factor
```

Kvóta beállítása:

```text
POST /api/set-quota
```

Példa body:

```json
{
  "user": "0x...",
  "areaM2": 1000
}
```

## Vercel deploy

Ajánlott beállítás:

- Framework: Next.js
- Root directory: `quota-calculator`
- Build command: `npm run build`
- Production URL: https://carbondummy.vercel.app

Deploy után ellenőrizni kell:

- a `RPC_URL` élő Sepolia endpoint-e,
- a `CAC_ADDRESS` az aktuális contract deploy címe-e,
- a `SERVER_PK` wallet rendelkezik-e quota setter jogosultsággal,
- van-e elég Sepolia ETH a szerveroldali wallet címen, ha on-chain írást indít.

## Biztonsági megjegyzés

A `SERVER_PK` privát kulcs, ezért nem kerülhet kliensoldali kódba vagy publikus repositoryba. Vercelen csak titkos environment variable-ként szabad kezelni.
