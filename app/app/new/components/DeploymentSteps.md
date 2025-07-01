# Deployment Steps Documentation

## Overview

The `useDeployment` hook orchestrates a multi-step blockchain deployment process that takes a contract from local content to a fully deployed, multi-chain agreement. The deployment follows a specific sequence that ensures proper contract integrity, access control, and cross-chain functionality.

## Step Execution Order

```
1. ipfs_upload           📁 Upload to IPFS
2. filecoin_access_deploy 🔐 Deploy Access Control
3. filecoin_store_file   💾 Store File on Filecoin
4. flow_deploy           ⚡ Deploy Flow Contract
```

## Step Details

### 1. IPFS Upload (`ipfs_upload`) 📁

**Purpose**: Upload the contract content to decentralized storage (IPFS) via Lighthouse.storage

**What happens**:

- Checks if content already exists in IPFS (CID exists in database)
- If exists: Skips upload and proceeds to next step
- If new: Uploads contract content to IPFS
- Returns a Content Identifier (CID) for permanent storage
- Updates database with CID for future reference

**Requirements**:

- Valid contract content
- Network connectivity to Lighthouse.storage

**Output**:

- IPFS CID (Content Identifier)
- Gateway URL for content access
- Database record updated with CID

**Error handling**:

- Network failures retry automatically
- Invalid content throws validation error
- Service unavailable triggers fallback

---

### 2. Filecoin Access Deploy (`filecoin_access_deploy`) 🔐

**Purpose**: Deploy access control contract on Filecoin EVM for storage management

**What happens**:

- Requires connected wallet (wallet address needed)
- Calls `createAccessControl()` function via wagmi hook
- Creates AccessControlManager entry on Filecoin network
- Links agreement ID with creator address and mediator
- Enables storage access permissions for contract participants

**Requirements**:

- Connected wallet (address available)
- Valid agreement ID
- Mediator address configured
- User should be connected to FileCoin Testnet Network which is stored in process.env.NEXT_PUBLIC_FILECOIN_CALIBRATION_CHAIN_ID

**Output**:

- Access control contract address
- Transaction hash
- Storage permissions established

**Error handling**:

- Wallet not connected: throws connection error
- Transaction failure: provides retry mechanism
- Network issues: automatic retry with backoff

---

### 3. Filecoin Store File (`filecoin_store_file`) 💾

**Purpose**: Store the contract file in the Filecoin access control contract

**What happens**:

- Requires completed IPFS upload (CID available)
- Requires completed Filecoin access control deployment
- Calls `storeFile()` function with IPFS CID and agreement ID
- Links the contract file to the agreement in the access control system
- Establishes file storage permissions for authorized parties

**Requirements**:

- Connected wallet (address available)
- Completed IPFS upload (CID required)
- Completed Filecoin access control deployment
- User should be connected to FileCoin Testnet Network which is stored in process.env.NEXT_PUBLIC_FILECOIN_CALIBRATION_CHAIN_ID

**Output**:

- File storage confirmation
- Transaction hash
- File-agreement linkage established

**Error handling**:

- Missing CID: blocks execution with clear error
- Wallet not connected: throws connection error
- Transaction failure: provides retry mechanism
- Network issues: automatic retry with backoff

---

### 4. Flow Deploy (`flow_deploy`) ⚡

**Purpose**: Deploy the main MultiSigAgreement contract on Flow blockchain

**What happens**:

- Requires connected wallet and IPFS CID
- Creates MultiSigAgreement contract with:
  - Party A: Connected wallet address
  - Party B: Placeholder (0x0000000000000000000000000000000000000000)
  - Deposit amounts: 0.1 ETH each party
  - Manifest CID: IPFS content reference
- Establishes on-chain agreement with escrow functionality
- Enables dispute resolution and multi-signature requirements

**Requirements**: User should be connected to Flow Network which is stored in process.env.NEXT_PUBLIC_FLOW_EVM_TESTNET_CHAIN_ID

**Requirements**:

- Connected wallet
- Completed IPFS upload (CID required)
- Sufficient gas/fees for contract deployment
- Flow network connectivity

**Output**:

- Flow contract address
- Transaction hash
- Multi-signature agreement established
- Escrow deposits locked

**Error handling**:

- Missing CID: blocks execution with clear error
- Wallet errors: retry mechanism with user guidance
- Insufficient funds: clear error message
- Network congestion: automatic retry

---

## State Management

### Status Tracking

- Each step tracks: `pending` | `in_progress` | `completed` | `failed`
- Database persistence ensures recovery from interruptions
- UI reflects real-time progress and step status

### Error Recovery

- Failed steps can be retried individually
- Completed steps are skipped on retry
- Full reset option returns to initial state
- Logs provide detailed troubleshooting information

### Resumption Logic

- Deployment can resume from any interrupted step
- Database state determines next step to execute
- Existing resources (CID, contracts) are reused
- No duplicate operations on successful steps

## Cross-Chain Integration

### Data Flow

1. **IPFS**: Immutable content storage
2. **Filecoin**: Access control and storage management
3. **Flow**: Main agreement contract and escrow

### Dependencies

- Filecoin store file requires IPFS CID and access control deployment
- Flow contract requires IPFS CID
- Access control links to agreement participants
- All systems reference common agreement ID

### Consistency

- Agreement ID provides cross-chain linkage
- Each step validates previous step completion
- Atomic operations ensure data integrity

## Hook Usage Context

The `useDeployment` hook provides:

- **State management**: Current step, processing status, error states
- **Action functions**: Start, retry, reset deployment
- **Real-time feedback**: Progress logs, step status updates
- **Error handling**: Automatic retry, user-friendly error messages
- **Recovery mechanisms**: Resume from interruption, skip completed steps

This architecture ensures reliable, user-friendly contract deployment across multiple blockchain networks while maintaining data integrity and providing comprehensive error recovery.
