import OpenAI from "openai";
import {
  fetchIpfsContent,
  getIpfsContentType,
  getIpfsGatewayUrl,
  uploadJsonToIPFS,
} from "../ipfs";
import {
  MEDIATOR_SYSTEM_PROMPT,
  MEDIATOR_USER_PROMPT_TEMPLATE,
} from "./prompts";

// MASAI AI client
const masai = new OpenAI({
  apiKey: process.env.MOSAIA_API_KEY!,
  baseURL: "https://api.mosaia.ai/v1/agent",
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

type MessageContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

async function getEvidenceContent(
  cids: string[]
): Promise<MessageContentPart[]> {
  if (!cids || cids.length === 0) {
    return [];
  }

  const contentPromises = cids.map(async (cid) => {
    try {
      const contentType = await getIpfsContentType(cid);
      if (contentType && contentType.startsWith("image/")) {
        return {
          type: "image_url" as const,
          image_url: { url: getIpfsGatewayUrl(cid) },
        };
      } else {
        const textContent = await fetchIpfsContent(cid);
        return {
          type: "text" as const,
          text: `\n\n--- Evidence File (CID: ${cid}) ---\n${textContent}\n--- End of Evidence File (CID: ${cid}) ---`,
        };
      }
    } catch (error) {
      console.error(`Failed to fetch content for CID ${cid}:`, error);
      return {
        type: "text" as const,
        text: `\n\n--- Evidence File (CID: ${cid}) ---\n[Error fetching content]\n--- End of Evidence File (CID: ${cid}) ---`,
      };
    }
  });

  return Promise.all(contentPromises);
}

export async function runMediator(
  input: MediatorInput
): Promise<MediatorDecision> {
  console.log("--- STARTING MEDIATION ---");
  console.log("Input:", JSON.stringify(input, null, 2));

  try {
    // Get evidence content
    const openerEvidence = await getEvidenceContent(input.opener.cids);
    const responderEvidence = await getEvidenceContent(
      input.responder?.cids || []
    );

    // Build party statements
    const partyAStatement =
      input.opener.address === input.partyA_address
        ? input.opener.summary
        : input.responder?.summary ?? "No response";

    const partyBStatement =
      input.opener.address === input.partyB_address
        ? input.opener.summary
        : input.responder?.summary ?? "No response";

    // Format prompt
    const textPrompt = await MEDIATOR_USER_PROMPT_TEMPLATE.format({
      contract: input.contractText,
      proposedResolution: input.opener.proposedResolution,
      partyAStatement: partyAStatement,
      partyBResponse: partyBStatement,
    });

    const userMessageContent: MessageContentPart[] = [
      { type: "text", text: textPrompt },
      ...openerEvidence,
      ...responderEvidence,
    ];

    console.log("--- PROMPT SENT TO MASAI AI ---");
    console.log(JSON.stringify(userMessageContent, null, 2));
    console.log("--- MASAI AI CONFIG ---");
    console.log("API Key exists:", !!process.env.MOSAIA_API_KEY);
    console.log("Base URL:", "https://api.mosaia.ai/v1/agent");
    console.log("Model:", "6867141eeadcd2842e01594b");

    // Call MASAI AI
    const response = await masai.chat.completions.create({
      model: "6867141eeadcd2842e01594b",
      messages: [
        {
          role: "system",
          content: MEDIATOR_SYSTEM_PROMPT,
        },
        { role: "user", content: userMessageContent },
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

    console.log("--- FULL MASAI AI RESPONSE ---");
    console.log(JSON.stringify(response, null, 2));

    // MASAI AI returns JSON in content field, not function_call
    const result =
      response.choices[0]?.message?.function_call?.arguments ||
      response.choices[0]?.message?.content;

    console.log("--- RESPONSE CONTENT ---");
    console.log(result);

    if (!result) {
      console.log("--- NO RESPONSE FOUND ---");
      console.log("Response choices:", response.choices);
      console.log("First choice message:", response.choices[0]?.message);
      throw new Error("No mediation decision received");
    }

    // Clean up response - remove markdown code blocks if present
    let cleanedResult = result;
    if (typeof result === "string") {
      // Remove markdown code blocks (```json ... ```)
      cleanedResult = result.replace(/```json\s*|\s*```/g, "").trim();
      // Remove any remaining backticks
      cleanedResult = cleanedResult.replace(/^`+|`+$/g, "").trim();
    }

    console.log("--- CLEANED RESPONSE ---");
    console.log(cleanedResult);

    const decision = JSON.parse(cleanedResult) as MediatorDecision;

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

    console.log("--- MEDIATION COMPLETED ---");
    console.log("Decision:", decision);

    return decision;
  } catch (error) {
    console.error("--- MEDIATION ERROR ---");
    console.error("Error in runMediator:", error);
    throw error;
  }
}
