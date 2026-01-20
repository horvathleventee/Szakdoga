// node scripts/set_registry.js
require('dotenv').config();
const { ethers } = require("hardhat");

async function main() {
  const cacAddr = process.env.NEXT_PUBLIC_ALLOWANCE20_ADDRESS;
  const regAddr = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS;
  if (!cacAddr || !regAddr) throw new Error("Hiányzó env: NEXT_PUBLIC_ALLOWANCE20_ADDRESS / NEXT_PUBLIC_REGISTRY_ADDRESS");

  const [signer] = await ethers.getSigners(); // deployer / admin
  console.log("Using signer:", signer.address);

  const CAC = await ethers.getContractAt("Allowance20", cacAddr);
  const before = await CAC.REG();
  console.log("REG before:", before);

  const tx = await CAC.setRegistry(regAddr);
  await tx.wait();
  const after = await CAC.REG();
  console.log("REG after:", after);
}

main().catch(e => { console.error(e); process.exit(1); });
