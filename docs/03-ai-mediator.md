# AI Mediator Agent Specification

## Purpose

Provide an impartial, automated third signature in the **2-of-3 multisig** workflow. The agent reads the contract, parses evidence from both parties, and decides:

- Accept one side's proposal.
- Offer a counter-proposal.
- Flag that human review is required.

The agent never pushes a transaction directly—it returns JSON that the backend wraps into an EVM transaction for the parties to sign.

---

## Runtime

- Language: **TypeScript (Node.js 20+)**.
- Framework: `openai` npm client.
- Model: `gpt-4o-mini` (or highest model your token allows).

---

## Input Schema (passed to `runMediator()`)

```ts
interface EvidenceFile {
  cid: string; // IPFS CID, immutable
  filename: string; // eg. "receipt.pdf"
  mimeType: string; // "application/pdf"
}

interface PartyEvidence {
  summary: string; // plain-text summary written by the party
  files: EvidenceFile[];
}

export interface MediatorInput {
  agreementId: string; // on-chain id
  contractText: string; // markdown
  tokenSymbol: string; // "FUSD"
  totalDeposit: number; // e.g. 5000.0
  partyA: PartyEvidence;
  partyB: PartyEvidence;
}
```

## Output Schema

```ts
export interface MediatorDecision {
  decision: "A" | "B" | "Split" | "Escalate";
  amountToA?: number; // required if decision is A or Split
  amountToB?: number; // required if decision is B or Split
  rationale: string; // markdown explanation (<2k tokens)
}
```

Returned object is stringified JSON so the backend can validate easily.

---

## Prompt Engineering

```
System: "You are a legally-aware mediator. Your task is to suggest a fair financial resolution under the given contract. The agreement is denominated in {tokenSymbol}. The total deposit is {totalDeposit}. You must output strictly valid JSON adhering to the function signature 'issueDecision'."

User: "### Contract\n{contractText}\n\n### Party A Evidence\n{partyA.summary}\nFiles: {list partyA.files}\n\n### Party B Evidence\n{partyB.summary}\nFiles: {list partyB.files}"
```

Add an **OpenAI function definition** named `issueDecision` with parameters identical to `MediatorDecision`. The function-calling feature ensures valid JSON.

---

## Flow of Control

1. Backend prepares a `MediatorInput` object, expands IPFS CIDs into public gateway URLs for viewing.
2. Backend calls `runMediator(input)`.
3. `runMediator` builds the prompt + function definition, calls `openai.chat.completions`.
4. Validate the response **against Zod schema** to guarantee types.
5. Upload the rationale markdown to IPFS → get `reasonCid`.
6. Pass `{amountToA, amountToB, reasonCid}` into the transaction generator.

---

## Guardrails

- If the model returns `Escalate`, backend skips transaction generation and notifies both parties.
- Token amounts must sum to `totalDeposit` and be multiples of `0.01`.
- Rationale capped at 2 000 tokens to control cost on later reads.

---

## Local Testing

```
# .env must contain OPENAI_API_KEY
pnpm ts-node src/mediator/run-demo.ts ./samples/dispute.json
```

The demo script prints decision JSON and uploads the rationale to web3.storage.
