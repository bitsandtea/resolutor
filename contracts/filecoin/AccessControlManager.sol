// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AccessControlManager {
    struct AgreementAccess {
        address partyA;
        address partyB;
        address mediator;
        mapping(address => bool) authorizedViewers;
        mapping(address => uint256) delegationExpiry;
        bool isActive;
        string agreementId;
    }

    mapping(string => AgreementAccess) public agreements;

    event AccessGranted(string indexed agreementId, address indexed partyA);
    event PartyBSet(string indexed agreementId, address indexed partyB);
    event ViewerDelegated(string indexed agreementId, address indexed viewer, uint256 expiry);
    event ViewerRevoked(string indexed agreementId, address indexed viewer);

    function grantAccess(
        string calldata agreementId,
        address partyA,
        address mediator
    ) external {
        require(!agreements[agreementId].isActive, "Access already granted");

        agreements[agreementId].partyA = partyA;
        agreements[agreementId].mediator = mediator;
        agreements[agreementId].agreementId = agreementId;
        agreements[agreementId].isActive = true;

        emit AccessGranted(agreementId, partyA);
    }

    function setPartyB(
        string calldata agreementId,
        address partyB
    ) external {
        require(agreements[agreementId].isActive, "Agreement not active");
        require(agreements[agreementId].partyB == address(0), "Party B already set");

        agreements[agreementId].partyB = partyB;
        emit PartyBSet(agreementId, partyB);
    }

    function delegateViewAccess(
        string calldata agreementId,
        address viewer,
        uint256 durationDays
    ) external {
        require(isAuthorizedParty(agreementId, msg.sender), "Not authorized");
        require(viewer != address(0), "Invalid viewer address");

        uint256 expiry = block.timestamp + (durationDays * 1 days);
        agreements[agreementId].authorizedViewers[viewer] = true;
        agreements[agreementId].delegationExpiry[viewer] = expiry;

        emit ViewerDelegated(agreementId, viewer, expiry);
    }

    function revokeViewAccess(
        string calldata agreementId,
        address viewer
    ) external {
        require(isAuthorizedParty(agreementId, msg.sender), "Not authorized");

        agreements[agreementId].authorizedViewers[viewer] = false;
        agreements[agreementId].delegationExpiry[viewer] = 0;

        emit ViewerRevoked(agreementId, viewer);
    }

    function hasAccess(
        string calldata agreementId,
        address user
    ) external view returns (bool) {
        AgreementAccess storage agreement = agreements[agreementId];

        if (!agreement.isActive) return false;

        // Core parties always have access
        if (user == agreement.partyA ||
            user == agreement.partyB ||
            user == agreement.mediator) {
            return true;
        }

        // Check delegated viewers
        if (agreement.authorizedViewers[user]) {
            uint256 expiry = agreement.delegationExpiry[user];
            return expiry == 0 || block.timestamp < expiry;
        }

        return false;
    }

    function isAuthorizedParty(
        string calldata agreementId,
        address user
    ) public view returns (bool) {
        AgreementAccess storage agreement = agreements[agreementId];
        return user == agreement.partyA ||
               user == agreement.partyB ||
               user == agreement.mediator;
    }

    function getAgreementParties(string calldata agreementId)
        external view returns (address partyA, address partyB, address mediator) {
        AgreementAccess storage agreement = agreements[agreementId];
        return (agreement.partyA, agreement.partyB, agreement.mediator);
    }
}
