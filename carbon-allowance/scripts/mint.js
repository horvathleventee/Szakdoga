// scripts/mint.js
require("dotenv").config();
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const MM_ADDRESS = process.env.MM_ADDRESS;
  if (!MM_ADDRESS) throw new Error("MM_ADDRESS hiányzik a .env-ből");

  // olvasd be a deploy címét
  const addrFile = path.join(process.cwd(), ".addr.allowance.local");
  if (!fs.existsSync(addrFile)) {
    throw new Error(".addr.allowance.local nem található. Futtasd előbb a deployt!");
  }
  const CONTRACT = fs.readFileSync(addrFile, "utf8").trim();

  const [admin] = await ethers.getSigners();
  const token = await (await ethers.getContractFactory("Allowance20")).attach(CONTRACT);

  console.log("Contract:", CONTRACT);
  console.log("Minting to:", MM_ADDRESS);

  // mint 1000 EUA a MetaMask címedre
  const tx = await token.connect(admin).mint(MM_ADDRESS, 1000);
  await tx.wait();

  const bal = await token.balanceOf(MM_ADDRESS);
  console.log("MM balance after mint:", bal.toString());
}

main().catch((e) => { console.error(e); process.exit(1); });
