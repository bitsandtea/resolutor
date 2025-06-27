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
        address _filecoinStorageManager,
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
            _filecoinStorageManager,
            _filecoinAccessControl
        );

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