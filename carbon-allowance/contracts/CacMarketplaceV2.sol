// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./Allowance20.sol"; // CAC

contract CacMarketplaceV2 is ReentrancyGuard {
    enum SaleType { Fixed, Auction }
    enum Status { Active, Sold, Cancelled }

    struct Listing {
        uint256 id;
        address seller;
        uint256 amountCAC;
        SaleType saleType;
        Status status;

        uint256 priceWei;    // fixed
        uint256 reserveWei;  // auction
        uint256 buyoutWei;   // auction (0 = none)
        uint64  endTime;     // auction
        address highestBidder;
        uint256 highestBid;
    }

    // ----- BUY REQUESTS (vételi ajánlat) -----
    enum BuyStatus { Active, Filled, Cancelled }
    struct BuyOrder {
        uint256 id;
        address buyer;
        uint256 amountCAC;
        uint256 offerWei;
        BuyStatus status;
    }

    // ----- BLIND AUCTIONS (commit–reveal) -----
    enum BlindStatus { Active, Sold, Cancelled }
    struct BlindAuction {
        uint256 id;
        address seller;
        uint256 amountCAC;
        uint256 reserveWei;
        uint256 buyoutWei;      // optional (0 = none) - itt nem auto-finalize, csak info
        uint64  commitEndTime;
        uint64  revealEndTime;
        BlindStatus status;

        address highestBidder;
        uint256 highestBid;
        uint256 commitCount;
    }

    Allowance20 public immutable CAC;

    // Sell listings (fixed + open auction)
    uint256 public nextId;
    mapping(uint256 => Listing) public listings;

    // Refund pool (open auction + blind + buy order cancel)
    mapping(address => uint256) public pendingRefund;

    // Buy orders
    uint256 public nextBuyId;
    mapping(uint256 => BuyOrder) public buyOrders;

    // Blind auctions
    uint256 public nextBlindId;
    mapping(uint256 => BlindAuction) public blindAuctions;

    // blind per-auction per-user state
    mapping(uint256 => mapping(address => bytes32)) public blindCommitment;
    mapping(uint256 => mapping(address => uint256)) public blindDeposit;
    mapping(uint256 => mapping(address => bool)) public blindRevealed;

    // -------- Events --------
    event ListedFixed(uint256 indexed id, address indexed seller, uint256 amountCAC, uint256 priceWei);
    event ListedAuction(uint256 indexed id, address indexed seller, uint256 amountCAC, uint256 reserveWei, uint256 buyoutWei, uint64 endTime);
    event Bid(uint256 indexed id, address indexed bidder, uint256 amountWei);
    event BuyNow(uint256 indexed id, address indexed buyer, uint256 priceWei);
    event Finalized(uint256 indexed id, address indexed winner, uint256 priceWei);
    event Cancelled(uint256 indexed id);
    event Refunded(address indexed bidder, uint256 amountWei);

    event BuyOrderCreated(uint256 indexed id, address indexed buyer, uint256 amountCAC, uint256 offerWei);
    event BuyOrderFilled(uint256 indexed id, address indexed seller, address indexed buyer, uint256 amountCAC, uint256 offerWei);
    event BuyOrderCancelled(uint256 indexed id);

    event ListedBlind(uint256 indexed id, address indexed seller, uint256 amountCAC, uint256 reserveWei, uint256 buyoutWei, uint64 commitEndTime, uint64 revealEndTime);
    event BlindCommitted(uint256 indexed id, address indexed bidder, bytes32 commitment, uint256 depositWei);
    event BlindRevealed(uint256 indexed id, address indexed bidder, uint256 bidWei);
    event BlindFinalized(uint256 indexed id, address indexed winner, uint256 priceWei);
    event BlindCancelled(uint256 indexed id);
    event UnrevealedRefundPrepared(uint256 indexed id, address indexed bidder, uint256 amountWei);

    constructor(address cac) {
        CAC = Allowance20(cac);
    }

    // =========================
    // Fixed listing
    // =========================
    function listFixed(uint256 amountCAC, uint256 priceWei) external nonReentrant returns (uint256 id) {
        require(amountCAC > 0, "amount=0");
        require(priceWei > 0, "price=0");
        require(CAC.transferFrom(msg.sender, address(this), amountCAC), "transferFrom CAC failed");

        id = nextId++;
        listings[id] = Listing({
            id: id,
            seller: msg.sender,
            amountCAC: amountCAC,
            saleType: SaleType.Fixed,
            status: Status.Active,
            priceWei: priceWei,
            reserveWei: 0,
            buyoutWei: 0,
            endTime: 0,
            highestBidder: address(0),
            highestBid: 0
        });

        emit ListedFixed(id, msg.sender, amountCAC, priceWei);
    }

    // =========================
    // Open auction listing
    // =========================
    function listAuction(uint256 amountCAC, uint256 reserveWei, uint256 buyoutWei, uint64 endTime)
        external nonReentrant returns (uint256 id)
    {
        require(amountCAC > 0, "amount=0");
        require(endTime > block.timestamp + 60, "end too soon");
        if (buyoutWei > 0) require(buyoutWei >= reserveWei, "buyout<reserve");

        require(CAC.transferFrom(msg.sender, address(this), amountCAC), "transferFrom CAC failed");

        id = nextId++;
        listings[id] = Listing({
            id: id,
            seller: msg.sender,
            amountCAC: amountCAC,
            saleType: SaleType.Auction,
            status: Status.Active,
            priceWei: 0,
            reserveWei: reserveWei,
            buyoutWei: buyoutWei,
            endTime: endTime,
            highestBidder: address(0),
            highestBid: 0
        });

        emit ListedAuction(id, msg.sender, amountCAC, reserveWei, buyoutWei, endTime);
    }

    function buy(uint256 id) external payable nonReentrant {
        Listing storage L = listings[id];
        require(L.status == Status.Active, "not active");
        require(L.saleType == SaleType.Fixed, "not fixed");
        require(msg.value == L.priceWei, "bad price");

        L.status = Status.Sold;
        (bool ok, ) = L.seller.call{value: msg.value}("");
        require(ok, "pay seller failed");
        require(CAC.transfer(msg.sender, L.amountCAC), "transfer CAC failed");

        emit BuyNow(id, msg.sender, msg.value);
    }

    function bid(uint256 id) external payable nonReentrant {
        Listing storage L = listings[id];
        require(L.status == Status.Active, "not active");
        require(L.saleType == SaleType.Auction, "not auction");
        require(block.timestamp < L.endTime, "ended");

        uint256 minBid = L.highestBid == 0 ? L.reserveWei : (L.highestBid + ((L.highestBid * 5)/100));
        require(msg.value >= minBid, "bid too low");

        if (L.highestBidder != address(0)) {
            pendingRefund[L.highestBidder] += L.highestBid;
        }
        L.highestBid = msg.value;
        L.highestBidder = msg.sender;

        if (L.buyoutWei > 0 && msg.value >= L.buyoutWei) {
            _finalizeAuction(L);
        } else {
            emit Bid(id, msg.sender, msg.value);
        }
    }

    function finalize(uint256 id) external nonReentrant {
        Listing storage L = listings[id];
        require(L.status == Status.Active, "not active");
        require(L.saleType == SaleType.Auction, "not auction");
        require(block.timestamp >= L.endTime, "not ended");
        require(L.highestBidder != address(0), "no bids");
        _finalizeAuction(L);
    }

    function _finalizeAuction(Listing storage L) internal {
        L.status = Status.Sold;
        (bool ok, ) = L.seller.call{value: L.highestBid}("");
        require(ok, "pay seller failed");
        require(CAC.transfer(L.highestBidder, L.amountCAC), "transfer CAC failed");
        emit Finalized(L.id, L.highestBidder, L.highestBid);
    }

    function cancel(uint256 id) external nonReentrant {
        Listing storage L = listings[id];
        require(L.status == Status.Active, "not active");
        require(L.seller == msg.sender, "not seller");
        if (L.saleType == SaleType.Auction) {
            require(L.highestBidder == address(0), "has bid");
        }
        L.status = Status.Cancelled;
        require(CAC.transfer(L.seller, L.amountCAC), "transfer CAC failed");
        emit Cancelled(id);
    }

    // =========================
    // Buy orders (vételi ajánlat)
    // =========================
    function createBuyOrder(uint256 amountCAC) external payable nonReentrant returns (uint256 id) {
        require(amountCAC > 0, "amount=0");
        require(msg.value > 0, "offer=0");

        id = nextBuyId++;
        buyOrders[id] = BuyOrder({
            id: id,
            buyer: msg.sender,
            amountCAC: amountCAC,
            offerWei: msg.value,
            status: BuyStatus.Active
        });

        emit BuyOrderCreated(id, msg.sender, amountCAC, msg.value);
    }

    function fillBuyOrder(uint256 id) external nonReentrant {
        BuyOrder storage O = buyOrders[id];
        require(O.status == BuyStatus.Active, "not active");

        O.status = BuyStatus.Filled;

        // seller (msg.sender) -> buyer
        require(CAC.transferFrom(msg.sender, O.buyer, O.amountCAC), "transferFrom CAC failed");

        (bool ok, ) = msg.sender.call{value: O.offerWei}("");
        require(ok, "pay seller failed");

        emit BuyOrderFilled(id, msg.sender, O.buyer, O.amountCAC, O.offerWei);
    }

    function cancelBuyOrder(uint256 id) external nonReentrant {
        BuyOrder storage O = buyOrders[id];
        require(O.status == BuyStatus.Active, "not active");
        require(O.buyer == msg.sender, "not buyer");

        O.status = BuyStatus.Cancelled;
        pendingRefund[msg.sender] += O.offerWei;

        emit BuyOrderCancelled(id);
    }

    function getBuyOrder(uint256 id) external view returns (BuyOrder memory) {
        return buyOrders[id];
    }

    // =========================
    // Blind auctions (commit–reveal)
    // =========================
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

        id = nextBlindId++;
        blindAuctions[id] = BlindAuction({
            id: id,
            seller: msg.sender,
            amountCAC: amountCAC,
            reserveWei: reserveWei,
            buyoutWei: buyoutWei,
            commitEndTime: commitEndTime,
            revealEndTime: revealEndTime,
            status: BlindStatus.Active,
            highestBidder: address(0),
            highestBid: 0,
            commitCount: 0
        });

        emit ListedBlind(id, msg.sender, amountCAC, reserveWei, buyoutWei, commitEndTime, revealEndTime);
    }

    function commitBlindBid(uint256 id, bytes32 commitment) external payable nonReentrant {
        BlindAuction storage A = blindAuctions[id];
        require(A.status == BlindStatus.Active, "not active");
        require(block.timestamp < A.commitEndTime, "commit ended");
        require(msg.value > 0, "deposit=0");
        require(blindCommitment[id][msg.sender] == bytes32(0), "already committed");

        blindCommitment[id][msg.sender] = commitment;
        blindDeposit[id][msg.sender] = msg.value;
        A.commitCount += 1;

        emit BlindCommitted(id, msg.sender, commitment, msg.value);
    }

    function revealBlindBid(uint256 id, uint256 bidWei, bytes32 salt) external nonReentrant {
        BlindAuction storage A = blindAuctions[id];
        require(A.status == BlindStatus.Active, "not active");
        require(block.timestamp >= A.commitEndTime, "reveal not started");
        require(block.timestamp < A.revealEndTime, "reveal ended");
        require(!blindRevealed[id][msg.sender], "already revealed");

        bytes32 c = blindCommitment[id][msg.sender];
        require(c != bytes32(0), "no commit");

        // commitment = keccak256(abi.encodePacked(bidWei, salt, bidder))
        bytes32 expected = keccak256(abi.encodePacked(bidWei, salt, msg.sender));
        require(expected == c, "bad reveal");

        uint256 dep = blindDeposit[id][msg.sender];
        require(dep > 0, "no deposit");

        blindRevealed[id][msg.sender] = true;

        // If deposit > bid, refund the rest
        if (dep > bidWei) {
            pendingRefund[msg.sender] += (dep - bidWei);
            blindDeposit[id][msg.sender] = bidWei;
            dep = bidWei;
        }

        // invalid bid (below reserve) -> refund all bid
        if (bidWei < A.reserveWei) {
            pendingRefund[msg.sender] += dep;
            blindDeposit[id][msg.sender] = 0;
            emit BlindRevealed(id, msg.sender, bidWei);
            return;
        }

        // not highest -> refund
        if (bidWei <= A.highestBid) {
            pendingRefund[msg.sender] += dep;
            blindDeposit[id][msg.sender] = 0;
            emit BlindRevealed(id, msg.sender, bidWei);
            return;
        }

        // new highest -> refund previous highest
        address prev = A.highestBidder;
        uint256 prevBid = A.highestBid;
        if (prev != address(0)) {
            pendingRefund[prev] += prevBid;
            blindDeposit[id][prev] = 0;
        }

        A.highestBidder = msg.sender;
        A.highestBid = bidWei;

        emit BlindRevealed(id, msg.sender, bidWei);
    }

    function finalizeBlind(uint256 id) external nonReentrant {
        BlindAuction storage A = blindAuctions[id];
        require(A.status == BlindStatus.Active, "not active");
        require(block.timestamp >= A.revealEndTime, "not ended");
        require(A.highestBidder != address(0), "no winner");

        A.status = BlindStatus.Sold;

        (bool ok, ) = A.seller.call{value: A.highestBid}("");
        require(ok, "pay seller failed");

        require(CAC.transfer(A.highestBidder, A.amountCAC), "transfer CAC failed");

        // winner deposit is consumed; clear it to prevent later "prepare" abuse
        blindDeposit[id][A.highestBidder] = 0;

        emit BlindFinalized(id, A.highestBidder, A.highestBid);
    }

    function cancelBlind(uint256 id) external nonReentrant {
        BlindAuction storage A = blindAuctions[id];
        require(A.status == BlindStatus.Active, "not active");
        require(A.seller == msg.sender, "not seller");

        // only if no one committed yet
        require(A.commitCount == 0, "has commits");

        A.status = BlindStatus.Cancelled;
        require(CAC.transfer(A.seller, A.amountCAC), "transfer CAC failed");
        emit BlindCancelled(id);
    }

    // if someone committed but never revealed, they can prepare refund AFTER reveal end
    function prepareUnrevealedRefund(uint256 id) external nonReentrant {
        BlindAuction storage A = blindAuctions[id];
        require(block.timestamp >= A.revealEndTime, "not ended");

        if (blindCommitment[id][msg.sender] == bytes32(0)) revert("no commit");
        if (blindRevealed[id][msg.sender]) revert("already revealed");

        uint256 dep = blindDeposit[id][msg.sender];
        require(dep > 0, "no deposit");

        blindDeposit[id][msg.sender] = 0;
        blindRevealed[id][msg.sender] = true;
        pendingRefund[msg.sender] += dep;

        emit UnrevealedRefundPrepared(id, msg.sender, dep);
    }

    function getBlindAuction(uint256 id) external view returns (BlindAuction memory) {
        return blindAuctions[id];
    }

    // =========================
    // Refund withdraw (common)
    // =========================
    function withdrawRefund() external nonReentrant {
        uint256 amt = pendingRefund[msg.sender];
        require(amt > 0, "no refund");
        pendingRefund[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: amt}("");
        require(ok, "refund failed");
        emit Refunded(msg.sender, amt);
    }

    // UI helper
    function getListing(uint256 id) external view returns (Listing memory) {
        return listings[id];
    }
}
