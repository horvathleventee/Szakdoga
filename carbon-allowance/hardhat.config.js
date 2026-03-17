require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const sepoliaRpcUrl = process.env.SEPOLIA_RPC_URL || "";
const privateKey = process.env.PRIVATE_KEY || "";
const sepoliaAccounts = privateKey ? [privateKey] : [];

module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 50 },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    local8546: {
      url: "http://127.0.0.1:8546",
      chainId: 31337,
    },
    sepolia: {
      url: sepoliaRpcUrl,
      chainId: 11155111,
      accounts: sepoliaAccounts,
    },
  },
};
