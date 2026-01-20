// scripts/transfer-to-mm.js
const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  const CONTRACT = process.env.CONTRACT;
  const MM_ADDRESS = process.env.MM_ADDRESS;

  const [admin, factory] = await ethers.getSigners();
  const token = await (await ethers.getContractFactory("Allowance20")).attach(CONTRACT);

  await token.connect(admin).mint(factory.address, 500);
  await token.connect(factory).transfer(MM_ADDRESS, 200);

  console.log("MM balance:", (await token.balanceOf(MM_ADDRESS)).toString());
}
main().catch(e => { console.error(e); process.exit(1); });
