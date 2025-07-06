// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract AgreementFactory is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Status {
        Created,
        Signed,
        Active,
        Disputed,
        Resolved
    }

    struct Proposal {
        uint256 amountToA;
        uint256 amountToB;
        uint8 approvalCount;
        mapping(address => bool) approvals;
    }

    struct Agreement {
        address partyA;
        address partyB;
        address mediator;
        uint256 depositA;
        uint256 depositB;
        uint256 balance;
        Status status;
        IERC20 token;
        address filecoinAccessControl;
        bool partyAApproved;
        bool partyBApproved;
        uint256 creationTimestamp;
    }

    mapping(bytes32 => Agreement) public agreements;
    mapping(bytes32 => Proposal) public proposals;

    uint256 public constant DEPOSIT_TIMEOUT = 7 days;
    uint256 public constant MAX_DEPOSIT = 1000000 * 10**18; // 1M tokens max

    event AgreementCreated(bytes32 indexed agreementId, address indexed partyA);
    event ContractSigned(bytes32 indexed agreementId, address indexed partyB);
    event PartyApproved(bytes32 indexed agreementId, address indexed party);
    event DepositsTaken(
        bytes32 indexed agreementId,
        uint256 amountA,
        uint256 amountB
    );
    event Activated(bytes32 indexed agreementId);
    event DisputeOpened(bytes32 indexed agreementId, address indexed opener);
    event ResolutionProposed(
        bytes32 indexed agreementId,
        address indexed proposer
    );
    event ResolutionApproved(
        bytes32 indexed agreementId,
        address indexed approver
    );
    event ResolutionExecuted(
        bytes32 indexed agreementId,
        uint256 amountToA,
        uint256 amountToB
    );
    event Refunded(bytes32 indexed agreementId);

    modifier onlyParties(bytes32 _agreementId) {
        Agreement storage agreement = agreements[_agreementId];
        require(
            msg.sender == agreement.partyA ||
                msg.sender == agreement.partyB ||
                msg.sender == agreement.mediator,
            "Not authorized"
        );
        _;
    }

    modifier onlyPartyAOrB(bytes32 _agreementId) {
        Agreement storage agreement = agreements[_agreementId];
        require(
            msg.sender == agreement.partyA || msg.sender == agreement.partyB,
            "Only parties can call this"
        );
        _;
    }

    modifier onlyWhenSigned(bytes32 _agreementId) {
        require(
            agreements[_agreementId].partyB != address(0),
            "Contract not signed yet"
        );
        _;
    }

    function createAgreement(
        bytes32 _agreementId,
        address _partyA,
        address _mediator,
        uint256 _depositA,
        uint256 _depositB,
        address _token,
        address _filecoinAccessControl,
        bool signOnCreate
    ) external {
        require(
            agreements[_agreementId].partyA == address(0),
            "Agreement already exists"
        );
        require(
            _partyA != address(0) && _mediator != address(0),
            "Invalid addresses"
        );
        require(
            _partyA != _mediator,
            "Party A and mediator must be different"
        );
        require(
            _depositA <= MAX_DEPOSIT && _depositB <= MAX_DEPOSIT,
            "Deposit exceeds maximum"
        );
        require(_token != address(0), "Invalid token address");
        require(
            _filecoinAccessControl != address(0),
            "Invalid access control address"
        );

        Agreement storage agreement = agreements[_agreementId];

        agreement.partyA = _partyA;
        agreement.mediator = _mediator;
        agreement.depositA = _depositA;
        agreement.depositB = _depositB;
        agreement.status = Status.Created;
        agreement.token = IERC20(_token);
        agreement.filecoinAccessControl = _filecoinAccessControl;
        agreement.creationTimestamp = block.timestamp;

        if (signOnCreate) {
            agreement.partyAApproved = true;
        }

        if (
            _depositA > 0 &&
            agreement.token.allowance(_partyA, address(this)) >= _depositA
        ) {
            agreement.token.safeTransferFrom(
                _partyA,
                address(this),
                _depositA
            );
            agreement.balance += _depositA;
            emit PartyApproved(_agreementId, _partyA);
            emit DepositsTaken(_agreementId, _depositA, 0);
        } else if (_depositA == 0) {
            agreement.partyAApproved = true;
        }

        emit AgreementCreated(_agreementId, _partyA);
    }

    function signContract(bytes32 _agreementId) external nonReentrant {
        Agreement storage agreement = agreements[_agreementId];
        require(
            agreement.status == Status.Created,
            "Contract already signed or invalid status"
        );
        require(agreement.partyB == address(0), "Party B already set");
        require(
            msg.sender != agreement.partyA && msg.sender != agreement.mediator,
            "Party A or mediator cannot be party B"
        );

        _setPartyBAndSign(_agreementId, msg.sender);
    }

    function _setPartyBAndSign(bytes32 _agreementId, address _partyB) private {
        Agreement storage agreement = agreements[_agreementId];
        agreement.partyB = _partyB;

        if (
            agreement.depositB > 0 &&
            agreement.token.allowance(_partyB, address(this)) >=
            agreement.depositB
        ) {
            agreement.token.safeTransferFrom(
                _partyB,
                address(this),
                agreement.depositB
            );
            agreement.balance += agreement.depositB;
            agreement.partyBApproved = true;
            emit PartyApproved(_agreementId, _partyB);
            emit DepositsTaken(_agreementId, 0, agreement.depositB);
        } else if (agreement.depositB == 0) {
            agreement.partyBApproved = true;
        }

        if (agreement.depositA == 0) {
            agreement.partyAApproved = true;
        }

        if (agreement.partyAApproved && agreement.partyBApproved) {
            agreement.status = Status.Active;
            emit Activated(_agreementId);
        } else {
            agreement.status = Status.Signed;
        }

        emit ContractSigned(_agreementId, _partyB);
    }

    function approveDeposit(bytes32 _agreementId)
        external
        nonReentrant
        onlyPartyAOrB(_agreementId)
        onlyWhenSigned(_agreementId)
    {
        Agreement storage agreement = agreements[_agreementId];
        require(
            agreement.status == Status.Signed,
            "Invalid status for approval"
        );

        if (msg.sender == agreement.partyA) {
            require(!agreement.partyAApproved, "Party A already approved");
            if (agreement.depositA > 0) {
                require(
                    agreement.token.allowance(
                        agreement.partyA,
                        address(this)
                    ) >= agreement.depositA,
                    "Insufficient allowance from party A"
                );
                agreement.token.safeTransferFrom(
                    agreement.partyA,
                    address(this),
                    agreement.depositA
                );
                agreement.balance += agreement.depositA;
                emit DepositsTaken(_agreementId, agreement.depositA, 0);
            }
            agreement.partyAApproved = true;
            emit PartyApproved(_agreementId, agreement.partyA);
        } else if (msg.sender == agreement.partyB) {
            require(!agreement.partyBApproved, "Party B already approved");
            if (agreement.depositB > 0) {
                require(
                    agreement.token.allowance(
                        agreement.partyB,
                        address(this)
                    ) >= agreement.depositB,
                    "Insufficient allowance from party B"
                );
                agreement.token.safeTransferFrom(
                    agreement.partyB,
                    address(this),
                    agreement.depositB
                );
                agreement.balance += agreement.depositB;
                emit DepositsTaken(_agreementId, 0, agreement.depositB);
            }
            agreement.partyBApproved = true;
            emit PartyApproved(_agreementId, agreement.partyB);
        }

        if (agreement.partyAApproved && agreement.partyBApproved) {
            agreement.status = Status.Active;
            emit Activated(_agreementId);
        }
    }

    function openDispute(bytes32 _agreementId)
        external
        nonReentrant
        onlyPartyAOrB(_agreementId)
        onlyWhenSigned(_agreementId)
    {
        Agreement storage agreement = agreements[_agreementId];
        require(agreement.status == Status.Active, "Agreement must be active");
        agreement.status = Status.Disputed;
        emit DisputeOpened(_agreementId, msg.sender);
    }

    function proposeResolution(
        bytes32 _agreementId,
        uint256 _amountToA,
        uint256 _amountToB
    )
        external
        nonReentrant
        onlyParties(_agreementId)
        onlyWhenSigned(_agreementId)
    {
        Agreement storage agreement = agreements[_agreementId];
        require(
            agreement.status == Status.Disputed,
            "Agreement must be disputed"
        );
        require(
            _amountToA + _amountToB == agreement.balance,
            "Amounts must sum to total deposits"
        );

        Proposal storage p = proposals[_agreementId];
        p.amountToA = _amountToA;
        p.amountToB = _amountToB;
        p.approvalCount = 0;
        p.approvals[agreement.partyA] = false;
        p.approvals[agreement.partyB] = false;
        p.approvals[agreement.mediator] = false;

        emit ResolutionProposed(_agreementId, msg.sender);
    }

    function openDisputeAndPropose(
        bytes32 _agreementId,
        uint256 _amountToA,
        uint256 _amountToB,
        bool _approve
    )
        external
        nonReentrant
        onlyPartyAOrB(_agreementId)
        onlyWhenSigned(_agreementId)
    {
        Agreement storage agreement = agreements[_agreementId];
        require(agreement.status == Status.Active, "Agreement must be active");
        agreement.status = Status.Disputed;
        emit DisputeOpened(_agreementId, msg.sender);

        require(
            _amountToA + _amountToB == agreement.balance,
            "Amounts must sum to total deposits"
        );

        Proposal storage p = proposals[_agreementId];
        p.amountToA = _amountToA;
        p.amountToB = _amountToB;
        p.approvalCount = 0;
        p.approvals[agreement.partyA] = false;
        p.approvals[agreement.partyB] = false;
        p.approvals[agreement.mediator] = false;

        emit ResolutionProposed(_agreementId, msg.sender);

        if (_approve) {
            require(!p.approvals[msg.sender], "Already approved");
            p.approvals[msg.sender] = true;
            p.approvalCount++;
            emit ResolutionApproved(_agreementId, msg.sender);

            if (p.approvalCount >= 2) {
                _executeResolution(_agreementId);
            }
        }
    }

    function approveResolution(bytes32 _agreementId)
        external
        nonReentrant
        onlyParties(_agreementId)
        onlyWhenSigned(_agreementId)
    {
        Agreement storage agreement = agreements[_agreementId];
        require(
            agreement.status == Status.Disputed,
            "Agreement must be disputed"
        );

        Proposal storage p = proposals[_agreementId];
        require(!p.approvals[msg.sender], "Already approved");

        p.approvals[msg.sender] = true;
        p.approvalCount++;

        emit ResolutionApproved(_agreementId, msg.sender);

        if (p.approvalCount >= 2) {
            _executeResolution(_agreementId);
        }
    }

    function _executeResolution(bytes32 _agreementId) private {
        Agreement storage agreement = agreements[_agreementId];
        Proposal storage p = proposals[_agreementId];

        agreement.status = Status.Resolved;

        if (p.amountToA > 0) {
            agreement.token.safeTransfer(agreement.partyA, p.amountToA);
        }
        if (p.amountToB > 0) {
            agreement.token.safeTransfer(agreement.partyB, p.amountToB);
        }
        agreement.balance = 0;

        emit ResolutionExecuted(_agreementId, p.amountToA, p.amountToB);
    }

    function refundExpired(bytes32 _agreementId) external nonReentrant {
        Agreement storage agreement = agreements[_agreementId];
        require(
            agreement.status == Status.Created ||
                agreement.status == Status.Signed,
            "Invalid status for refund"
        );
        require(
            block.timestamp >= agreement.creationTimestamp + DEPOSIT_TIMEOUT,
            "Timeout not reached"
        );

        agreement.status = Status.Resolved;

        if (agreement.balance > 0) {
            agreement.token.safeTransfer(agreement.partyA, agreement.balance);
            agreement.balance = 0;
        }

        emit Refunded(_agreementId);
    }

    function getAgreement(bytes32 _agreementId)
        external
        view
        returns (
            address partyA,
            address partyB,
            address mediator,
            uint256 depositA,
            uint256 depositB,
            uint256 balance,
            Status status,
            address token,
            address filecoinAccessControl,
            bool partyAApproved,
            bool partyBApproved,
            uint256 creationTimestamp
        )
    {
        Agreement storage agreement = agreements[_agreementId];
        return (
            agreement.partyA,
            agreement.partyB,
            agreement.mediator,
            agreement.depositA,
            agreement.depositB,
            agreement.balance,
            agreement.status,
            address(agreement.token),
            agreement.filecoinAccessControl,
            agreement.partyAApproved,
            agreement.partyBApproved,
            agreement.creationTimestamp
        );
    }

    function getProposal(bytes32 _agreementId)
        external
        view
        returns (
            uint256 amountToA,
            uint256 amountToB,
            uint8 approvalCount
        )
    {
        Proposal storage p = proposals[_agreementId];
        return (p.amountToA, p.amountToB, p.approvalCount);
    }
} 