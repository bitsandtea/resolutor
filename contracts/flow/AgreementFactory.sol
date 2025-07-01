// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./MultiSigAgreement.sol";

contract AgreementFactory {
    using SafeERC20 for IERC20;
    
    address public immutable implementation;
    address[] public agreements;

    event AgreementCreated(address indexed contractAddr, address indexed partyA);

    constructor() {
        // Deploy the implementation contract
        implementation = address(new MultiSigAgreement());
    }


    function createAgreement(
        address _partyA,
        address _mediator,
        uint256 _depositA,
        uint256 _depositB,
        address _token,
        address _filecoinAccessControl
    ) external returns (address newAgreement) {
        // Create a minimal proxy clone of the implementation
        newAgreement = Clones.clone(implementation);

        // Initialize the new agreement (party B unknown, no deposits taken yet)
        MultiSigAgreement(newAgreement).initialize(
            _partyA,
            _mediator,
            _depositA,
            _depositB,
            _token,
            _filecoinAccessControl
        );

        // Track the new agreement
        agreements.push(newAgreement);

        emit AgreementCreated(newAgreement, _partyA);

        return newAgreement;
    }

    function createAndSignAgreement(
        address _partyA,
        address _partyB,
        address _mediator,
        uint256 _depositA,
        uint256 _depositB,
        address _token,
        address _filecoinAccessControl
    ) external returns (address newAgreement) {
        require(_partyA != address(0), "Invalid partyA address");
        require(_partyA != _mediator, "PartyA cannot be mediator");
        require(msg.sender == _partyA, "Only partyA can create and sign");
        
        // Validate partyB if provided
        if (_partyB != address(0)) {
            require(_partyA != _partyB, "Parties must be different");
            require(_partyB != _mediator, "PartyB cannot be mediator");
        }

        // Create a minimal proxy clone of the implementation
        newAgreement = Clones.clone(implementation);

        // Initialize the new agreement
        MultiSigAgreement(newAgreement).initialize(
            _partyA,
            _mediator,
            _depositA,
            _depositB,
            _token,
            _filecoinAccessControl
        );

        // If partyB is provided, sign with partyB; otherwise partyA signs and partyB joins later
        if (_partyB != address(0)) {
            // Both parties known - sign with partyB immediately
            MultiSigAgreement(newAgreement).signContractWithPartyB(_partyB);
        } else {
            // Only partyA known - partyA signs as themselves, partyB joins later
            MultiSigAgreement(newAgreement).signContract();
        }

        // Track the new agreement
        agreements.push(newAgreement);

        emit AgreementCreated(newAgreement, _partyA);

        return newAgreement;
    }

    function count() external view returns (uint256) {
        return agreements.length;
    }

    function list(uint256 start, uint256 size) external view returns (address[] memory) {
        require(start < agreements.length, "Start index out of bounds");
        
        uint256 end = start + size;
        if (end > agreements.length) {
            end = agreements.length;
        }
        
        address[] memory result = new address[](end - start);
        for (uint256 i = start; i < end; i++) {
            result[i - start] = agreements[i];
        }
        
        return result;
    }

    function getAllAgreements() external view returns (address[] memory) {
        return agreements;
    }
} 