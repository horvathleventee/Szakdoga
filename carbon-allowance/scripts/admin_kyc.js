const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const { registry } = JSON.parse(fs.readFileSync(path.join(__dirname, "addresses.json"), "utf8"));
  const [admin] = await ethers.getSigners();

  const REG = await ethers.getContractAt("CacRegistry", registry, admin);

  // IDE ÍRD a jóváhagyandó címet:
  const who = process.env.KYC_ADDR || "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199";

  const tx = await REG.approveKyc(who, true);
  await tx.wait();
  console.log("KYC approved for:", who);
}

main().catch(e => { console.error(e); process.exit(1); });
