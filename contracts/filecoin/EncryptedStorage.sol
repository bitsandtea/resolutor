// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AccessControlManager.sol";

contract EncryptedStorage {
    AccessControlManager public accessControl;

    struct EncryptedFile {
        string encryptedCid;
        string metadataCid;
        mapping(address => string) encryptedKeys;
        string agreementId;
        uint256 uploadedAt;
        bool exists;
    }

    mapping(string => EncryptedFile) public files;

    event FileStored(string indexed fileCid, string indexed agreementId);
    event KeyStored(string indexed fileCid, address indexed party);

    constructor(address accessControlAddress) {
        accessControl = AccessControlManager(accessControlAddress);
    }

    function storeEncryptedFile(
        string calldata fileCid,
        string calldata encryptedCid,
        string calldata metadataCid,
        string calldata agreementId
    ) external {
        require(!files[fileCid].exists, "File already exists");

        files[fileCid].encryptedCid = encryptedCid;
        files[fileCid].metadataCid = metadataCid;
        files[fileCid].agreementId = agreementId;
        files[fileCid].uploadedAt = block.timestamp;
        files[fileCid].exists = true;

        emit FileStored(fileCid, agreementId);
    }

    function storeEncryptedKey(
        string calldata fileCid,
        address party,
        string calldata encryptedKey
    ) external {
        require(files[fileCid].exists, "File not found");

        string memory agreementId = files[fileCid].agreementId;
        require(
            accessControl.isAuthorizedParty(agreementId, msg.sender) ||
            msg.sender == party,
            "Not authorized"
        );

        files[fileCid].encryptedKeys[party] = encryptedKey;
        emit KeyStored(fileCid, party);
    }

    function getEncryptedKey(
        string calldata fileCid,
        address requester
    ) external view returns (string memory) {
        require(files[fileCid].exists, "File not found");

        string memory agreementId = files[fileCid].agreementId;
        require(
            accessControl.hasAccess(agreementId, requester),
            "Access denied"
        );

        return files[fileCid].encryptedKeys[requester];
    }

    function getFileInfo(string calldata fileCid)
        external view returns (
            string memory encryptedCid,
            string memory metadataCid,
            string memory agreementId,
            uint256 uploadedAt
        ) {
        require(files[fileCid].exists, "File not found");

        EncryptedFile storage file = files[fileCid];
        return (
            file.encryptedCid,
            file.metadataCid,
            file.agreementId,
            file.uploadedAt
        );
    }

    function hasEncryptedKey(
        string calldata fileCid,
        address party
    ) external view returns (bool) {
        require(files[fileCid].exists, "File not found");
        return bytes(files[fileCid].encryptedKeys[party]).length > 0;
    }

    function updateAccessControlContract(address newAccessControl) external {
        // Simplified: anyone can update for hackathon
        accessControl = AccessControlManager(newAccessControl);
    }
}
