// scripts/bootstrap.js
const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  // 1) deploy (ha külön scripted van, hívd meg child_process-szel),
  // vagy itt deployolj és mentsd a címeket:
  // ... (te deployod)
  // VAGY ha már van addresses.json a friss deployból:
  const addrs = JSON.parse(fs.readFileSync(path.join(__dirname,'addresses.json'), 'utf8'));
  const CAC = addrs.CAC, REG = addrs.REG;

  // 2) env sync
  require('child_process').execSync('node scripts/sync-env.js', { stdio: 'inherit' });

  // 3) mint + register
  const [admin, you] = await ethers.getSigners();
  const token = await (await ethers.getContractFactory("Allowance20")).attach(CAC);
  await (await token.connect(admin).mint(you.address, 1000n)).wait();

  const reg = await (await ethers.getContractFactory("CacRegistry")).attach(REG);
  const taxIdHash = ethers.keccak256(ethers.toUtf8Bytes("DEMO-TAX-123"));
  await (await reg.connect(you).register(taxIdHash, "ipfs://profileJson", "teszt kft")).wait();

  console.log('✅ bootstrap kész: minted + registered');
}

main().catch(e => { console.error(e); process.exit(1); });
