# Backend Services Specification

## Goals

- Keep backend minimal; rely on Flow blockchain and IPFS as the single source of truth.
- Provide REST endpoints that:
  1. Issue invitation links.
  2. Upload files to IPFS/Filecoin.
  3. Proxy dispute data to OpenAI.
  4. Return ready-to-sign EVM transactions.

## Tech Stack

- **Node.js + TypeScript** (strict compiler settings, no `any`).
- **Express** for lightweight HTTP routing.
- **@onflow/sdk** and **ethers.js** for crafting EVM transactions and interacting with smart contracts.
- **web3.storage** client for IPFS uploads.
- **dotenv** for secrets.
- **PostgreSQL (optional)** only if you need email-style invitation tracking. Otherwise the invitation token can be the IPFS CID of the unsigned contract.

## Directory Layout

```
backend/
  src/
    index.ts            // Express bootstrap
    routes/
      contracts.ts      // GET /templates  • POST /invite
      files.ts          // POST /upload
      disputes.ts       // POST /dispute   • POST /ai-resolve
    flow/
      contracts/        // smart contract ABIs and addresses
      generator.ts      // helper to generate EVM transactions
  tests/
  .env.sample
```

## Environment Variables

```
FLOW_ACCOUNT_ADDRESS=<hex>
FLOW_PRIVATE_KEY=<hex>
FLOW_PRIVATE_KEY_INDEX=0
OPENAI_API_KEY=sk-...
WEB3_STORAGE_TOKEN=...
POSTGRES_URL=...     # only if using DB
```

## Core Endpoints

| Method & Path      | Body                                              | Response                         |
| ------------------ | ------------------------------------------------- | -------------------------------- |
| `POST /invite`     | `{ templateId, partyAAddr, partyBEmail }`         | `{ inviteURL }`                  |
| `POST /upload`     | `multipart/form-data` (contract.pdf, contract.md) | `{ cid }`                        |
| `POST /dispute`    | `{ agreementId, openerAddr, evidenceCid }`        | `{ tx }` (Flow transaction JSON) |
| `POST /ai-resolve` | `{ agreementId, messageCid }`                     | `{ resolutionJson, tx }`         |

Each `tx` field is an **EVM transaction object** ready for the frontend wallet to sign.

## Invitation Workflow (No Database Variant)

1. Client hits `/upload` with the unsigned markdown and PDF – backend returns `cid`.
2. Backend crafts an **inviteURL** embedding that CID and the template name. Example: `https://app.xyz/invite/#<cid>`.
3. Email the link to Party B via SendGrid or similar.
4. When Party B visits the link the frontend fetches the markdown from IPFS and lets them sign.

## OpenAI Mediation Workflow

1. Backend receives dispute data and evidence CIDs.
2. Concatenate contract text + claim/defence + attachments URLs into a single prompt.
3. Call `chat.completions` **with function-calling**; expect a JSON object:

```json
{
  "amountToA": "4300.0",
  "amountToB": "700.0",
  "reasoningCid": "baf...",
  "shouldEscalate": false
}
```

4. Store reasoning as markdown, upload to IPFS, receive `reasoningCid`.
5. Generate `aiPropose` transaction using the smart contract interface and return it to both parties.

## Optional PostgreSQL Tables

```
agreements(id uuid PK, cid text, status text, created_at timestamptz)
invitations(id uuid PK, cid text, email text, redeemed bool, created_at timestamptz)
```

(Rely on CIDs as foreign keys to map on-chain IDs.)

## Security Notes

- Never hold private keys for Party A or B – only the mediator service key is stored server-side.
- Rate-limit `/ai-resolve` to avoid OpenAI abuse.
- Validate that the caller is indeed a signer of the on-chain Agreement via `flow scripts` before issuing transactions.

---

### Quick Start Commands

```
# Install deps
pnpm i

# Run dev server with auto-restart
tsx watch src/index.ts

# Run Jest tests
pnpm test
```
