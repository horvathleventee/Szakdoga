// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../Allowance20.sol";

contract FixedMarket is ReentrancyGuard {
    Allowance20 public immutable CAC;

    enum Status { Active, Sold, Cancelled }

    struct FixedListing {
        uint256 id;
        address seller;
        uint256 amountCAC;
        uint256 priceWei;
        Status status;
    }

    uint256 public nextId;
    mapping(uint256 => FixedListing) public listings;

    // shared refund pool (here mostly unused, but kept consistent)
    mapping(address => uint256) public pendingRefund;

    event Listed(uint256 indexed id, address indexed seller, uint256 amountCAC, uint256 priceWei);
    event Bought(uint256 indexed id, address indexed buyer, uint256 priceWei);
    event Cancelled(uint256 indexed id);
    event Refunded(address indexed user, uint256 amountWei);

    constructor(address cac) { CAC = Allowance20(cac); }

    function listFixed(uint256 amountCAC, uint256 priceWei) external nonReentrant returns (uint256 id) {
        require(amountCAC > 0, "amount=0");
        require(priceWei > 0, "price=0");
        require(CAC.transferFrom(msg.sender, address(this), amountCAC), "transferFrom CAC failed");

        id = nextId++;
        listings[id] = FixedListing(id, msg.sender, amountCAC, priceWei, Status.Active);
        emit Listed(id, msg.sender, amountCAC, priceWei);
    }

    function buy(uint256 id) external payable nonReentrant {
        FixedListing storage L = listings[id];
        require(L.status == Status.Active, "not active");
        require(msg.value == L.priceWei, "bad price");

        L.status = Status.Sold;

        (bool ok1,) = L.seller.call{value: msg.value}("");
        require(ok1, "pay seller failed");

        require(CAC.transfer(msg.sender, L.amountCAC), "transfer CAC failed");

        emit Bought(id, msg.sender, msg.value);
    }

    function cancel(uint256 id) external nonReentrant {
        FixedListing storage L = listings[id];
        require(L.status == Status.Active, "not active");
        require(L.seller == msg.sender, "not seller");

        L.status = Status.Cancelled;
        require(CAC.transfer(L.seller, L.amountCAC), "return CAC failed");
        emit Cancelled(id);
    }

    function withdrawRefund() external nonReentrant {
        uint256 amt = pendingRefund[msg.sender];
        require(amt > 0, "no refund");
        pendingRefund[msg.sender] = 0;
        (bool ok,) = msg.sender.call{value: amt}("");
        require(ok, "refund failed");
        emit Refunded(msg.sender, amt);
    }
}
