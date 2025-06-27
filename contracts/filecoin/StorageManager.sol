// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract StorageManager {
    struct StorageManifest {
        string contractMd;
        string contractPdf;
        string[] evidenceCids;
        string aiRationaleCid;
        uint256 version;
        string status;
        address flowContractAddr;
        uint256 createdAt;
        uint256 updatedAt;
    }

    struct AgreementStorage {
        StorageManifest current;
        mapping(uint256 => StorageManifest) versions;
        uint256 latestVersion;
        address accessControlContract;
        bool exists;
    }

    mapping(string => AgreementStorage) public agreements;

    event AgreementStorageCreated(string indexed agreementId, address indexed flowContract);
    event StorageUpdated(string indexed agreementId, uint256 version, string status);
    event AccessControlSet(string indexed agreementId, address accessContract);

    function createAgreementStorage(
        string calldata agreementId,
        address flowContractAddr,
        string calldata initialCid,
        address accessControlContract
    ) external {
        require(!agreements[agreementId].exists, "Agreement already exists");

        StorageManifest memory initialManifest = StorageManifest({
            contractMd: initialCid,
            contractPdf: "",
            evidenceCids: new string[](0),
            aiRationaleCid: "",
            version: 1,
            status: "unsigned",
            flowContractAddr: flowContractAddr,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });

        agreements[agreementId].current = initialManifest;
        agreements[agreementId].versions[1] = initialManifest;
        agreements[agreementId].latestVersion = 1;
        agreements[agreementId].accessControlContract = accessControlContract;
        agreements[agreementId].exists = true;

        emit AgreementStorageCreated(agreementId, flowContractAddr);
        emit AccessControlSet(agreementId, accessControlContract);
    }

    function updateContractSigned(
        string calldata agreementId,
        string calldata signedCid,
        string calldata pdfCid
    ) external {
        require(agreements[agreementId].exists, "Agreement not found");

        uint256 newVersion = agreements[agreementId].latestVersion + 1;

        StorageManifest memory newManifest = agreements[agreementId].current;
        newManifest.contractMd = signedCid;
        newManifest.contractPdf = pdfCid;
        newManifest.version = newVersion;
        newManifest.status = "signed";
        newManifest.updatedAt = block.timestamp;

        agreements[agreementId].current = newManifest;
        agreements[agreementId].versions[newVersion] = newManifest;
        agreements[agreementId].latestVersion = newVersion;

        emit StorageUpdated(agreementId, newVersion, "signed");
    }

    function addEvidence(
        string calldata agreementId,
        string calldata evidenceCid
    ) external {
        require(agreements[agreementId].exists, "Agreement not found");

        agreements[agreementId].current.evidenceCids.push(evidenceCid);
        agreements[agreementId].current.updatedAt = block.timestamp;

        uint256 currentVersion = agreements[agreementId].latestVersion;
        agreements[agreementId].versions[currentVersion] = agreements[agreementId].current;
    }

    function setAiRationale(
        string calldata agreementId,
        string calldata aiCid
    ) external {
        require(agreements[agreementId].exists, "Agreement not found");

        agreements[agreementId].current.aiRationaleCid = aiCid;
        agreements[agreementId].current.updatedAt = block.timestamp;

        uint256 currentVersion = agreements[agreementId].latestVersion;
        agreements[agreementId].versions[currentVersion] = agreements[agreementId].current;
    }

    function updateStatus(
        string calldata agreementId,
        string calldata newStatus
    ) external {
        require(agreements[agreementId].exists, "Agreement not found");

        agreements[agreementId].current.status = newStatus;
        agreements[agreementId].current.updatedAt = block.timestamp;

        uint256 currentVersion = agreements[agreementId].latestVersion;
        agreements[agreementId].versions[currentVersion] = agreements[agreementId].current;

        emit StorageUpdated(agreementId, currentVersion, newStatus);
    }

    function getManifest(string calldata agreementId)
        external view returns (StorageManifest memory) {
        require(agreements[agreementId].exists, "Agreement not found");
        return agreements[agreementId].current;
    }

    function getVersionedManifest(string calldata agreementId, uint256 version)
        external view returns (StorageManifest memory) {
        require(agreements[agreementId].exists, "Agreement not found");
        require(version <= agreements[agreementId].latestVersion, "Version not found");
        return agreements[agreementId].versions[version];
    }

    function getAccessControlContract(string calldata agreementId)
        external view returns (address) {
        require(agreements[agreementId].exists, "Agreement not found");
        return agreements[agreementId].accessControlContract;
    }

    function getEvidenceCount(string calldata agreementId)
        external view returns (uint256) {
        require(agreements[agreementId].exists, "Agreement not found");
        return agreements[agreementId].current.evidenceCids.length;
    }

    function getEvidence(string calldata agreementId, uint256 index)
        external view returns (string memory) {
        require(agreements[agreementId].exists, "Agreement not found");
        require(index < agreements[agreementId].current.evidenceCids.length, "Evidence not found");
        return agreements[agreementId].current.evidenceCids[index];
    }
}
