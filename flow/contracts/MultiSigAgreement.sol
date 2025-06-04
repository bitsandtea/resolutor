// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract MultiSigAgreement is ReentrancyGuard, Initializable {
    using SafeERC20 for IERC20;

    enum Status { Pending, Active, Disputed, Resolved }

    struct Proposal {
        uint256 amountToA;
        uint256 amountToB;
        string proposalCid;
        mapping(address => bool) approvals;
        uint8 approvalCount;
    }

    struct AgreementData {
        address partyA;
        address partyB;
        address mediator;
        uint256 depositA;
        uint256 depositB;
        Status status;
        string manifestCid;
        string[] evidenceCids;
    }

    AgreementData public agreement;
    Proposal public currentProp;
    IERC20 public token;
    uint256 public creationTimestamp;
    
    uint256 public constant DEPOSIT_TIMEOUT = 7 days;
    uint256 public constant MAX_DEPOSIT = 1000000 * 10**18; // 1M tokens max

    event AgreementCreated(address indexed contractAddr, address indexed partyA, address indexed partyB);
    event Deposited(address indexed from, uint256 amount);
    event Activated();
    event DisputeOpened(address indexed opener, string evidenceCid);
    event ResolutionProposed(address indexed proposer);
    event ResolutionApproved(address indexed approver);
    event ResolutionExecuted(uint256 amountToA, uint256 amountToB);
    event Refunded();

    modifier onlyParties() {
        require(
            msg.sender == agreement.partyA || 
            msg.sender == agreement.partyB || 
            msg.sender == agreement.mediator,
            "Not authorized"
        );
        _;
    }

    modifier onlyPartyAOrB() {
        require(
            msg.sender == agreement.partyA || msg.sender == agreement.partyB,
            "Only parties can call this"
        );
        _;
    }

    constructor() {
        // Disable initializers for the implementation contract
        _disableInitializers();
    }

    function initialize(
        address _partyA,
        address _partyB,
        address _mediator,
        uint256 _depositA,
        uint256 _depositB,
        address _token,
        string calldata _manifestCid
    ) external initializer {
        require(_partyA != address(0) && _partyB != address(0) && _mediator != address(0), "Invalid addresses");
        require(_partyA != _partyB && _partyA != _mediator && _partyB != _mediator, "Addresses must be unique");
        require(_depositA > 0 && _depositB > 0, "Deposits must be positive");
        require(_depositA <= MAX_DEPOSIT && _depositB <= MAX_DEPOSIT, "Deposit exceeds maximum");
        require(_token != address(0), "Invalid token address");

        agreement.partyA = _partyA;
        agreement.partyB = _partyB;
        agreement.mediator = _mediator;
        agreement.depositA = _depositA;
        agreement.depositB = _depositB;
        agreement.status = Status.Pending;
        agreement.manifestCid = _manifestCid;

        token = IERC20(_token);
        creationTimestamp = block.timestamp;

        // Check if we received both deposits from the factory
        uint256 currentBalance = token.balanceOf(address(this));
        
        if (currentBalance >= _depositA) {
            emit Deposited(_partyA, _depositA);
            
            if (currentBalance >= _depositA + _depositB) {
                // Both deposits received
                emit Deposited(_partyB, _depositB);
                agreement.status = Status.Active;
                emit Activated();
            }
        }

        emit AgreementCreated(address(this), _partyA, _partyB);
    }

    function depositByPartyB() external nonReentrant {
        require(msg.sender == agreement.partyB, "Only party B can call this");
        require(agreement.status == Status.Pending, "Agreement not in pending state");

        token.safeTransferFrom(msg.sender, address(this), agreement.depositB);
        emit Deposited(msg.sender, agreement.depositB);

        agreement.status = Status.Active;
        emit Activated();
    }

    function openDispute(string calldata evidenceCid) external nonReentrant onlyPartyAOrB {
        require(agreement.status == Status.Active, "Agreement must be active");
        
        agreement.status = Status.Disputed;
        agreement.evidenceCids.push(evidenceCid);
        
        emit DisputeOpened(msg.sender, evidenceCid);
    }

    function proposeResolution(
        uint256 amountToA,
        uint256 amountToB,
        string calldata proposalCid
    ) external nonReentrant onlyParties {
        require(agreement.status == Status.Disputed, "Agreement must be disputed");
        require(amountToA + amountToB == agreement.depositA + agreement.depositB, "Amounts must sum to total deposits");

        // Reset current proposal
        currentProp.amountToA = amountToA;
        currentProp.amountToB = amountToB;
        currentProp.proposalCid = proposalCid;
        currentProp.approvalCount = 0;

        // Reset all approvals
        currentProp.approvals[agreement.partyA] = false;
        currentProp.approvals[agreement.partyB] = false;
        currentProp.approvals[agreement.mediator] = false;

        emit ResolutionProposed(msg.sender);
    }

    function approveResolution() external nonReentrant onlyParties {
        require(agreement.status == Status.Disputed, "Agreement must be disputed");
        require(!currentProp.approvals[msg.sender], "Already approved");

        currentProp.approvals[msg.sender] = true;
        currentProp.approvalCount++;

        emit ResolutionApproved(msg.sender);

        // Execute if we have 2 approvals (2-of-3 multisig)
        if (currentProp.approvalCount >= 2) {
            _executeResolution();
        }
    }

    function refundExpired() external nonReentrant {
        require(agreement.status == Status.Pending, "Agreement must be pending");
        require(block.timestamp >= creationTimestamp + DEPOSIT_TIMEOUT, "Timeout not reached");

        agreement.status = Status.Resolved;

        uint256 totalBalance = token.balanceOf(address(this));
        if (totalBalance > 0) {
            // Refund whatever was deposited back to party A
            token.safeTransfer(agreement.partyA, totalBalance);
        }

        emit Refunded();
    }

    function _executeResolution() private {
        agreement.status = Status.Resolved;

        if (currentProp.amountToA > 0) {
            token.safeTransfer(agreement.partyA, currentProp.amountToA);
        }
        if (currentProp.amountToB > 0) {
            token.safeTransfer(agreement.partyB, currentProp.amountToB);
        }

        emit ResolutionExecuted(currentProp.amountToA, currentProp.amountToB);
    }

    function getState() external view returns (
        address partyA,
        address partyB,
        address mediator,
        uint256 depositA,
        uint256 depositB,
        Status status,
        string memory manifestCid,
        string[] memory evidenceCids,
        uint256 propAmountToA,
        uint256 propAmountToB,
        string memory proposalCid,
        uint8 approvalCount
    ) {
        return (
            agreement.partyA,
            agreement.partyB,
            agreement.mediator,
            agreement.depositA,
            agreement.depositB,
            agreement.status,
            agreement.manifestCid,
            agreement.evidenceCids,
            currentProp.amountToA,
            currentProp.amountToB,
            currentProp.proposalCid,
            currentProp.approvalCount
        );
    }
} 