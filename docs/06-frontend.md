# Frontend & Wallet Integration

## Stack

- **Next.js 14** (App Router, React 18).
- **TypeScript strict** (no `any`).
- **Flow FCL** for wallet & transaction handling.
- **Tailwind CSS** for rapid UI.
- **zustand** for minimal state.

---

## Pages / Routes

| Path              | Purpose                                                                     |
| ----------------- | --------------------------------------------------------------------------- |
| `/`               | Landing: pick a contract template (Rental, Freelancer).                     |
| `/draft`          | Editor: fill variables (rent, term, deposit) → live preview markdown & PDF. |
| `/invite/[cid]`   | Counter-party view of draft → sign & deposit.                               |
| `/dashboard`      | List of active agreements with status badges.                               |
| `/agreement/[id]` | Detail: contract, chat, dispute, resolution timeline.                       |

---

## Component Checklist

1. **ContractForm** – dynamic template renderer.
2. **PdfPreview** – uses `react-pdf` to display generated PDF.
3. **IpfsUploader** – drag-and-drop files, shows CID on success.
4. **FlowSignerButton** – wraps FCL `mutate` / `query` calls and displays pending status.
5. **DisputePanel** – textarea + file upload for evidence.
6. **ResolutionCard** – shows AI proposal and buttons to approve/reject.

---

## Wallet Flow

1. On first load, call `fcl.authenticate()`; supported wallets: **Blocto**, **Lilico**, **Dapper Desktop**.
2. When backend returns `txB64`, invoke:

```ts
await fcl.send([fcl.transaction(txB64)]);
```

FCL decodes & re-signs; user approves in wallet dialog. 3. Subscribe to `fcl.tx(txId).onceSealed()` to update UI.

---

## Depositing Funds

- Show current FUSD balance via `fcl.query` script.
- On deposit step, call pre-built `depositAndActivate` transaction from backend with ERC20 token approval and transfer.

---

## Handling Disputes

- When `status == "Active"`, render **Open Dispute** button.
- After dispute, fetch evidence CIDs and render thumbnails using `https://{cid}.ipfs.w3s.link`.
- Poll `/ai-resolve` status every 30 s; when decision ready, show **ResolutionCard**.

---

## State Management

```ts
interface AgreementState {
  id: string;
  status: "Pending" | "Active" | "Disputed" | "Resolved";
  manifestCid: string;
  ...
}
```

Store minimal on-chain mirrors only; anything heavyweight stays in IPFS.

---

## CI & Linting

- `eslint`, `prettier`, `typescript` strict.
- `npm run test` executes Cypress e2e against Flow EVM environment + mocked backend.

---

## Local Dev

```
# Clone smart contracts & start Flow EVM environment
flow evm start --port 3569

# Start next dev
npm run dev
```

Environment variables required by the frontend are prefixed with `NEXT_PUBLIC_`:

```
NEXT_PUBLIC_FLOW_ACCESS_NODE=http://localhost:3569
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_IPFS_GATEWAY=https://w3s.link/ipfs/
```
