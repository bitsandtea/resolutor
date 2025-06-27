### Flow Deployments (Updated for Dual-Chain Architecture)

**Current Deployment Addresses:**

- AgreementFactory deployed to: 0xCa80443A8112a69C80BCA99f1033D33bD5a6c4aB
- MultiSigAgreement deployed to: 0x903eEB8b973F481C2CC1B134A426B11B097A2c19
- Mock USDC deployed to: 0xaD3A781d4bd2a6674E42357a15E674bC25B0FE94

**Architecture Changes:**

- Flow contracts NO LONGER store CIDs directly
- Flow contracts only reference Filecoin contract addresses
- All storage, versioning, and access control handled on Filecoin EVM

### Updated Technical Flow

**Contract Creation (Alice creates, sends to Bob):**

1. **Backend**: Upload unsigned contract to IPFS → get `initialCid`
2. **Backend**: Deploy Filecoin access control contract for this agreement
3. **Backend**: Call `FilecoinStorageManager.createAgreementStorage(agreementId, flowContractAddr, initialCid, accessControlAddr)`
4. **Backend**: Call `FlowAgreementFactory.createAgreement(partyA, mediator, depositA, depositB, token, filecoinStorageManager, filecoinAccessControl)`
5. **Backend**: Store agreementId → Flow contract mapping in database

**Signing Flow (Bob signs):**

1. **Frontend**: Bob reviews contract via agreementId (fetches from Filecoin)
2. **Backend**: When Bob signs, call `FlowAgreement.signContract()` (sets partyB address)
3. **Backend**: Generate signed contract + PDF, upload to IPFS
4. **Backend**: Call `FilecoinStorageManager.updateContractSigned(agreementId, signedCid, pdfCid)`
5. **Backend**: Call `FilecoinAccessControl.setPartyB(agreementId, partyBAddress)`

**Deposit Flow:**

1. **Frontend**: Both parties approve USDC allowances to Flow agreement contract
2. **Frontend**: Each party calls `FlowAgreement.approveDeposit()`
3. **Frontend**: Anyone calls `FlowAgreement.takeDeposits()` (pulls from both parties)
4. **Backend**: Update storage status: `FilecoinStorageManager.updateStatus(agreementId, "active")`

**Dispute Flow:**

1. **Frontend**: Party calls `FlowAgreement.openDispute()` (no CID parameter)
2. **Backend**: Upload evidence files to IPFS
3. **Backend**: For each evidence file, call `FilecoinStorageManager.addEvidence(agreementId, evidenceCid)`
4. **AI**: Process dispute using files from Filecoin storage
5. **Backend**: Upload AI rationale to IPFS
6. **Backend**: Call `FilecoinStorageManager.setAiRationale(agreementId, aiCid)`
7. **Frontend**: Mediator calls `FlowAgreement.proposeResolution(amountToA, amountToB)`
8. **Frontend**: Parties call `FlowAgreement.approveResolution()` (2-of-3 multisig)

### Key Benefits of Dual-Chain Architecture

1. **Separation of Concerns**: Flow = financial logic, Filecoin = storage/access
2. **Gas Efficiency**: No large string storage on Flow (expensive)
3. **Storage Optimization**: Filecoin specialized for file storage and retrieval
4. **Access Control**: Granular permissions and delegation on Filecoin
5. **Versioning**: Complete storage history maintained on Filecoin
6. **Encryption**: Advanced encryption and key management on Filecoin

### Integration Points

**Backend Services Need:**

- Flow provider for signing/deposit logic
- Filecoin provider for storage operations
- Cross-chain event correlation by agreementId
- Database mapping: agreementId → Flow contract address
- IPFS pinning service (web3.storage)

**Frontend Needs:**

- Flow wallet integration (for deposits/signing)
- File access via Filecoin gateway with access tokens
- Progress tracking across both chains
- Unified UX despite dual-chain complexity

### Testing Strategy

**Unit Tests:**

- Flow contracts: deposit, signing, dispute resolution
- Filecoin contracts: storage, access control, encryption
- Mock cross-chain interactions

**Integration Tests:**

- Complete end-to-end flows
- Cross-chain state consistency
- Access control enforcement
- File retrieval and decryption

**Gas Optimization:**

- Flow: minimize storage, optimize for frequent operations
- Filecoin: batch storage operations, efficient access control checks
