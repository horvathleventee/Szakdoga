// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../Allowance20.sol";

contract BlindAuctionMarket is ReentrancyGuard {
    Allowance20 public immutable CAC;

    enum Status { Active, Sold, Cancelled }

    struct BlindAuction {
        uint256 id;
        address seller;
        uint256 amountCAC;
        uint256 reserveWei;
        uint256 buyoutWei; // only informational, not auto
        uint64  commitEndTime;
        uint64  revealEndTime;
        Status status;

        address highestBidder;
        uint256 highestBid;
        uint256 commitCount;
    }

    uint256 public nextId;
    mapping(uint256 => BlindAuction) public auctions;

    mapping(address => uint256) public pendingRefund;

    mapping(uint256 => mapping(address => bytes32)) public commitment;
    mapping(uint256 => mapping(address => uint256)) public depositWei;
    mapping(uint256 => mapping(address => bool)) public revealed;

    event Listed(uint256 indexed id, address indexed seller, uint256 amountCAC, uint256 reserveWei, uint256 buyoutWei, uint64 commitEndTime, uint64 revealEndTime);
    event Committed(uint256 indexed id, address indexed bidder, bytes32 commitment, uint256 depositWei);
    event Revealed(uint256 indexed id, address indexed bidder, uint256 bidWei);
    event Finalized(uint256 indexed id, address indexed winner, uint256 priceWei);
    event Cancelled(uint256 indexed id);
    event UnrevealedRefundPrepared(uint256 indexed id, address indexed bidder, uint256 amountWei);
    event Refunded(address indexed user, uint256 amountWei);

    constructor(address cac) { CAC = Allowance20(cac); }

    function listBlindAuction(
        uint256 amountCAC,
        uint256 reserveWei,
        uint256 buyoutWei,
        uint64 commitEndTime,
        uint64 revealEndTime
    ) external nonReentrant returns (uint256 id) {
        require(amountCAC > 0, "amount=0");
        require(commitEndTime > block.timestamp + 60, "commit too soon");
        require(revealEndTime > commitEndTime + 60, "reveal too soon");
        if (buyoutWei > 0) require(buyoutWei >= reserveWei, "buyout<reserve");

        require(CAC.transferFrom(msg.sender, address(this), amountCAC), "transferFrom CAC failed");

        id = nextId++;
        auctions[id] = BlindAuction({
            id: id,
            seller: msg.sender,
            amountCAC: amountCAC,
            reserveWei: reserveWei,
            buyoutWei: buyoutWei,
            commitEndTime: commitEndTime,
            revealEndTime: revealEndTime,
            status: Status.Active,
            highestBidder: address(0),
            highestBid: 0,
            commitCount: 0
        });

        emit Listed(id, msg.sender, amountCAC, reserveWei, buyoutWei, commitEndTime, revealEndTime);
    }

    function commitBid(uint256 id, bytes32 c) external payable nonReentrant {
        BlindAuction storage A = auctions[id];
        require(A.status == Status.Active, "not active");
        require(block.timestamp < A.commitEndTime, "commit ended");
        require(msg.value > 0, "deposit=0");
        require(commitment[id][msg.sender] == bytes32(0), "already committed");

        commitment[id][msg.sender] = c;
        depositWei[id][msg.sender] = msg.value;
        A.commitCount += 1;

        emit Committed(id, msg.sender, c, msg.value);
    }

    function revealBid(uint256 id, uint256 bidWei, bytes32 salt) external nonReentrant {
        BlindAuction storage A = auctions[id];
        require(A.status == Status.Active, "not active");
        require(block.timestamp >= A.commitEndTime, "reveal not started");
        require(block.timestamp < A.revealEndTime, "reveal ended");
        require(!revealed[id][msg.sender], "already revealed");

        bytes32 c = commitment[id][msg.sender];
        require(c != bytes32(0), "no commit");

        bytes32 expected = keccak256(abi.encodePacked(bidWei, salt, msg.sender));
        require(expected == c, "bad reveal");

        uint256 dep = depositWei[id][msg.sender];
        require(dep > 0, "no deposit");
        revealed[id][msg.sender] = true;

        // dep > bid -> refund rest
        if (dep > bidWei) {
            pendingRefund[msg.sender] += (dep - bidWei);
            depositWei[id][msg.sender] = bidWei;
            dep = bidWei;
        }

        // below reserve -> refund all
        if (bidWei < A.reserveWei) {
            pendingRefund[msg.sender] += dep;
            depositWei[id][msg.sender] = 0;
            emit Revealed(id, msg.sender, bidWei);
            return;
        }

        // not highest -> refund
        if (bidWei <= A.highestBid) {
            pendingRefund[msg.sender] += dep;
            depositWei[id][msg.sender] = 0;
            emit Revealed(id, msg.sender, bidWei);
            return;
        }

        // refund previous highest
        address prev = A.highestBidder;
        uint256 prevBid = A.highestBid;
        if (prev != address(0)) {
            pendingRefund[prev] += prevBid;
            depositWei[id][prev] = 0;
        }

        A.highestBidder = msg.sender;
        A.highestBid = bidWei;

        emit Revealed(id, msg.sender, bidWei);
    }

    function finalize(uint256 id) external nonReentrant {
        BlindAuction storage A = auctions[id];
        require(A.status == Status.Active, "not active");
        require(block.timestamp >= A.revealEndTime, "not ended");
        require(A.highestBidder != address(0), "no winner");

        A.status = Status.Sold;

        (bool ok1,) = A.seller.call{value: A.highestBid}("");
        require(ok1, "pay seller failed");

        require(CAC.transfer(A.highestBidder, A.amountCAC), "transfer CAC failed");
        depositWei[id][A.highestBidder] = 0;

        emit Finalized(id, A.highestBidder, A.highestBid);
    }

    function cancel(uint256 id) external nonReentrant {
        BlindAuction storage A = auctions[id];
        require(A.status == Status.Active, "not active");
        require(A.seller == msg.sender, "not seller");
        require(A.commitCount == 0, "has commits");

        A.status = Status.Cancelled;
        require(CAC.transfer(A.seller, A.amountCAC), "return CAC failed");
        emit Cancelled(id);
    }

    function prepareUnrevealedRefund(uint256 id) external nonReentrant {
        BlindAuction storage A = auctions[id];
        require(block.timestamp >= A.revealEndTime, "not ended");

        if (commitment[id][msg.sender] == bytes32(0)) revert("no commit");
        if (revealed[id][msg.sender]) revert("already revealed");

        uint256 dep = depositWei[id][msg.sender];
        require(dep > 0, "no deposit");

        depositWei[id][msg.sender] = 0;
        revealed[id][msg.sender] = true;
        pendingRefund[msg.sender] += dep;

        emit UnrevealedRefundPrepared(id, msg.sender, dep);
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
