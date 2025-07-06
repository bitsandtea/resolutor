import OpenAI from "openai";
import { fetchIpfsContent, uploadJsonToIPFS } from "../ipfs";
import {
  MEDIATOR_SYSTEM_PROMPT,
  MEDIATOR_USER_PROMPT_TEMPLATE,
} from "./prompts";

const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_API_KEY!,
});

export interface MediatorInput {
  agreementId: string;
  contractText: string;
  partyA_address: string | null | undefined;
  partyB_address: string | null | undefined;
  opener: {
    address: string;
    summary: string;
    cids: string[];
    proposedResolution: string;
  };
  responder?: {
    summary: string;
    cids: string[];
  };
}

export interface MediatorDecision {
  decision: "approveResolution" | "doNothing" | "proposeResolution";
  rationale: string;
  amountToA?: number;
  amountToB?: number;
}

async function getEvidenceContent(cids: string[]): Promise<string> {
  if (!cids || cids.length === 0) {
    return "No evidence provided.";
  }

  const contentPromises = cids.map(async (cid, index) => {
    try {
      const content = await fetchIpfsContent(cid);
      return `--- Evidence File ${
        index + 1
      } (CID: ${cid}) ---\n${content}\n--- End of Evidence File ${
        index + 1
      } ---`;
    } catch (error) {
      console.error(`Failed to fetch content for CID ${cid}:`, error);
      return `--- Evidence File ${
        index + 1
      } (CID: ${cid}) ---\n[Error fetching content]\n--- End of Evidence File ${
        index + 1
      } ---`;
    }
  });

  const contents = await Promise.all(contentPromises);
  return contents.join("\n\n");
}

export async function runMediator(
  input: MediatorInput
): Promise<MediatorDecision> {
  const openerEvidence = await getEvidenceContent(input.opener.cids);
  const responderEvidence = await getEvidenceContent(
    input.responder?.cids || []
  );

  const partyAStatement =
    input.opener.address === input.partyA_address
      ? `${input.opener.summary}\n\n${openerEvidence}`
      : `${input.responder?.summary ?? "No response"}\n\n${responderEvidence}`;

  const partyBStatement =
    input.opener.address === input.partyB_address
      ? `${input.opener.summary}\n\n${openerEvidence}`
      : `${input.responder?.summary ?? "No response"}\n\n${responderEvidence}`;

  const prompt = await MEDIATOR_USER_PROMPT_TEMPLATE.format({
    contract: input.contractText,
    proposedResolution: input.opener.proposedResolution,
    partyAStatement: partyAStatement,
    partyBResponse: partyBStatement,
  });

  console.log("--- PROMPT SENT TO OPENAI ---");
  console.log(prompt);
  console.log("----------------------------");

  const response = await openai.chat.completions.create({
    model: "gpt-4.1",
    messages: [
      {
        role: "system",
        content: MEDIATOR_SYSTEM_PROMPT,
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
              enum: ["approveResolution", "doNothing", "proposeResolution"],
            },
            amountToA: {
              type: "number",
              description: "Required if decision is proposeResolution",
            },
            amountToB: {
              type: "number",
              description: "Required if decision is proposeResolution",
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

  console.log("--- RESPONSE FROM OPENAI ---");
  console.log(result);
  console.log("----------------------------");

  if (!result) throw new Error("No mediation decision received");

  const decision = JSON.parse(result) as MediatorDecision;

  // Upload rationale to IPFS
  const rationaleJson = {
    decision: decision.decision,
    rationale: decision.rationale,
    timestamp: new Date().toISOString(),
    agreementId: input.agreementId,
    ...(decision.decision === "proposeResolution" && {
      amountToA: decision.amountToA,
      amountToB: decision.amountToB,
    }),
  };

  await uploadJsonToIPFS(rationaleJson);

  return decision;
}
