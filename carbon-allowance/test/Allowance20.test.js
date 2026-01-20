// test/Allowance20.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Allowance20", () => {
  it("mint + surrender works", async () => {
    const [admin, factory] = await ethers.getSigners();
    const F = await ethers.getContractFactory("Allowance20");
    const token = await F.deploy();
    await token.waitForDeployment();

    await token.connect(admin).mint(factory.address, 1000);
    expect(await token.balanceOf(factory.address)).to.equal(1000n);

    await token.connect(factory).surrender(250, 2025, "ipfs://cid", ethers.ZeroHash);
    expect(await token.balanceOf(factory.address)).to.equal(750n);
  });
});
