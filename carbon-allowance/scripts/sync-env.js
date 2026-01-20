// scripts/sync-env.js
const fs = require('fs');
const path = require('path');

function writeEnv(cac, reg, mkt) {
  const p = path.join(__dirname, '..', 'carbon-dapp', '.env.local');
  const lines = [
    `NEXT_PUBLIC_ALLOWANCE20_ADDRESS=${cac}`,
    `NEXT_PUBLIC_REGISTRY_ADDRESS=${reg}`,
    `NEXT_PUBLIC_MARKET_ADDRESS=${mkt}`,
    ''
  ];
  fs.writeFileSync(p, lines.join('\n'));
  console.log('✅ .env.local frissítve:', p);
}

// !!! igazítsd ahhoz, ahová a deploy script kiírja a címeket:
const out = JSON.parse(fs.readFileSync(path.join(__dirname, 'addresses.json'), 'utf8'));
// pl: { CAC: "0x...", REG: "0x...", MKT: "0x..." }
writeEnv(out.CAC, out.REG, out.MKT);
