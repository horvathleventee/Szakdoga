// contracts/CacRegistry.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract CacRegistry {
    address public operator; // "admin" / approver

    struct Profile {
        string  displayName;  // pl. "Teszt Kft."
        bytes32 taxIdHash;    // adószám hash
        string  metadataURI;  // ipfs://... JSON (cím, email, stb.)
        string  docsURI;      // ipfs://... (pdf-ek listája vagy egy CAR/PDF)
        bool    kycApproved;  // admin hagyta-e jóvá
        bool    exists;
    }

    mapping(address => Profile) public profiles;

    // ÚJ: elutasítás indoka
    mapping(address => string) public kycNote;

    event Registered(address indexed user, string displayName, bytes32 taxIdHash, string metadataURI);
    event MetadataUpdated(address indexed user, string metadataURI);
    event DocsUpdated(address indexed user, string docsURI);
    event KycApproved(address indexed user, bool approved);

    // ÚJ: egységes döntés event indokkal
    event KycDecision(address indexed user, bool approved, string reason);

    modifier onlyOperator() {
        require(msg.sender == operator, "not operator");
        _;
    }

    constructor(address _operator) {
        operator = _operator;
    }

    function isRegistered(address a) external view returns (bool) {
        return profiles[a].exists;
    }

    // REGISZTRÁCIÓ – 3 paraméter!
    function register(bytes32 taxIdHash, string calldata metadataURI, string calldata displayName) external {
        require(!profiles[msg.sender].exists, "already exists");
        profiles[msg.sender] = Profile({
            displayName: displayName,
            taxIdHash: taxIdHash,
            metadataURI: metadataURI,
            docsURI: "",
            kycApproved: false,
            exists: true
        });
        emit Registered(msg.sender, displayName, taxIdHash, metadataURI);
    }

    function updateMetadata(string calldata metadataURI) external {
        require(profiles[msg.sender].exists, "no profile");
        profiles[msg.sender].metadataURI = metadataURI;
        emit MetadataUpdated(msg.sender, metadataURI);
    }

    function updateDocs(string calldata docsURI) external {
        require(profiles[msg.sender].exists, "no profile");
        profiles[msg.sender].docsURI = docsURI;
        emit DocsUpdated(msg.sender, docsURI);
    }

    // Jóváhagyás – törli az esetleges korábbi indokot
    function approveKyc(address user, bool approved) external onlyOperator {
        require(profiles[user].exists, "no profile");
        profiles[user].kycApproved = approved;
        if (approved && bytes(kycNote[user]).length > 0) {
            delete kycNote[user];
        }
        emit KycApproved(user, approved);
        emit KycDecision(user, approved, approved ? "" : kycNote[user]);
    }

    // ÚJ: explicit reject indokkal (approved=false + note beállítás)
    function rejectKyc(address user, string calldata reason) external onlyOperator {
        require(profiles[user].exists, "no profile");
        profiles[user].kycApproved = false;
        kycNote[user] = reason;
        emit KycApproved(user, false);
        emit KycDecision(user, false, reason);
    }
}
