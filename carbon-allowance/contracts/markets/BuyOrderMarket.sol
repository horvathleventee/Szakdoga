// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../Allowance20.sol";

contract BuyOrderMarket is ReentrancyGuard {
    Allowance20 public immutable CAC;

    enum Status { Active, Filled, Cancelled }

    struct BuyOrder {
        uint256 id;
        address buyer;
        uint256 amountCAC;
        uint256 offerWei;
        Status status;
    }

    uint256 public nextId;
    mapping(uint256 => BuyOrder) public orders;

    mapping(address => uint256) public pendingRefund;

    event Created(uint256 indexed id, address indexed buyer, uint256 amountCAC, uint256 offerWei);
    event Filled(uint256 indexed id, address indexed seller, address indexed buyer, uint256 amountCAC, uint256 offerWei);
    event Cancelled(uint256 indexed id);
    event Refunded(address indexed user, uint256 amountWei);

    constructor(address cac) { CAC = Allowance20(cac); }

    function createBuyOrder(uint256 amountCAC) external payable nonReentrant returns (uint256 id) {
        require(amountCAC > 0, "amount=0");
        require(msg.value > 0, "offer=0");

        id = nextId++;
        orders[id] = BuyOrder(id, msg.sender, amountCAC, msg.value, Status.Active);
        emit Created(id, msg.sender, amountCAC, msg.value);
    }

    function fillBuyOrder(uint256 id) external nonReentrant {
        BuyOrder storage O = orders[id];
        require(O.status == Status.Active, "not active");

        O.status = Status.Filled;

        require(CAC.transferFrom(msg.sender, O.buyer, O.amountCAC), "transferFrom CAC failed");
        (bool ok,) = msg.sender.call{value: O.offerWei}("");
        require(ok, "pay seller failed");

        emit Filled(id, msg.sender, O.buyer, O.amountCAC, O.offerWei);
    }

    function cancelBuyOrder(uint256 id) external nonReentrant {
        BuyOrder storage O = orders[id];
        require(O.status == Status.Active, "not active");
        require(O.buyer == msg.sender, "not buyer");

        O.status = Status.Cancelled;
        pendingRefund[msg.sender] += O.offerWei;

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
