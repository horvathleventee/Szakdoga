// scripts/deploy_all.js
const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // 1) Registry – OPERATOR kiosztása
  const OPERATOR = process.env.OPERATOR || deployer.address;
  const Reg = await ethers.getContractFactory("CacRegistry");
  const reg = await Reg.deploy(OPERATOR);
  await reg.waitForDeployment();
  const regAddr = await reg.getAddress();
  console.log("Registry deployed at:", regAddr);

  // 2) CAC (Allowance20) – most már a registry cím kell a konstruktorba!
  const Cac = await ethers.getContractFactory("Allowance20");
  const cac = await Cac.deploy(regAddr);
  await cac.waitForDeployment();
  const cacAddr = await cac.getAddress();
  console.log("CAC deployed at:", cacAddr);

  // 3) Marketplace (változatlan)
  const Mkt = await ethers.getContractFactory("CacMarketplace");
  const mkt = await Mkt.deploy(cacAddr, regAddr);
  await mkt.waitForDeployment();
  const mktAddr = await mkt.getAddress();
  console.log("Marketplace deployed at:", mktAddr);

  // címek elmentése (frontend sync)
  fs.writeFileSync(".addr.allowance.local", cacAddr);
  fs.writeFileSync(".addr.registry.local", regAddr);
  fs.writeFileSync(".addr.market.local", mktAddr);
  console.log("Saved addresses to .addr.*.local files");
}

main().catch((e) => { console.error(e); process.exit(1); });
