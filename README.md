# Resolutor

_Built for PL_Genesis: Modular Worlds Hackathon_

## AI-Powered Blockchain Dispute Resolution Platform

Resolutor democratizes access to justice by providing affordable, fast, and fair dispute resolution through blockchain technology and AI mediation. Traditional legal systems leave people choosing between "eating the cost" or "spending more on lawyers than the dispute is worth" - Resolutor solves this with smart contracts, AI arbitration, and automated enforcement.

### Architecture Overview

Resolutor implements a **dual-chain architecture** optimized for different use cases:

- **Flow EVM**: Handles signing workflows, deposit escrows, and dispute resolution (financial logic)
- **Filecoin EVM/IPFS**: Handles decentralized storage, evidence uploads, and file management (storage logic)

## Project Structure

### `/app`

Next.js web application for contract creation, signing, and dispute management

- Frontend interface for all user interactions
- Backend API routes for orchestrating blockchain operations
- Database (Prisma) for user data and agreement metadata
- AI-powered mediation system using MASAI AI

### `/contracts`

Smart contracts for blockchain operations

#### `/contracts/flow`

- `AgreementFactory.sol`: Deploys agreement instances and handles dispute resolution
- Escrow deposits and 2-of-3 multisig resolution logic
- **No CID storage**: References IPFS content by hash only

#### `/contracts/filecoin`

- `AccessControl.sol`: Granular file permissions and access control
- Integration with Filecoin storage network

### `/docs`

Comprehensive system documentation

- Platform description and technical specifications
- Integration patterns and deployment guides
- API documentation and usage examples

## Key Features

- **AI-Powered Mediation**: MASAI AI analyzes evidence and makes binding decisions
- **Smart Contract Escrow**: Secure deposit holding until dispute resolution
- **IPFS Storage**: Decentralized evidence and document storage
- **Auto-Execution**: Blockchain automatically enforces AI decisions
- **Multi-Chain Support**: Flow EVM for contracts, Filecoin for storage
- **Fair & Affordable**: Fraction of traditional legal costs
- **Transparent Process**: Complete audit trail of all decisions

## Getting Started

### Prerequisites

You'll need the following to run Resolutor:

- **Test Flow Tokens**: Get testnet FLOW from [Flow Faucet](https://testnet-faucet.onflow.org/)
- **Test Filecoin Tokens**: Get testnet FIL from [Filecoin Faucet](https://faucet.calibration.fildev.network/)
- **MASAI AI API Key**: Sign up at [MASAI AI](https://mosaia.ai/) for AI mediation services
- **Node.js** (v18 or higher)
- **PostgreSQL** database (or use cloud provider)

### 1. Environment Setup

```bash
# Clone repository
git clone https://github.com/your-org/resolutor
cd resolutor

# Install dependencies
cd app && npm install
cd ../contracts && npm install
```

### 2. Database Setup

```bash
cd app
# Copy environment template
cp .env.example .env.local

# Update .env.local with your database URL
# DATABASE_URL="postgresql://username:password@localhost:5432/resolutor"

# Run database migrations
npx prisma migrate dev
npx prisma generate
```

### 3. Environment Variables

Configure the following environment variables in `/app/.env.local`:

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/resolutor"

# AI Mediation
MOSAIA_API_KEY="your_masai_api_key_here"

# Blockchain Configuration
NEXT_PUBLIC_FLOW_RPC_URL="https://testnet.evm.nodes.onflow.org"
NEXT_PUBLIC_FLOW_EVM_TESTNET_CHAIN_ID="545"
NEXT_PUBLIC_MULTISIG_ADDRESS="deployed_contract_address"

# Mediator Configuration (for auto-execution)
MEDIATOR_PKEY="mediator_private_key_without_0x_prefix"

# IPFS Configuration
NEXT_PUBLIC_IPFS_GATEWAY="https://gateway.pinata.cloud"
PINATA_JWT="your_pinata_jwt_token"
```

### 4. Deploy Smart Contracts

```bash
# Deploy Flow contracts
cd contracts
npm run deploy:flow

# Deploy Filecoin contracts
npm run deploy:filecoin

# Update NEXT_PUBLIC_MULTISIG_ADDRESS in .env.local with deployed address
```

### 5. Run the Application

```bash
cd app
npm run dev
```

Visit `http://localhost:3000` to start using Resolutor!

### 6. Getting Test Tokens

#### Flow Testnet Tokens

1. Visit [Flow Faucet](https://testnet-faucet.onflow.org/)
2. Enter your wallet address
3. Request testnet FLOW tokens

#### Filecoin Testnet Tokens

1. Visit [Filecoin Faucet](https://faucet.calibration.fildev.network/)
2. Enter your wallet address
3. Request testnet FIL tokens

## Architecture Benefits

- **Cost Efficiency**: AI mediation costs pennies vs. thousands in legal fees
- **Gas Optimization**: IPFS storage keeps blockchain transactions minimal
- **Decentralized Storage**: Evidence stored on IPFS/Filecoin for immutability
- **Automated Enforcement**: Smart contracts execute decisions automatically
- **Transparent Process**: All decisions and evidence permanently recorded
- **Scalable Resolution**: Handle thousands of disputes without human bottlenecks
- **Cross-Chain Flexibility**: Flow for finance, Filecoin for storage

## Use Cases

- **Rental Agreements**: Security deposits, property damage claims
- **Freelance Work**: Payment disputes, project delivery conflicts
- **E-commerce**: Product quality, returns, and refunds
- **Service Contracts**: Home improvement, professional services
- **Peer-to-Peer**: Marketplace disputes, shared resources

## Contributing

Built during the PL_Genesis: Modular Worlds Hackathon. We welcome contributions to make dispute resolution more accessible and fair for everyone.

## License

MIT License - see LICENSE file for details.
