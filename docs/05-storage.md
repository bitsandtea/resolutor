# Decentralized Storage Strategy (IPFS / Filecoin)

## Goals

- Permanently store the contract text, PDF, and all dispute evidence.
- Keep CIDs on-chain so state is auditable and immutable.
- Avoid self-hosting; leverage **web3.storage** backed by Filecoin deals.

---

## File Classes & Paths

| Label                           | Description                                         | Retention |
| ------------------------------- | --------------------------------------------------- | --------- |
| `contract.md`                   | Markdown version of the legal contract (plain-text) | forever   |
| `contract.pdf`                  | PDF version signed by both parties                  | forever   |
| `evidence/<cid>/<filename>`     | Each uploaded claim/defence file                    | forever   |
| `ai/rationale-<agreementId>.md` | Mediator explanation                                | forever   |

All files are uploaded individually so that each receives its own CID. A JSON manifest links them:

```json
{
  "contractMd": "bafy...",
  "contractPdf": "bafy...",
  "evidence": ["bafy...", "bafy..."],
  "aiRationale": null
}
```

This manifest's CID is what the smart contract stores in `agreementCID`.

---

## Upload Flow

1. Frontend chooses file(s) → POST `/upload` → backend streams to web3.storage.
2. Backend returns the resulting CID(s) to the frontend.
3. Once both parties sign, backend pins the manifest CID using `pinata.pinByCID` as secondary pin.
4. Smart contract `createAgreement` stores manifest CID.

---

## Gateway Access

Public read-only URLs take the form:

```
https://<cid>.ipfs.w3s.link/<filename>
```

These are inserted into the AI prompt so the model can fetch images when necessary.

---

## Privacy Considerations

- Content on IPFS is public; if privacy is required, symmetrically encrypt files before upload and share the AES key off-chain.
- For PDFs, add visible signatures but redact sensitive PII if unattainable.

---

## Local Dev Notes

- Use `npx w3 put ./file.pdf` to trial uploads.
- The Flow EVM environment cannot fetch HTTP, so unit tests should mock CID values rather than attempt retrieval.

---

## Cleanup Policy

The system **never deletes** data; contracts reference immutable CIDs. Versioning happens by pushing a new manifest and updating on-chain state (which is itself versioned by events).
