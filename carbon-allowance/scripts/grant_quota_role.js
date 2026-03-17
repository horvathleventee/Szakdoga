require("dotenv").config();
const hre = require("hardhat");

async function main() {
  const { ethers } = hre;

  const cacAddr = process.env.CAC_ADDRESS || process.env.NEXT_PUBLIC_ALLOWANCE20_ADDRESS;
  const serverAddr = process.env.SERVER_ADDRESS;

  if (!cacAddr) {
    throw new Error("Missing CAC_ADDRESS or NEXT_PUBLIC_ALLOWANCE20_ADDRESS in env.");
  }
  if (!serverAddr) {
    throw new Error("Missing SERVER_ADDRESS in env.");
  }
  if (!ethers.isAddress(serverAddr)) {
    throw new Error(`Invalid SERVER_ADDRESS: ${serverAddr}`);
  }

  const [signer] = await ethers.getSigners();
  console.log("Admin signer:", signer.address);
  console.log("CAC:", cacAddr);
  console.log("Granting QUOTA_SETTER_ROLE to:", serverAddr);

  const cac = await ethers.getContractAt("Allowance20", cacAddr, signer);
  const role = ethers.keccak256(ethers.toUtf8Bytes("QUOTA_SETTER_ROLE"));

  const hasRole = await cac.hasRole(role, serverAddr);
  if (hasRole) {
    console.log("Role already granted.");
    return;
  }

  const tx = await cac.grantRole(role, serverAddr);
  console.log("Tx sent:", tx.hash);
  await tx.wait();

  console.log("Role granted successfully.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
