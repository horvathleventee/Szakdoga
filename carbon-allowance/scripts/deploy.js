// scripts/deploy.js
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const F = await ethers.getContractFactory("Allowance20");
  const token = await F.deploy();
  await token.waitForDeployment();
  const addr = await token.getAddress();

  console.log("Allowance20 deployed at:", addr);

  // írd fájlba a gyökérbe (pl. .addr.allowance.local)
  const out = path.join(process.cwd(), ".addr.allowance.local");
  fs.writeFileSync(out, addr, "utf8");
  console.log("Saved address to", out);
}

main().catch((e) => { console.error(e); process.exit(1); });
