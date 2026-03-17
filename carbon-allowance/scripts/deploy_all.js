// scripts/deploy_all.js
require("dotenv").config();
const path = require("path");
const fs = require("fs");
const hre = require("hardhat");
const { ethers, network } = hre;

/**
 * --------- Helpers: filesystem + env upsert ----------
 */
function firstExisting(paths) {
  return paths.find((p) => fs.existsSync(p)) || null;
}

function readTextIfExists(filePath) {
  try {
    if (!fs.existsSync(filePath)) return "";
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

/**
 * Upsert env keys into existing .env-like content, preserving unknown lines and comments.
 * - Keeps PINATA_JWT and everything else untouched.
 * - Replaces only matching KEY=... lines, or appends missing keys at end.
 */
function upsertEnvContent(existing, updates) {
  const lines = (existing || "").split(/\r?\n/);
  const seen = new Set();

  const out = lines.map((line) => {
    if (!line || line.trim().startsWith("#")) return line;

    const eq = line.indexOf("=");
    if (eq === -1) return line;

    const key = line.slice(0, eq).trim();
    if (!Object.prototype.hasOwnProperty.call(updates, key)) return line;

    seen.add(key);
    return `${key}=${updates[key]}`;
  });

  for (const [k, v] of Object.entries(updates)) {
    if (!seen.has(k)) out.push(`${k}=${v}`);
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

function tryWrite(filePath, body, label) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) return false;
    fs.writeFileSync(filePath, body);
    console.log(`Wrote ${label}: ${filePath}`);
    return true;
  } catch (e) {
    console.warn(`⚠️ Failed writing ${label}:`, e?.message || e);
    return false;
  }
}

/**
 * --------- Dummy server resolver ----------
 * .env -> { address?, pk? }
 * Accepted keys: SERVER_PK, DUMMY_SERVER_PK, DUMMY_SERVER_WALLET (addr or pk), DUMMY_SERVER_ADDR
 */
function resolveDummyWalletFromEnv() {
  const envAddr = process.env.DUMMY_SERVER_ADDR;
  const pk = process.env.SERVER_PK || process.env.DUMMY_SERVER_PK;

  let legacy = process.env.DUMMY_SERVER_WALLET; // can be address OR PK
  let legacyAddr = null;
  let legacyPk = null;

  if (legacy && legacy.startsWith("0x")) {
    if (legacy.length === 66) legacyPk = legacy; // private key
    if (legacy.length === 42) legacyAddr = legacy; // address
  }

  const finalPk = pk || legacyPk || null;
  let finalAddr = envAddr || legacyAddr || null;

  if (!finalAddr && finalPk) {
    try {
      finalAddr = new (require("ethers")).Wallet(finalPk).address;
    } catch {}
  }
  return { address: finalAddr, pk: finalPk };
}

async function grantRoleIfNeeded(cacAddr, role, grantee, deployerSigner) {
  const cac = await ethers.getContractAt("Allowance20", cacAddr, deployerSigner);
  const has = await cac.hasRole(role, grantee);
  if (!has) {
    const tx = await cac.grantRole(role, grantee);
    await tx.wait();
    console.log(`Granted role to: ${grantee}`);
  } else {
    console.log(`Role already granted to: ${grantee}`);
  }
}

/**
 * ✅ Enable 1s interval mining on LOCALHOST only
 * This makes block.timestamp advance even with no tx, so dutch/auction timers feel real-time.
 */
async function setupMining1s() {
  const netName = hre.network?.name || "";
  if (netName !== "localhost") {
    console.log(`ℹ️ setupMining1s skipped (network=${netName}).`);
    return;
  }

  try {
    await network.provider.send("evm_setAutomine", [true]);
  } catch {}

  try {
    await network.provider.send("evm_setIntervalMining", [1000]); // 1000ms = 1s blocks
    console.log("✅ Mining: automine=true, intervalMining=1000ms (1s blocks)");
  } catch (e) {
    console.log("ℹ️ Interval mining not supported:", e?.message || e);
  }
}

/**
 * --------- Main ----------
 */
async function main() {
  // Make sure you run with: npx hardhat run scripts/deploy_all.js --network localhost
  await setupMining1s();

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // 1) Registry
  const OPERATOR = process.env.OPERATOR || deployer.address;
  const Reg = await ethers.getContractFactory("CacRegistry");
  const reg = await Reg.deploy(OPERATOR);
  await reg.waitForDeployment();
  const regAddr = await reg.getAddress();
  console.log("Registry deployed at:", regAddr);

  // 2) CAC (Allowance20) – registry address in constructor
  const Cac = await ethers.getContractFactory("Allowance20");
  const cac = await Cac.deploy(regAddr);
  await cac.waitForDeployment();
  const cacAddr = await cac.getAddress();
  console.log("CAC deployed at:", cacAddr);

  // 3) 7 Marketplace contracts (each needs CAC address)
  const Fixed = await ethers.getContractFactory("FixedMarket");
  const fixed = await Fixed.deploy(cacAddr);
  await fixed.waitForDeployment();
  const fixedAddr = await fixed.getAddress();
  console.log("FixedMarket deployed at:", fixedAddr);

  const OpenAuc = await ethers.getContractFactory("OpenAuctionMarket");
  const openAuc = await OpenAuc.deploy(cacAddr);
  await openAuc.waitForDeployment();
  const openAucAddr = await openAuc.getAddress();
  console.log("OpenAuctionMarket deployed at:", openAucAddr);

  const BuyOrder = await ethers.getContractFactory("BuyOrderMarket");
  const buyOrder = await BuyOrder.deploy(cacAddr);
  await buyOrder.waitForDeployment();
  const buyOrderAddr = await buyOrder.getAddress();
  console.log("BuyOrderMarket deployed at:", buyOrderAddr);

  const Blind = await ethers.getContractFactory("BlindAuctionMarket");
  const blind = await Blind.deploy(cacAddr);
  await blind.waitForDeployment();
  const blindAddr = await blind.getAddress();
  console.log("BlindAuctionMarket deployed at:", blindAddr);

  const Dutch = await ethers.getContractFactory("DutchAuctionMarket");
  const dutch = await Dutch.deploy(cacAddr);
  await dutch.waitForDeployment();
  const dutchAddr = await dutch.getAddress();
  console.log("DutchAuctionMarket deployed at:", dutchAddr);

  const Bundle = await ethers.getContractFactory("BundleSaleMarket");
  const bundle = await Bundle.deploy(cacAddr);
  await bundle.waitForDeployment();
  const bundleAddr = await bundle.getAddress();
  console.log("BundleSaleMarket deployed at:", bundleAddr);

  const Offer = await ethers.getContractFactory("DirectOfferMarket");
  const offer = await Offer.deploy(cacAddr);
  await offer.waitForDeployment();
  const offerAddr = await offer.getAddress();
  console.log("DirectOfferMarket deployed at:", offerAddr);

  // 4) QUOTA_SETTER_ROLE grant (dummy server)
  const { address: serverAddr, pk: serverPk } = resolveDummyWalletFromEnv();
  const QUOTA_ROLE = ethers.keccak256(ethers.toUtf8Bytes("QUOTA_SETTER_ROLE"));

  if (serverAddr) {
    console.log("Resolved dummy server address:", serverAddr);
    await grantRoleIfNeeded(cacAddr, QUOTA_ROLE, serverAddr, deployer);
  } else {
    console.warn(
      "⚠️  Nem adtam QUOTA_SETTER_ROLE-t (nincs SERVER_PK / DUMMY_SERVER_WALLET / DUMMY_SERVER_ADDR)."
    );
  }

  // Optional: also grant deployer for local convenience
  const ALSO_GRANT_DEPLOYER = true;
  if (ALSO_GRANT_DEPLOYER) {
    await grantRoleIfNeeded(cacAddr, QUOTA_ROLE, deployer.address, deployer);
  }

  // 5) Save addresses
  fs.writeFileSync(".addr.registry.local", regAddr);
  fs.writeFileSync(".addr.allowance.local", cacAddr);
  fs.writeFileSync(".addr.market.fixed.local", fixedAddr);
  fs.writeFileSync(".addr.market.openauction.local", openAucAddr);
  fs.writeFileSync(".addr.market.buyorder.local", buyOrderAddr);
  fs.writeFileSync(".addr.market.blind.local", blindAddr);
  fs.writeFileSync(".addr.market.dutch.local", dutchAddr);
  fs.writeFileSync(".addr.market.bundle.local", bundleAddr);
  fs.writeFileSync(".addr.market.offer.local", offerAddr);
  console.log("Saved addresses to .addr.*.local files");

  // ==== FRONTEND .env updates (preserve PINATA_JWT etc.) =====================
  const DAPP_CANDIDATES = [
    path.resolve(__dirname, "..", "..", "dapp"),
    path.resolve(__dirname, "..", "..", "carbon-dapp"),
    path.resolve(__dirname, "..", "dapp"),
  ];
  const dappDir = firstExisting(DAPP_CANDIDATES);

  const dappEnvUpdates = {
    NEXT_PUBLIC_RPC_URL: network.name === "sepolia" ? (process.env.SEPOLIA_RPC_URL || "") : "http://127.0.0.1:8545",
    NEXT_PUBLIC_CHAIN_ID: network.name === "sepolia" ? "11155111" : "31337",
    NEXT_PUBLIC_ALLOWANCE20_ADDRESS: cacAddr,
    NEXT_PUBLIC_REGISTRY_ADDRESS: regAddr,

    // ✅ unified names (what your pages should use)
    NEXT_PUBLIC_MARKET_FIXED_ADDRESS: fixedAddr,
    NEXT_PUBLIC_MARKET_OPEN_AUCTION_ADDRESS: openAucAddr,
    NEXT_PUBLIC_MARKET_BUY_ORDER_ADDRESS: buyOrderAddr,
    NEXT_PUBLIC_MARKET_BLIND_AUCTION_ADDRESS: blindAddr,
    NEXT_PUBLIC_MARKET_DUTCH_ADDRESS: dutchAddr,
    NEXT_PUBLIC_MARKET_BUNDLE_ADDRESS: bundleAddr,
    NEXT_PUBLIC_MARKET_OFFER_ADDRESS: offerAddr,
  };

  if (dappDir) {
    const dappEnvPath = path.join(dappDir, ".env.local");
    const existing = readTextIfExists(dappEnvPath);
    const merged = upsertEnvContent(existing, dappEnvUpdates);
    tryWrite(dappEnvPath, merged, "dapp .env.local");
  } else {
    console.warn("⚠️  Nem találtam dapp mappát. Írd be kézzel ezeket:");
    console.log(dappEnvUpdates);
  }

  // ==== quota-calculator .env updates (preserve other lines) =================
  const QC_CANDIDATES = [
    path.resolve(__dirname, "..", "quota-calculator"),
    path.resolve(__dirname, "..", "..", "quota-calculator"),
  ];
  const qcDir = firstExisting(QC_CANDIDATES);

  const qcUpdates = {
    RPC_URL: network.name === "sepolia" ? (process.env.SEPOLIA_RPC_URL || "") : "http://127.0.0.1:8545",
    CAC_ADDRESS: cacAddr,
    FACTOR_PER_M2: "0.05",
    SERVER_PK: serverPk || "",
  };

  if (qcDir) {
    const qcEnvPath = path.join(qcDir, ".env.local");
    const existing = readTextIfExists(qcEnvPath);
    const merged = upsertEnvContent(existing, qcUpdates);
    tryWrite(qcEnvPath, merged, "quota-calculator .env.local");
  } else {
    console.warn("⚠️  Nem találtam quota-calculator mappát. Írd be kézzel ezeket:");
    console.log(qcUpdates);
  }

  if (!serverPk && !serverAddr) {
    console.log(
      "ℹ️  Adj meg legalább SERVER_PK-t a gyökér .env-ben (vagy DUMMY_SERVER_WALLET-et / DUMMY_SERVER_ADDR-t), majd futtasd újra a deploy-t."
    );
  }

  console.log("\n✅ Deploy OK.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
