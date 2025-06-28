// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract MultiSigAgreement is ReentrancyGuard, Initializable {
    using SafeERC20 for IERC20;

    enum Status { 
        Created,        // 0 - Contract created, party B unknown
        Signed,         // 1 - Party B has signed, both parties known
        PartialDeposit, // 2 - One party has given allowance/deposit
        FullDeposit,    // 3 - Both parties have allowances, deposits can be taken
        Active,         // 4 - Deposits taken, agreement active
        Disputed,       // 5 - Dispute opened
        Resolved        // 6 - Final resolution executed
    }

    struct Proposal {
        uint256 amountToA;
        uint256 amountToB;
        uint8 approvalCount;
        mapping(address => bool) approvals;
    }

    struct AgreementData {
        address partyA;
        address partyB;  // Can be address(0) initially
        address mediator;
        uint256 depositA;
        uint256 depositB;
        Status status;
        address filecoinAccessControl;   // Reference to Filecoin AccessControl
        bool partyAApproved;
        bool partyBApproved;
    }

    AgreementData public agreement;
    Proposal public currentProp;
    IERC20 public token;
    uint256 public creationTimestamp;
    
    uint256 public constant DEPOSIT_TIMEOUT = 7 days;
    uint256 public constant MAX_DEPOSIT = 1000000 * 10**18; // 1M tokens max

    event AgreementCreated(address indexed contractAddr, address indexed partyA);
    event ContractSigned(address indexed partyB);
    event PartyApproved(address indexed party);
    event DepositsReady();
    event DepositsTaken(uint256 amountA, uint256 amountB);
    event Activated();
    event DisputeOpened(address indexed opener);
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

    modifier onlyWhenSigned() {
        require(agreement.partyB != address(0), "Contract not signed yet");
        _;
    }

    constructor() {
        // Disable initializers for the implementation contract
        _disableInitializers();
    }

    function initialize(
        address _partyA,
        address _mediator,
        uint256 _depositA,
        uint256 _depositB,
        address _token,
        address _filecoinAccessControl
    ) external initializer {
        require(_partyA != address(0) && _mediator != address(0), "Invalid addresses");
        require(_partyA != _mediator, "Party A and mediator must be different");
        require(_depositA <= MAX_DEPOSIT && _depositB <= MAX_DEPOSIT, "Deposit exceeds maximum");
        require(_token != address(0), "Invalid token address");
        require(_filecoinAccessControl != address(0), "Invalid access control address");

        agreement.partyA = _partyA;
        agreement.partyB = address(0);  // Unknown initially
        agreement.mediator = _mediator;
        agreement.depositA = _depositA;
        agreement.depositB = _depositB;
        agreement.status = Status.Created;
        agreement.filecoinAccessControl = _filecoinAccessControl;
        agreement.partyAApproved = false;
        agreement.partyBApproved = false;

        token = IERC20(_token);
        creationTimestamp = block.timestamp;

        emit AgreementCreated(address(this), _partyA);
    }

    function signContract() external nonReentrant {
        require(agreement.status == Status.Created, "Contract already signed or invalid status");
        require(agreement.partyB == address(0), "Party B already set");
        require(msg.sender != agreement.partyA && msg.sender != agreement.mediator, "Party A or mediator cannot be party B");

        agreement.partyB = msg.sender;
        agreement.status = Status.Signed;

        emit ContractSigned(msg.sender);
    }

    function approveDeposit() external nonReentrant onlyPartyAOrB onlyWhenSigned {
        require(agreement.status == Status.Signed || agreement.status == Status.PartialDeposit, "Invalid status for approval");
        
        if (msg.sender == agreement.partyA) {
            require(!agreement.partyAApproved, "Party A already approved");
            require(token.allowance(agreement.partyA, address(this)) >= agreement.depositA, "Insufficient allowance from party A");
            agreement.partyAApproved = true;
            emit PartyApproved(agreement.partyA);
        } else if (msg.sender == agreement.partyB) {
            require(!agreement.partyBApproved, "Party B already approved");
            require(token.allowance(agreement.partyB, address(this)) >= agreement.depositB, "Insufficient allowance from party B");
            agreement.partyBApproved = true;
            emit PartyApproved(agreement.partyB);
        }

        // Update status based on approvals
        if (agreement.partyAApproved && agreement.partyBApproved) {
            agreement.status = Status.FullDeposit;
            emit DepositsReady();
        } else if (agreement.partyAApproved || agreement.partyBApproved) {
            agreement.status = Status.PartialDeposit;
        }
    }

    function takeDeposits() external nonReentrant onlyWhenSigned {
        require(agreement.status == Status.FullDeposit, "Both parties must approve first");
        require(agreement.partyAApproved && agreement.partyBApproved, "Both parties must have approved");

        // Take deposits from both parties
        token.safeTransferFrom(agreement.partyA, address(this), agreement.depositA);
        token.safeTransferFrom(agreement.partyB, address(this), agreement.depositB);

        agreement.status = Status.Active;
        
        emit DepositsTaken(agreement.depositA, agreement.depositB);
        emit Activated();
    }

    function openDispute() external nonReentrant onlyPartyAOrB onlyWhenSigned {
        require(agreement.status == Status.Active, "Agreement must be active");
        
        agreement.status = Status.Disputed;
        
        emit DisputeOpened(msg.sender);
    }

    function proposeResolution(
        uint256 amountToA,
        uint256 amountToB
    ) external nonReentrant onlyParties onlyWhenSigned {
        require(agreement.status == Status.Disputed, "Agreement must be disputed");
        require(amountToA + amountToB == agreement.depositA + agreement.depositB, "Amounts must sum to total deposits");

        // Reset current proposal
        currentProp.amountToA = amountToA;
        currentProp.amountToB = amountToB;
        currentProp.approvalCount = 0;

        // Reset all approvals
        currentProp.approvals[agreement.partyA] = false;
        currentProp.approvals[agreement.partyB] = false;
        currentProp.approvals[agreement.mediator] = false;

        emit ResolutionProposed(msg.sender);
    }

    function approveResolution() external nonReentrant onlyParties onlyWhenSigned {
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
        require(agreement.status == Status.Created || agreement.status == Status.Signed || agreement.status == Status.PartialDeposit, "Invalid status for refund");
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
        address filecoinAccessControl,
        uint256 propAmountToA,
        uint256 propAmountToB,
        uint8 approvalCount,
        bool partyAApproved,
        bool partyBApproved
    ) {
        return (
            agreement.partyA,
            agreement.partyB,
            agreement.mediator,
            agreement.depositA,
            agreement.depositB,
            agreement.status,
            agreement.filecoinAccessControl,
            currentProp.amountToA,
            currentProp.amountToB,
            currentProp.approvalCount,
            agreement.partyAApproved,
            agreement.partyBApproved
        );
    }
} 