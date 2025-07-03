// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AccessControl {
    struct Agreement {
        address partyA;
        address partyB;
        address mediator;
        mapping(address => bool) authorizedViewers;
        bool isActive;
        uint256 createdAt;
    }

    struct File {
        string cid;
        string agreementId;
        uint256 uploadedAt;
        bool exists;
    }

    mapping(string => Agreement) public agreements;
    mapping(string => File) public files;

    event AgreementCreated(string indexed agreementId, address indexed partyA);
    event PartyBSet(string indexed agreementId, address indexed partyB);
    event ViewerAdded(string indexed agreementId, address indexed viewer);
    event ViewerRemoved(string indexed agreementId, address indexed viewer);
    event FileStored(string indexed fileCid, string indexed agreementId);

    function createAgreement(
        string calldata agreementId,
        address partyA,
        address mediator
    ) external {
        require(!agreements[agreementId].isActive, "Agreement exists");
        
        Agreement storage agreement = agreements[agreementId];
        agreement.partyA = partyA;
        agreement.mediator = mediator;
        agreement.isActive = true;
        agreement.createdAt = block.timestamp;
        
        emit AgreementCreated(agreementId, partyA);
    }

    function setPartyB(string calldata agreementId, address partyB) external {
        require(agreements[agreementId].isActive, "Agreement not found");
        require(agreements[agreementId].partyB == address(0), "Party B already set");
        
        agreements[agreementId].partyB = partyB;
        emit PartyBSet(agreementId, partyB);
    }

    function addViewer(string calldata agreementId, address viewer) external {
        require(isAuthorizedParty(agreementId, msg.sender), "Not authorized");
        require(viewer != address(0), "Invalid viewer");
        
        agreements[agreementId].authorizedViewers[viewer] = true;
        emit ViewerAdded(agreementId, viewer);
    }

    function removeViewer(string calldata agreementId, address viewer) external {
        require(isAuthorizedParty(agreementId, msg.sender), "Not authorized");
        
        agreements[agreementId].authorizedViewers[viewer] = false;
        emit ViewerRemoved(agreementId, viewer);
    }

    function storeFile(
        string calldata fileCid,
        string calldata agreementId
    ) external {
        require(!files[fileCid].exists, "File exists");
        require(agreements[agreementId].isActive, "Agreement not found");
        
        File storage file = files[fileCid];
        file.cid = fileCid;
        file.agreementId = agreementId;
        file.uploadedAt = block.timestamp;
        file.exists = true;
        
        emit FileStored(fileCid, agreementId);
    }

    function hasAccess(string calldata agreementId, address user) external view returns (bool) {
        Agreement storage agreement = agreements[agreementId];
        
        if (!agreement.isActive) return false;
        
        if (user == agreement.partyA || user == agreement.partyB || user == agreement.mediator) {
            return true;
        }
        
        return agreement.authorizedViewers[user];
    }

    function isAuthorizedParty(string calldata agreementId, address user) public view returns (bool) {
        Agreement storage agreement = agreements[agreementId];
        return user == agreement.partyA || user == agreement.partyB || user == agreement.mediator;
    }

    function getAgreement(string calldata agreementId) external view returns (
        address partyA,
        address partyB,
        address mediator,
        uint256 createdAt
    ) {
        Agreement storage agreement = agreements[agreementId];
        return (
            agreement.partyA,
            agreement.partyB,
            agreement.mediator,
            agreement.createdAt
        );
    }

    function getFile(string calldata fileCid) external view returns (
        string memory cid,
        string memory agreementId,
        uint256 uploadedAt
    ) {
        require(files[fileCid].exists, "File not found");
        File storage file = files[fileCid];
        return (file.cid, file.agreementId, file.uploadedAt);
    }

    function createAgreementWithFile(
        string calldata agreementId,
        address partyA,
        address mediator,
        string calldata fileCid
    ) external {
        require(!agreements[agreementId].isActive, "Agreement exists");
        require(!files[fileCid].exists, "File exists");
        
        // Create agreement
        Agreement storage agreement = agreements[agreementId];
        agreement.partyA = partyA;
        agreement.mediator = mediator;
        agreement.isActive = true;
        agreement.createdAt = block.timestamp;
        
        // Store file
        File storage file = files[fileCid];
        file.cid = fileCid;
        file.agreementId = agreementId;
        file.uploadedAt = block.timestamp;
        file.exists = true;
        
        emit AgreementCreated(agreementId, partyA);
        emit FileStored(fileCid, agreementId);
    }
} 