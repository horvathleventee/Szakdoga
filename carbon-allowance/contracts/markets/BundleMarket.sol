// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../Allowance20.sol";

contract BundleSaleMarket is ReentrancyGuard {
    Allowance20 public immutable CAC;

    enum Status { Active, Sold, Cancelled }

    struct BundleListing {
        uint256 id;
        address seller;

        uint256 totalCAC;      // deposited inventory
        uint256 remainingCAC;  // remaining inventory

        uint256[] tierAmountsCAC; // e.g. [10,20,40]
        uint256[] tierPricesWei;  // e.g. [5e18,9e18,16e18]

        Status status;
    }

    uint256 public nextId;
    mapping(uint256 => BundleListing) private _bundles;

    event Listed(uint256 indexed id, address indexed seller, uint256 totalCAC);
    event Bought(
        uint256 indexed id,
        address indexed buyer,
        uint256 indexed tierIndex,
        uint256 amountCAC,
        uint256 priceWei,
        uint256 remainingCAC
    );
    event Cancelled(uint256 indexed id);

    constructor(address cac) { CAC = Allowance20(cac); }

    /**
     * Create a tiered bundle listing.
     * - totalCAC is the inventory you deposit into the contract
     * - tiers define how much a buyer can buy per purchase and at what price
     */
    function listBundle(
        uint256 totalCAC,
        uint256[] calldata tierAmountsCAC,
        uint256[] calldata tierPricesWei
    ) external nonReentrant returns (uint256 id) {
        require(totalCAC > 0, "total=0");
        require(tierAmountsCAC.length > 0, "empty tiers");
        require(tierAmountsCAC.length == tierPricesWei.length, "len mismatch");

        uint256 maxTier = 0;
        for (uint256 i = 0; i < tierAmountsCAC.length; i++) {
            uint256 a = tierAmountsCAC[i];
            uint256 p = tierPricesWei[i];
            require(a > 0, "tier amount=0");
            require(p > 0, "tier price=0");
            if (a > maxTier) maxTier = a;
        }
        require(maxTier <= totalCAC, "tier>total");

        require(CAC.transferFrom(msg.sender, address(this), totalCAC), "transferFrom CAC failed");

        id = nextId++;
        BundleListing storage B = _bundles[id];
        B.id = id;
        B.seller = msg.sender;
        B.totalCAC = totalCAC;
        B.remainingCAC = totalCAC;
        B.status = Status.Active;

        // copy calldata arrays into storage
        B.tierAmountsCAC = tierAmountsCAC;
        B.tierPricesWei = tierPricesWei;

        emit Listed(id, msg.sender, totalCAC);
    }

    /**
     * Minimal info for list pages (cheap).
     */
    function getBundle(uint256 id)
        external
        view
        returns (
            uint256 _id,
            address seller,
            uint256 totalCAC,
            uint256 remainingCAC,
            uint256 tierCount,
            Status status
        )
    {
        BundleListing storage B = _bundles[id];
        return (B.id, B.seller, B.totalCAC, B.remainingCAC, B.tierAmountsCAC.length, B.status);
    }

    /**
     * Read tiers (amounts + prices).
     */
    function getTiers(uint256 id)
        external
        view
        returns (uint256[] memory amountsCAC, uint256[] memory pricesWei)
    {
        BundleListing storage B = _bundles[id];
        return (B.tierAmountsCAC, B.tierPricesWei);
    }

    function buyTier(uint256 id, uint256 tierIndex) external payable nonReentrant {
        BundleListing storage B = _bundles[id];
        require(B.status == Status.Active, "not active");
        require(tierIndex < B.tierAmountsCAC.length, "bad tier");

        uint256 amountCAC = B.tierAmountsCAC[tierIndex];
        uint256 priceWei = B.tierPricesWei[tierIndex];

        require(amountCAC <= B.remainingCAC, "insufficient inventory");
        require(msg.value == priceWei, "bad price");

        // effects
        B.remainingCAC -= amountCAC;
        if (B.remainingCAC == 0) {
            B.status = Status.Sold;
        }

        // interactions
        (bool ok1,) = B.seller.call{value: msg.value}("");
        require(ok1, "pay seller failed");

        require(CAC.transfer(msg.sender, amountCAC), "transfer CAC failed");

        emit Bought(id, msg.sender, tierIndex, amountCAC, priceWei, B.remainingCAC);
    }

    function cancel(uint256 id) external nonReentrant {
        BundleListing storage B = _bundles[id];
        require(B.status == Status.Active, "not active");
        require(B.seller == msg.sender, "not seller");

        B.status = Status.Cancelled;

        uint256 rem = B.remainingCAC;
        B.remainingCAC = 0;

        require(CAC.transfer(B.seller, rem), "return CAC failed");
        emit Cancelled(id);
    }
}
