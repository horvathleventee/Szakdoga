// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../Allowance20.sol";

contract DirectOfferMarket is ReentrancyGuard {
    Allowance20 public immutable CAC;

    enum Status { Active, Accepted, Cancelled }

    struct Offer {
        uint256 id;
        address buyer;
        address seller;      // fixed seller
        uint256 amountCAC;
        uint256 offerWei;    // escrow ETH
        Status status;
    }

    uint256 public nextId;
    mapping(uint256 => Offer) public offers;
    mapping(address => uint256) public pendingRefund;

    event Created(uint256 indexed id, address indexed buyer, address indexed seller, uint256 amountCAC, uint256 offerWei);
    event Accepted(uint256 indexed id, address indexed buyer, address indexed seller, uint256 amountCAC, uint256 offerWei);
    event Cancelled(uint256 indexed id);
    event Refunded(address indexed user, uint256 amountWei);

    constructor(address cac) { CAC = Allowance20(cac); }

    function createOffer(address seller, uint256 amountCAC) external payable nonReentrant returns (uint256 id) {
        require(seller != address(0), "seller=0");
        require(amountCAC > 0, "amount=0");
        require(msg.value > 0, "offer=0");

        id = nextId++;
        offers[id] = Offer(id, msg.sender, seller, amountCAC, msg.value, Status.Active);
        emit Created(id, msg.sender, seller, amountCAC, msg.value);
    }

    function acceptOffer(uint256 id) external nonReentrant {
        Offer storage O = offers[id];
        require(O.status == Status.Active, "not active");
        require(O.seller == msg.sender, "not seller");

        O.status = Status.Accepted;

        require(CAC.transferFrom(msg.sender, O.buyer, O.amountCAC), "transferFrom CAC failed");

        (bool ok,) = msg.sender.call{value: O.offerWei}("");
        require(ok, "pay seller failed");

        emit Accepted(id, O.buyer, msg.sender, O.amountCAC, O.offerWei);
    }

    function cancelOffer(uint256 id) external nonReentrant {
        Offer storage O = offers[id];
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
