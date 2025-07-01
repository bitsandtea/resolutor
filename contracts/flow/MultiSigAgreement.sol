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
        Signed,         // 1 - Party B has signed, deposits may still be pending
        Active,         // 2 - All required deposits taken, agreement active
        Disputed,       // 3 - Dispute opened
        Resolved        // 4 - Final resolution executed
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

        // Take party A's deposit immediately if they have sufficient allowance
        if (_depositA > 0 && token.allowance(_partyA, address(this)) >= _depositA) {
            token.safeTransferFrom(_partyA, address(this), _depositA);
            agreement.partyAApproved = true;
            emit PartyApproved(_partyA);
            emit DepositsTaken(_depositA, 0);
        } else if (_depositA == 0) {
            agreement.partyAApproved = true;
        }

        emit AgreementCreated(address(this), _partyA);
    }

    function signContract() external nonReentrant {
        require(agreement.status == Status.Created, "Contract already signed or invalid status");
        require(agreement.partyB == address(0), "Party B already set");
        require(msg.sender != agreement.partyA && msg.sender != agreement.mediator, "Party A or mediator cannot be party B");

        _setPartyBAndSign(msg.sender);
    }

    function signContractWithPartyB(address _partyB) external nonReentrant {
        require(agreement.status == Status.Created, "Contract already signed or invalid status");
        require(agreement.partyB == address(0), "Party B already set");
        require(_partyB != agreement.partyA && _partyB != agreement.mediator, "Party B cannot be party A or mediator");
        require(_partyB != address(0), "Invalid party B address");

        _setPartyBAndSign(_partyB);
    }

    function _setPartyBAndSign(address _partyB) private {
        agreement.partyB = _partyB;
        
        // Take party B's deposit immediately if they're signing themselves and have sufficient allowance
        if (msg.sender == _partyB && agreement.depositB > 0) {
            if (token.allowance(_partyB, address(this)) >= agreement.depositB) {
                token.safeTransferFrom(_partyB, address(this), agreement.depositB);
                agreement.partyBApproved = true;
                emit PartyApproved(_partyB);
                emit DepositsTaken(0, agreement.depositB);
            }
        } else if (agreement.depositB == 0) {
            agreement.partyBApproved = true;
        }
        
        // Auto-approve party A if they have no deposit
        if (agreement.depositA == 0) {
            agreement.partyAApproved = true;
        }
        
        // Check if contract should be activated
        bool partyAReady = agreement.partyAApproved;
        bool partyBReady = agreement.partyBApproved;
        
        if (partyAReady && partyBReady) {
            agreement.status = Status.Active;
            emit Activated();
        } else {
            agreement.status = Status.Signed;
        }

        emit ContractSigned(_partyB);
    }

    function approveDeposit() external nonReentrant onlyPartyAOrB onlyWhenSigned {
        require(agreement.status == Status.Signed, "Invalid status for approval");
        
        if (msg.sender == agreement.partyA) {
            require(!agreement.partyAApproved, "Party A already approved");
            if (agreement.depositA > 0) {
                require(token.allowance(agreement.partyA, address(this)) >= agreement.depositA, "Insufficient allowance from party A");
                token.safeTransferFrom(agreement.partyA, address(this), agreement.depositA);
                emit DepositsTaken(agreement.depositA, 0);
            }
            agreement.partyAApproved = true;
            emit PartyApproved(agreement.partyA);
        } else if (msg.sender == agreement.partyB) {
            require(!agreement.partyBApproved, "Party B already approved");
            if (agreement.depositB > 0) {
                require(token.allowance(agreement.partyB, address(this)) >= agreement.depositB, "Insufficient allowance from party B");
                token.safeTransferFrom(agreement.partyB, address(this), agreement.depositB);
                emit DepositsTaken(0, agreement.depositB);
            }
            agreement.partyBApproved = true;
            emit PartyApproved(agreement.partyB);
        }

        // Check if contract should be activated
        bool partyAReady = agreement.partyAApproved;
        bool partyBReady = agreement.partyBApproved;
        
        if (partyAReady && partyBReady) {
            agreement.status = Status.Active;
            emit Activated();
        }
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
        require(agreement.status == Status.Created || agreement.status == Status.Signed, "Invalid status for refund");
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