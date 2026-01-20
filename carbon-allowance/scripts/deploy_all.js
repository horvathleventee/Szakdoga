// scripts/deploy_all.js
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { ethers } = require('hardhat');

function tryWrite(filePath, body, label) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) return false;
    fs.writeFileSync(filePath, body);
    console.log(`Wrote ${label}: ${filePath}`);
    return true;
  } catch {
    return false;
  }
}
function firstExisting(paths) {
  return paths.find(p => fs.existsSync(p)) || null;
}

// .env -> { address?, pk? }
// Elfogadott kulcsok: SERVER_PK, DUMMY_SERVER_PK, DUMMY_SERVER_WALLET (cím vagy PK), DUMMY_SERVER_ADDR
function resolveDummyWalletFromEnv() {
  const envAddr = process.env.DUMMY_SERVER_ADDR;
  const pk = process.env.SERVER_PK || process.env.DUMMY_SERVER_PK;

  let legacy = process.env.DUMMY_SERVER_WALLET; // lehet cím VAGY PK
  let legacyAddr = null, legacyPk = null;
  if (legacy && legacy.startsWith('0x')) {
    if (legacy.length === 66) legacyPk = legacy;   // privát kulcs
    if (legacy.length === 42) legacyAddr = legacy; // cím
  }

  const finalPk = pk || legacyPk || null;
  let finalAddr = envAddr || legacyAddr || null;

  if (!finalAddr && finalPk) {
    try { finalAddr = new (require('ethers')).Wallet(finalPk).address; } catch {}
  }
  return { address: finalAddr, pk: finalPk };
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // 1) Registry
  const OPERATOR = process.env.OPERATOR || "0x8626f6940e2eb28930efb4cef49b2d1f2c9c1199";
  const Reg = await ethers.getContractFactory("CacRegistry");
  const reg = await Reg.deploy(OPERATOR);
  await reg.waitForDeployment();
  const regAddr = await reg.getAddress();
  console.log("Registry deployed at:", regAddr);

  // 2) CAC (Allowance20) – registry cím a konstruktorban
  const Cac = await ethers.getContractFactory("Allowance20");
  const cac = await Cac.deploy(regAddr);
  await cac.waitForDeployment();
  const cacAddr = await cac.getAddress();
  console.log("CAC deployed at:", cacAddr);

  // 3) Marketplace V2 (csak CAC cím kell a konstruktorba!)
  const Mkt2 = await ethers.getContractFactory("CacMarketplaceV2");
  const mkt2 = await Mkt2.deploy(cacAddr);
  await mkt2.waitForDeployment();
  const mkt2Addr = await mkt2.getAddress();
  console.log("Marketplace V2 deployed at:", mkt2Addr);

  // 4) QUOTA_SETTER_ROLE kiosztás a dummy szervernek (ha megvan)
  const { address: serverAddr } = resolveDummyWalletFromEnv();
  const QUOTA_ROLE = ethers.keccak256(ethers.toUtf8Bytes("QUOTA_SETTER_ROLE"));
  if (serverAddr) {
    const cacWithDeployer = await ethers.getContractAt("Allowance20", cacAddr, deployer);
    const has = await cacWithDeployer.hasRole(QUOTA_ROLE, serverAddr);
    if (!has) {
      const tx = await cacWithDeployer.grantRole(QUOTA_ROLE, serverAddr);
      await tx.wait();
      console.log("Granted QUOTA_SETTER_ROLE to:", serverAddr);
    } else {
      console.log("QUOTA_SETTER_ROLE already granted to:", serverAddr);
    }
  } else {
    console.warn("⚠️  Nem adtam QUOTA_SETTER_ROLE-t (nincs SERVER_PK / DUMMY_SERVER_WALLET / DUMMY_SERVER_ADDR).");
  }

  // 5) Címek mentése a gyökérbe
  fs.writeFileSync(".addr.registry.local", regAddr);
  fs.writeFileSync(".addr.allowance.local", cacAddr);
  fs.writeFileSync(".addr.marketv2.local", mkt2Addr);
  console.log("Saved addresses to .addr.*.local files");

  // ==== FRONTEND .env-k =====================================================

  // Dapp .env.local (V2 címmel)
  const dappEnvBody =
`NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_ALLOWANCE20_ADDRESS=${cacAddr}
NEXT_PUBLIC_REGISTRY_ADDRESS=${regAddr}
NEXT_PUBLIC_MARKET_V2_ADDRESS=${mkt2Addr}
# PINATA_GATEWAY=https://gateway.pinata.cloud/ipfs/
# NEXT_PUBLIC_PINATA_GATEWAY=https://gateway.pinata.cloud/ipfs/
`;
  const DAPP_CANDIDATES = [
    path.resolve(__dirname, '..', '..', 'dapp'),
    path.resolve(__dirname, '..', '..', 'carbon-dapp'),
    path.resolve(__dirname, '..', 'dapp'),
  ];
  const dappDir = firstExisting(DAPP_CANDIDATES);
  if (dappDir) {
    tryWrite(path.join(dappDir, '.env.local'), dappEnvBody, 'dapp .env.local');
  } else {
    console.warn("⚠️  Nem találtam dapp mappát. Másold be kézzel a dapp/.env.local fájlba az alábbit:\n\n" + dappEnvBody);
  }

  // Quota-calculator .env.local
  const { pk: serverPk } = resolveDummyWalletFromEnv();
  const qcEnvBody =
`RPC_URL=http://127.0.0.1:8545
CAC_ADDRESS=${cacAddr}
FACTOR_PER_M2=0.05
SERVER_PK=${serverPk || ''}
`;
  const QC_CANDIDATES = [
    path.resolve(__dirname, '..', 'quota-calculator'),
    path.resolve(__dirname, '..', '..', 'quota-calculator')
  ];
  const qcDir = firstExisting(QC_CANDIDATES);
  if (qcDir) {
    tryWrite(path.join(qcDir, '.env.local'), qcEnvBody, 'quota-calculator .env.local');
  } else {
    console.warn("⚠️  Nem találtam quota-calculator mappát. Másold be kézzel a quota-calculator/.env.local fájlba az alábbit:\n\n" + qcEnvBody);
  }

  if (!serverPk && !serverAddr) {
    console.log("ℹ️  Adj meg legalább SERVER_PK-t a gyökér .env-ben (vagy DUMMY_SERVER_WALLET-et / DUMMY_SERVER_ADDR-t), majd futtasd újra a deploy-t.");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
