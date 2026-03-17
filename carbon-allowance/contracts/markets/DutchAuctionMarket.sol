// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../Allowance20.sol";

contract DutchAuctionMarket is ReentrancyGuard {
    Allowance20 public immutable CAC;

    enum Status { Active, Sold, Cancelled }

    struct DutchAuction {
        uint256 id;
        address seller;
        uint256 amountCAC;
        uint256 startPriceWei;
        uint256 endPriceWei;
        uint64  startTime;
        uint64  endTime;
        uint64  stepSec;      // price updates in steps (e.g. 60s)
        Status  status;
    }

    uint256 public nextId;
    mapping(uint256 => DutchAuction) public auctions;

    event Listed(
        uint256 indexed id,
        address indexed seller,
        uint256 amountCAC,
        uint256 startPriceWei,
        uint256 endPriceWei,
        uint64 startTime,
        uint64 endTime,
        uint64 stepSec
    );
    event Bought(uint256 indexed id, address indexed buyer, uint256 priceWei);
    event Cancelled(uint256 indexed id);

    constructor(address cac) {
        CAC = Allowance20(cac);
    }

    /**
     * FIX:
     * - startTime/endTime are derived from block.timestamp INSIDE the contract.
     * - durationSec + stepSec are user inputs.
     * - avoids "start in past" + avoids "auction already progressed instantly" due to stale timestamps.
     */
    function listDutch(
        uint256 amountCAC,
        uint256 startPriceWei,
        uint256 endPriceWei,
        uint64 durationSec,
        uint64 stepSec
    ) external nonReentrant returns (uint256 id) {
        require(amountCAC > 0, "amount=0");
        require(startPriceWei > 0, "start=0");
        require(endPriceWei > 0, "end=0");
        require(startPriceWei >= endPriceWei, "start<end");
        require(durationSec >= 120, "too short"); // >=2 min
        if (stepSec == 0) stepSec = 60;
        require(stepSec <= durationSec, "step>duration");

        // small delay so UI doesn't look "already decreasing" immediately after listing
        uint64 startTime = uint64(block.timestamp) + 30;
        uint64 endTime = startTime + durationSec;

        require(CAC.transferFrom(msg.sender, address(this), amountCAC), "transferFrom CAC failed");

        id = nextId++;
        auctions[id] = DutchAuction(
            id,
            msg.sender,
            amountCAC,
            startPriceWei,
            endPriceWei,
            startTime,
            endTime,
            stepSec,
            Status.Active
        );

        emit Listed(id, msg.sender, amountCAC, startPriceWei, endPriceWei, startTime, endTime, stepSec);
    }

    function currentPrice(uint256 id) public view returns (uint256) {
        DutchAuction memory A = auctions[id];
        require(A.status == Status.Active, "not active");

        uint256 nowTs = block.timestamp;

        if (nowTs <= A.startTime) return A.startPriceWei;
        if (nowTs >= A.endTime) return A.endPriceWei;

        uint256 elapsed = nowTs - A.startTime;
        uint256 duration = uint256(A.endTime - A.startTime);

        // Quantize elapsed to steps (e.g. 60s). This prevents “too smooth / too jumpy” behavior.
        if (A.stepSec > 1) {
            elapsed = (elapsed / A.stepSec) * A.stepSec;
        }

        uint256 diff = A.startPriceWei - A.endPriceWei;
        uint256 dec = (diff * elapsed) / duration;

        return A.startPriceWei - dec;
    }

    function buy(uint256 id) external payable nonReentrant {
        DutchAuction storage A = auctions[id];
        require(A.status == Status.Active, "not active");
        require(block.timestamp >= A.startTime, "not started");
        require(block.timestamp <= A.endTime, "ended");

        uint256 price = currentPrice(id);
        require(msg.value == price, "bad price");

        A.status = Status.Sold;

        (bool ok1,) = A.seller.call{value: msg.value}("");
        require(ok1, "pay seller failed");

        require(CAC.transfer(msg.sender, A.amountCAC), "transfer CAC failed");
        emit Bought(id, msg.sender, price);
    }

    function cancel(uint256 id) external nonReentrant {
        DutchAuction storage A = auctions[id];
        require(A.status == Status.Active, "not active");
        require(A.seller == msg.sender, "not seller");

        A.status = Status.Cancelled;
        require(CAC.transfer(A.seller, A.amountCAC), "return CAC failed");
        emit Cancelled(id);
    }
}
