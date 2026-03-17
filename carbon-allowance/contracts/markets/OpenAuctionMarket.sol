// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../Allowance20.sol";

contract OpenAuctionMarket is ReentrancyGuard {
    Allowance20 public immutable CAC;

    enum Status { Active, Sold, Cancelled }

    struct Auction {
        uint256 id;
        address seller;
        uint256 amountCAC;
        uint256 reserveWei;
        uint256 buyoutWei; // 0 = none
        uint64 endTime;
        Status status;

        address highestBidder;
        uint256 highestBid;
    }

    uint256 public nextId;
    mapping(uint256 => Auction) public auctions;

    mapping(address => uint256) public pendingRefund;

    event Listed(uint256 indexed id, address indexed seller, uint256 amountCAC, uint256 reserveWei, uint256 buyoutWei, uint64 endTime);
    event BidPlaced(uint256 indexed id, address indexed bidder, uint256 bidWei);
    event Finalized(uint256 indexed id, address indexed winner, uint256 priceWei);
    event Cancelled(uint256 indexed id);
    event Refunded(address indexed user, uint256 amountWei);

    constructor(address cac) { CAC = Allowance20(cac); }

    function listAuction(uint256 amountCAC, uint256 reserveWei, uint256 buyoutWei, uint64 endTime)
        external nonReentrant returns (uint256 id)
    {
        require(amountCAC > 0, "amount=0");
        require(endTime > block.timestamp + 60, "end too soon");
        if (buyoutWei > 0) require(buyoutWei >= reserveWei, "buyout<reserve");

        require(CAC.transferFrom(msg.sender, address(this), amountCAC), "transferFrom CAC failed");

        id = nextId++;
        auctions[id] = Auction({
            id: id,
            seller: msg.sender,
            amountCAC: amountCAC,
            reserveWei: reserveWei,
            buyoutWei: buyoutWei,
            endTime: endTime,
            status: Status.Active,
            highestBidder: address(0),
            highestBid: 0
        });

        emit Listed(id, msg.sender, amountCAC, reserveWei, buyoutWei, endTime);
    }

    function bid(uint256 id) external payable nonReentrant {
        Auction storage A = auctions[id];
        require(A.status == Status.Active, "not active");
        require(block.timestamp < A.endTime, "ended");

        uint256 minBid = A.highestBid == 0 ? A.reserveWei : (A.highestBid + ((A.highestBid * 5)/100));
        require(msg.value >= minBid, "bid too low");

        if (A.highestBidder != address(0)) {
            pendingRefund[A.highestBidder] += A.highestBid;
        }

        A.highestBidder = msg.sender;
        A.highestBid = msg.value;

        if (A.buyoutWei > 0 && msg.value >= A.buyoutWei) {
            _finalize(A);
        } else {
            emit BidPlaced(id, msg.sender, msg.value);
        }
    }

    function finalize(uint256 id) external nonReentrant {
        Auction storage A = auctions[id];
        require(A.status == Status.Active, "not active");
        require(block.timestamp >= A.endTime, "not ended");
        require(A.highestBidder != address(0), "no bids");
        _finalize(A);
    }

    function _finalize(Auction storage A) internal {
        A.status = Status.Sold;

        (bool ok1,) = A.seller.call{value: A.highestBid}("");
        require(ok1, "pay seller failed");

        require(CAC.transfer(A.highestBidder, A.amountCAC), "transfer CAC failed");
        emit Finalized(A.id, A.highestBidder, A.highestBid);
    }

    function cancel(uint256 id) external nonReentrant {
        Auction storage A = auctions[id];
        require(A.status == Status.Active, "not active");
        require(A.seller == msg.sender, "not seller");
        require(A.highestBidder == address(0), "has bid");

        A.status = Status.Cancelled;
        require(CAC.transfer(A.seller, A.amountCAC), "return CAC failed");
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
