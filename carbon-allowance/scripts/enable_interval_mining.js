const { network } = require("hardhat");

async function main() {
  await network.provider.send("evm_setAutomine", [true]);
  await network.provider.send("evm_setIntervalMining", [1000]); // 1000ms = 1s
  console.log("✅ Interval mining set to 1s");
}

main().catch((e) => { console.error(e); process.exit(1); });
