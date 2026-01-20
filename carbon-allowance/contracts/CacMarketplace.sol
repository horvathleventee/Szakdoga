// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ICacRegistry {
    function isRegistered(address a) external view returns (bool);
    function profiles(address a) external view returns (
        string memory displayName,
        bytes32 taxIdHash,
        string memory metadataURI,
        bool active
    );
}

/**
 * @title CacMarketplace
 * @notice Egyszerű escrow piactér CAC (ERC-20, decimals=0) kereskedésre.
 * - Csak regisztrált ELADÓ listázhat.
 * - Csak regisztrált VEVŐ vásárolhat.
 * - Listázáskor CAC escrow a szerződésnél.
 * - Buy: ETH → eladó, CAC → vevő.
 */
contract CacMarketplace is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable CAC;
    ICacRegistry public immutable REG;

    struct Listing {
        address seller;
        uint256 amount;     // CAC (egész)
        uint256 priceWei;   // teljes ár wei-ben
        bool active;
    }

    uint256 public nextId;
    mapping(uint256 => Listing) public listings;

    event Listed(
        uint256 indexed id,
        address indexed seller,
        uint256 amount,
        uint256 priceWei
    );

    event Cancelled(
        uint256 indexed id,
        address indexed seller
    );

    // Ezt használja a mini-chart (ReportsChartLite):
    // - id és buyer indexelt
    // - amount, priceWei a görbéhez
    event Purchased(
        uint256 indexed id,
        address indexed buyer,
        uint256 amount,
        uint256 priceWei
    );

    constructor(IERC20 _cac, ICacRegistry _reg) {
        CAC = _cac;
        REG = _reg;
    }

    modifier onlyRegisteredSeller() {
        require(REG.isRegistered(msg.sender), "REG: seller not registered");
        _;
    }

    modifier onlyRegisteredBuyer() {
        require(REG.isRegistered(msg.sender), "REG: buyer not registered");
        _;
    }

    /**
     * @dev Eladó listáz. Előfeltétel: CAC.approve(market, amount).
     */
    function list(uint256 amount, uint256 priceWei)
        external
        onlyRegisteredSeller
        nonReentrant
    {
        require(amount > 0, "amount=0");
        require(priceWei > 0, "price=0");

        CAC.safeTransferFrom(msg.sender, address(this), amount);

        listings[nextId] = Listing({
            seller: msg.sender,
            amount: amount,
            priceWei: priceWei,
            active: true
        });

        emit Listed(nextId, msg.sender, amount, priceWei);
        unchecked { nextId++; }
    }

    /**
     * @dev Csak az eladó törölheti az aktív listát.
     */
    function cancel(uint256 id) external nonReentrant {
        Listing storage L = listings[id];
        require(L.active, "not active");
        require(L.seller == msg.sender, "not seller");

        L.active = false;
        CAC.safeTransfer(L.seller, L.amount);

        emit Cancelled(id, msg.sender);
    }

    /**
     * @dev Regisztrált vevő megveszi az EGÉSZ listinget.
     */
    function buy(uint256 id)
        external
        payable
        nonReentrant
        onlyRegisteredBuyer
    {
        Listing storage L = listings[id];
        require(L.active, "not active");
        require(msg.value == L.priceWei, "bad ETH");

        L.active = false;

        // ETH → eladó
        (bool ok, ) = payable(L.seller).call{value: msg.value}("");
        require(ok, "eth transfer failed");

        // CAC → vevő
        CAC.safeTransfer(msg.sender, L.amount);

        emit Purchased(id, msg.sender, L.amount, L.priceWei);
    }

    receive() external payable {
        revert("direct ETH not allowed");
    }

    fallback() external payable {
        revert("fallback not allowed");
    }

    function getActiveIds(uint256 start, uint256 end)
        external
        view
        returns (uint256[] memory ids)
    {
        if (end > nextId) {
            end = nextId;
        }

        uint256 count;
        for (uint256 i = start; i < end; i++) {
            if (listings[i].active) count++;
        }

        ids = new uint256[](count);
        uint256 idx;
        for (uint256 i = start; i < end; i++) {
            if (listings[i].active) {
                ids[idx++] = i;
            }
        }
    }
}
