// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

interface ICacRegistry {
    function isRegistered(address a) external view returns (bool);
    function profiles(address a) external view returns (
        string memory, bytes32, string memory, string memory, bool, bool
    );
}

contract Allowance20 is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE         = keccak256("MINTER_ROLE");
    bytes32 public constant QUOTA_SETTER_ROLE   = keccak256("QUOTA_SETTER_ROLE");

    ICacRegistry public immutable REG;

    // kvóta: ennyit mintelHET még a felhasználó a dummy oldal által jóváhagyott keretből
    mapping(address => uint256) public remainingQuota;

    event QuotaSet(address indexed user, uint256 quota, address indexed setter);

    // 1 CAC = 1 tCO2e (egész tokenek)
    function decimals() public pure override returns (uint8) { return 0; }

    event Surrendered(address indexed factory, uint256 amount, uint16 periodId, string evidenceURI, bytes32 vcHash);
    event SurrenderLogged(
        address indexed user, uint256 amount, uint16 periodId, uint256 timestamp,
        string displayName, bytes32 taxIdHash, string metadataURI, string docsURI
    );

    constructor(address _registry) ERC20("Carbon Allowance Credit", "CAC") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(QUOTA_SETTER_ROLE, msg.sender); // default: deployer kvótaállító
        REG = ICacRegistry(_registry);
    }

    // ————————————————————————
    //  A DUMMY WEB EZT hívja
    // ————————————————————————
    function setMintQuota(address user, uint256 quota) external onlyRole(QUOTA_SETTER_ROLE) {
        remainingQuota[user] = quota;
        emit QuotaSet(user, quota, msg.sender);
    }

    // dApp ezt hívja minteléskor (NEM enged többet, mint a kvóta)
    function mintFromQuota(uint256 amount) external {
        require(amount > 0, "amount=0");
        require(remainingQuota[msg.sender] >= amount, "quota exceeded");
        remainingQuota[msg.sender] -= amount;
        _mint(msg.sender, amount);
    }

    // — meglévő részek változatlanul maradnak —
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    function surrender(uint256 amount, uint16 periodId, string calldata evidenceURI, bytes32 vcHash) external {
        (, bytes32 taxIdHash, string memory metadataURI, string memory docsURI, bool kycApproved, bool exists)
            = REG.profiles(msg.sender);

        require(exists, "REG: not registered");
        require(kycApproved, "REG: KYC not approved");
        require(amount > 0, "amount=0");

        _burn(msg.sender, amount);

        emit Surrendered(msg.sender, amount, periodId, evidenceURI, vcHash);

        (string memory displayName, , , , , ) = REG.profiles(msg.sender);
        emit SurrenderLogged(
            msg.sender, amount, periodId, block.timestamp,
            displayName, taxIdHash, metadataURI, docsURI
        );
    }

    event Burned(address indexed from, uint256 amount);
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
        emit Burned(msg.sender, amount);
    }
}
