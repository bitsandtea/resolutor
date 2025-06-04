# Smart Contracts Design (Solidity / Flow EVM)

## Overview

The Flow EVM environment supports standard Solidity contracts. Two contracts are required:

1. `MultiSigAgreement.sol` – stores escrowed ERC-20 deposits, dispute data, and manages a **2-of-3** multisig (party A, party B, mediator).
2. `AgreementFactory.sol` – deploys minimal-proxy (`ERC1967` clone) instances of `MultiSigAgreement` and tracks them for easy discovery.

Both contracts interact with an **ERC-20 stablecoin** (USDC on Flow EVM test-net). Deposits move via `transferFrom`, so callers must set allowances first.

---

## 1. MultiSigAgreement.sol

### Public Interfaces

| Name                                                                                                                                                   | Visibility | Purpose                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------- |
| `constructor(address _partyA, address _partyB, address _mediator, uint256 _depositA, uint256 _depositB, address _token, string calldata _manifestCid)` | public     | Initialises a new deal and pulls deposits from both parties in a single tx (if both approved allowances). |
| `function depositByPartyB()`                                                                                                                           | external   | Optional path when party B prefers to deposit later. Pulls `_depositB` from `msg.sender`.                 |
| `function openDispute(string calldata evidenceCid)`                                                                                                    | external   | Called by either party; moves status → `Disputed` and emits event with IPFS CID.                          |
| `function proposeResolution(uint256 amountToA, uint256 amountToB, string calldata proposalCid)`                                                        | external   | Callable by party A, party B, or mediator. Stores proposal and resets approvals.                          |
| `function approveResolution()`                                                                                                                         | external   | Records caller approval. Once **2 approvals**, contract executes payment split.                           |
| `function refundExpired()`                                                                                                                             | external   | Anyone can call after `creationTimestamp + DEPOSIT_TIMEOUT` if status is `Pending`. Returns deposits.     |
| `function getState()`                                                                                                                                  | view       | Returns current `Agreement` struct (read-only helper).                                                    |

### Stored State

```solidity
enum Status { Pending, Active, Disputed, Resolved }

struct Proposal {
  uint256 amountToA;
  uint256 amountToB;
  string  proposalCid;        // IPFS JSON with AI reasoning
  mapping(address => bool) approvals;
  uint8   approvalCount;
}

struct AgreementData {
  address partyA;
  address partyB;
  address mediator;
  uint256 depositA;
  uint256 depositB;
  Status  status;
  string  manifestCid;        // original contract + files
  string[] evidenceCids;
  Proposal currentProp;
}
```

All storage lives inside the proxy instance; `AgreementFactory` keeps a list of deployed addresses.

### Events

```solidity
event AgreementCreated(address indexed contractAddr, address indexed partyA, address indexed partyB);
event Deposited(address indexed from, uint256 amount);
event Activated();
event DisputeOpened(address indexed opener, string evidenceCid);
event ResolutionProposed(address indexed proposer);
event ResolutionApproved(address indexed approver);
event ResolutionExecuted(uint256 amountToA, uint256 amountToB);
event Refunded();
```

### Security Notes

- Use `OpenZeppelin SafeERC20` to prevent missing return values.
- Guard state transitions with `require(status == …)` checks.
- Include `nonReentrant` modifier from OZ `ReentrancyGuard` on all mutating functions.
- Keep a constant `MAX_DEPOSIT` in contract to cap escrow size.

---

## 2. AgreementFactory.sol

- Maintains an `address[] public agreements` array.
- Emits `AgreementCreated` on deployment.
- Provides `function createAgreement(args…) returns (address newAgreement)` wrapper that deploys an `ERC1967Proxy` pointing to an immutable implementation.
- Includes view helpers: `function count() external view returns (uint256)` and `function list(uint256 start, uint256 size) external view returns (address[] memory)`.

---

## Developer Checklist

- Scaffold repo with **Hardhat** + **TypeScript**.
- Install OpenZeppelin contracts `^5.0`.
- Configure **Flow EVM test-net** RPC in `hardhat.config.ts`.
- Write unit tests covering:
  - Happy path (both deposit, no dispute, finalise).
  - Dispute flow with mediator proposal accepted by A.
  - Refund on timeout.
  - Re-entrancy attempts.
- Run `npx hardhat coverage` – target ≥90 %.
- Verify bytecode on Flow EVM explorer using `npx hardhat verify`.
