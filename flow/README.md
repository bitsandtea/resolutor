# Resolutor Smart Contracts

Smart contracts for the Resolutor dispute resolution platform, built for Flow EVM testnet.

## Overview

This project implements a 2-of-3 multisig escrow system with dispute resolution functionality:

- **MultiSigAgreement.sol** - Core escrow contract that holds ERC-20 deposits and manages dispute resolution
- **AgreementFactory.sol** - Factory contract that deploys minimal proxy instances of MultiSigAgreement
- **MockERC20.sol** - Test token contract for development

## Features

- **Escrow System**: Secure deposit management with ERC-20 tokens
- **2-of-3 Multisig**: Requires 2 out of 3 parties (Party A, Party B, Mediator) to approve resolutions
- **Dispute Resolution**: Structured process for handling disagreements
- **Gas Efficient**: Uses minimal proxies (ERC-1167) for deployment
- **Security**: Built with OpenZeppelin contracts, includes reentrancy protection

## Installation

```bash
# Install dependencies
npm install

# Compile contracts
npm run build

# Run tests
npm test

# Run coverage
npm run coverage
```

## Usage

### Deployment

1. Set up environment variables:

```bash
export PRIVATE_KEY="your-private-key"
export DEPLOY_MOCK_TOKEN="true"  # Optional: deploy mock USDC
```

2. Deploy to Flow EVM testnet:

```bash
npm run deploy -- --network flowEVMTestnet
```

### Creating an Agreement

```typescript
// Deploy through factory
const factory = await ethers.getContractAt("AgreementFactory", factoryAddress);

const agreementAddress = await factory.createAgreement(
  partyA.address, // Party A address
  partyB.address, // Party B address
  mediator.address, // Mediator address
  depositA, // Party A deposit amount
  depositB, // Party B deposit amount
  tokenAddress, // ERC-20 token address
  "QmManifestHash" // IPFS hash of agreement manifest
);
```

Note: Both parties must approve token transfers before calling `createAgreement`.

### Dispute Resolution Flow

1. **Open Dispute**: Either party can open a dispute with evidence

```solidity
agreement.openDispute("QmEvidenceHash");
```

2. **Propose Resolution**: Any party can propose a resolution

```solidity
agreement.proposeResolution(amountToA, amountToB, "QmProposalHash");
```

3. **Approve Resolution**: 2 out of 3 parties must approve

```solidity
agreement.approveResolution();
```

## Contract Architecture

### MultiSigAgreement

Key functions:

- `initialize()` - Initialize proxy instance (called by factory)
- `depositByPartyB()` - Alternative deposit method for Party B
- `openDispute()` - Start dispute resolution process
- `proposeResolution()` - Propose how to split funds
- `approveResolution()` - Approve current proposal
- `refundExpired()` - Refund if agreement expires in Pending state

### AgreementFactory

Key functions:

- `createAgreement()` - Deploy new agreement instance
- `count()` - Get total number of agreements
- `list()` - Get paginated list of agreements
- `getAllAgreements()` - Get all agreement addresses

## Security Features

- **ReentrancyGuard**: Prevents reentrancy attacks
- **SafeERC20**: Safe token transfers
- **Access Control**: Function-level permissions
- **Input Validation**: Comprehensive parameter validation
- **Timeout Protection**: Automatic refund after deposit timeout

## Testing

The test suite covers:

- Happy path scenarios
- Dispute resolution workflows
- Timeout and refund mechanisms
- Security edge cases
- Access control validation

Run tests:

```bash
npm test
```

## Verification

After deployment, verify contracts on Flow EVM explorer:

```bash
npx hardhat verify --network flowEVMTestnet <contract-address> [constructor-args]
```

## Network Configuration

**Flow EVM Testnet:**

- RPC URL: `https://testnet.evm.nodes.onflow.org`
- Chain ID: `545`
- Explorer: `https://evm-testnet.flowscan.io`

## Constants

- `DEPOSIT_TIMEOUT`: 7 days
- `MAX_DEPOSIT`: 1,000,000 tokens
- **Gas Optimization**: Contracts optimized for 200 runs

## License

MIT License
