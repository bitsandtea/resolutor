# Resolutor

## Dual-Chain Architecture for AI-Powered Contract Resolution

Resolutor implements a decentralized dispute resolution platform using a **dual-chain architecture**:

- **Flow EVM**: Handles signing workflows, deposit escrows, and dispute resolution (financial logic)
- **Filecoin EVM**: Handles storage, access control, and file management (storage logic)

## Project Structure

### `/app`

Next.js web application for contract creation, signing, and dispute management

- Frontend interface for all user interactions
- Backend API routes for orchestrating cross-chain operations
- Database for user data and agreement metadata

### `/flow`

Flow EVM smart contracts for financial operations

- `MultiSigAgreement.sol`: Escrow deposits and 2-of-3 multisig resolution
- `AgreementFactory.sol`: Deploys agreement instances via proxy pattern
- **No CID storage**: References Filecoin contracts by address only

### `/filecoin`

Filecoin EVM smart contracts for storage and access control

- `StorageManager.sol`: Central registry for agreement storage and versioning
- `AccessControlManager.sol`: Granular file permissions and delegation
- `EncryptedStorage.sol`: Encrypted file storage with programmable access

### `/docs`

Comprehensive system documentation

- Architecture decisions and technical specifications
- Integration patterns and deployment guides
- API documentation and testing strategies

## Key Features

- **Separation of Concerns**: Financial logic on Flow, storage logic on Filecoin
- **AI-Powered Mediation**: GPT-4 analyzes evidence and proposes resolutions
- **Cross-Chain Integration**: Seamless coordination between Flow and Filecoin
- **Access Control**: Granular permissions with delegation capabilities
- **Version Control**: Complete audit trail of contract lifecycle
- **Encryption**: AES-256-GCM with per-party key management

## Getting Started

1. **Setup Environment**:

   ```bash
   # Clone repository
   git clone https://github.com/your-org/resolutor
   cd resolutor

   # Install dependencies
   cd app && npm install
   cd ../flow && npm install
   ```

2. **Deploy Contracts**:

   ```bash
   # Deploy Flow contracts
   cd flow
   npm run deploy -- --network flowEVMTestnet

   # Deploy Filecoin contracts (coming soon)
   cd ../filecoin
   npm run deploy -- --network filecoin-evm-testnet
   ```

3. **Configure Backend**:

   ```bash
   cd app
   cp .env.example .env.local
   # Update with contract addresses and API keys
   ```

4. **Run Application**:
   ```bash
   cd app
   npm run dev
   ```

## Architecture Benefits

- **Gas Efficiency**: No large string storage on Flow (expensive)
- **Storage Optimization**: Filecoin specialized for file storage
- **Access Control**: Blockchain-enforced permissions
- **Scalability**: Each chain optimized for its purpose
- **Immutability**: Complete audit trail across both chains
