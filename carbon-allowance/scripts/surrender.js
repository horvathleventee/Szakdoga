require("dotenv").config();
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  // beolvassuk a contract címet a fájlból
  const addrFile = path.join(process.cwd(), ".addr.allowance.local");
  if (!fs.existsSync(addrFile)) {
    throw new Error(".addr.allowance.local nem található. Előbb futtasd le a deployt!");
  }
  const CONTRACT = fs.readFileSync(addrFile, "utf8").trim();

  // csatlakozunk a szerződéshez
  const token = await (await ethers.getContractFactory("Allowance20")).attach(CONTRACT);

  // két alap signer a hardhat node-ból:
  const [admin, factory] = await ethers.getSigners();

  console.log("Contract address:", CONTRACT);
  console.log("Admin address:", admin.address);
  console.log("Factory address:", factory.address);

  // 1) Adjunk factory-nak kreditet
  console.log("Minting 1000 CAC to factory...");
  await token.connect(admin).mint(factory.address, 1000);

  let balBefore = await token.balanceOf(factory.address);
  console.log("Factory balance before surrender:", balBefore.toString()); // várható: 1000

  // 2) Factory surrender-el 250 CAC-et
  console.log("Factory surrender 250 CAC...");
  const tx = await token.connect(factory).surrender(
    250,                // amount
    2025,               // periodId pl év
    "ipfs://cidProof",  // evidenceURI (itt lehetne IPFS URI)
    ethers.ZeroHash     // vcHash (itt még csak 0-k)
  );
  await tx.wait();

  const balAfter = await token.balanceOf(factory.address);
  console.log("Factory balance after surrender:", balAfter.toString()); // várható: 750
}

main().catch((e) => { console.error(e); process.exit(1); });
