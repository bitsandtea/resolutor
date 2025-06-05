import OpenAI from "openai";
import { uploadJsonToIPFS } from "../ipfs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export interface TriageInput {
  agreementId: string;
  contractText: string;
  opener: string;
  evidence: {
    summary: string;
    files: Array<{ cid: string; filename: string; mimeType: string }>;
  };
}

export interface TriageDecision {
  action: "dismiss" | "proceed";
  reasoning: string;
}

export interface MediatorInput {
  agreementId: string;
  contractText: string;
  tokenSymbol: string;
  totalDeposit: number;
  opener: {
    summary: string;
    files: Array<{ cid: string; filename: string; mimeType: string }>;
  };
  counter: {
    summary: string;
    files: Array<{ cid: string; filename: string; mimeType: string }>;
  };
  initiatorProposedTx?: string;
}

export interface MediatorDecision {
  decision: "signInitiator" | "createNewTx" | "dismiss";
  initiatorTx?: string;
  newTx?: string;
  amountToA?: number;
  amountToB?: number;
  rationale: string;
}

export async function runTriage(input: TriageInput): Promise<TriageDecision> {
  const prompt = `
You are a legal AI mediator evaluating whether a dispute has merit.

### Contract
${input.contractText}

### Dispute Filed By: ${input.opener}
Summary: ${input.evidence.summary}
Files: ${input.evidence.files
    .map((f) => `${f.filename} (${f.mimeType})`)
    .join(", ")}

Evaluate if this dispute should proceed to full mediation or be dismissed early.
Consider: Is there a genuine breach? Are the claims substantiated? Is this frivolous?
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You are a fair legal mediator. Return only valid JSON.",
      },
      { role: "user", content: prompt },
    ],
    functions: [
      {
        name: "makeTriageDecision",
        description: "Make a triage decision on the dispute",
        parameters: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["dismiss", "proceed"] },
            reasoning: {
              type: "string",
              description: "Brief explanation for the decision",
            },
          },
          required: ["action", "reasoning"],
        },
      },
    ],
    function_call: { name: "makeTriageDecision" },
  });

  const result = response.choices[0]?.message?.function_call?.arguments;
  if (!result) throw new Error("No triage decision received");

  return JSON.parse(result) as TriageDecision;
}

export async function runMediator(
  input: MediatorInput
): Promise<MediatorDecision> {
  const prompt = `
You are a legal AI mediator making a final dispute resolution.

### Contract
${input.contractText}

Total Deposit: ${input.totalDeposit} ${input.tokenSymbol}

### Dispute Opener Evidence
Summary: ${input.opener.summary}
Files: ${input.opener.files
    .map((f) => `${f.filename} (${f.mimeType})`)
    .join(", ")}

### Counter Party Evidence  
Summary: ${input.counter.summary}
Files: ${input.counter.files
    .map((f) => `${f.filename} (${f.mimeType})`)
    .join(", ")}

${
  input.initiatorProposedTx
    ? `### Proposed Transaction\n${input.initiatorProposedTx}`
    : ""
}

Make your decision:
- signInitiator: Approve the dispute opener's proposed transaction
- createNewTx: Create a new transaction with different amounts  
- dismiss: Close the dispute without any transaction
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You are a fair legal mediator. Output must be valid JSON.",
      },
      { role: "user", content: prompt },
    ],
    functions: [
      {
        name: "makeFinalDecision",
        description: "Make the final mediation decision",
        parameters: {
          type: "object",
          properties: {
            decision: {
              type: "string",
              enum: ["signInitiator", "createNewTx", "dismiss"],
            },
            initiatorTx: {
              type: "string",
              description: "Required if signInitiator",
            },
            newTx: { type: "string", description: "Required if createNewTx" },
            amountToA: {
              type: "number",
              description: "Required if createNewTx",
            },
            amountToB: {
              type: "number",
              description: "Required if createNewTx",
            },
            rationale: {
              type: "string",
              description: "Explanation for the decision",
            },
          },
          required: ["decision", "rationale"],
        },
      },
    ],
    function_call: { name: "makeFinalDecision" },
  });

  const result = response.choices[0]?.message?.function_call?.arguments;
  if (!result) throw new Error("No mediation decision received");

  const decision = JSON.parse(result) as MediatorDecision;

  // Upload rationale to IPFS
  const rationaleJson = {
    decision: decision.decision,
    rationale: decision.rationale,
    timestamp: new Date().toISOString(),
    agreementId: input.agreementId,
  };

  await uploadJsonToIPFS(rationaleJson);

  return decision;
}
