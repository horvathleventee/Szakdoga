# External Calculator (Standalone)

Egyszerű, statikus mini-site a mintelhető CAC kvóta kiszámításához.
A dApp `/mint` oldalára visz át: `...?quota=...&area=...&rate=...&source=external`.

## Használat
1) Másold `src/config.example.js` → `src/config.js` és állítsd be a `DAPP_ORIGIN`-t.
2) Nyisd meg `src/index.html`-t a böngészőben, vagy futtasd egy statikus szerverről.

## Gyors lokális szerver
```bash
npx serve .
# vagy
python3 -m http.server 8080
