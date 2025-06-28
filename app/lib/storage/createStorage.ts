import { switchChain, writeContract } from "@wagmi/core";
import { useChainId, useWriteContract } from "wagmi";
import { AgreementFactoryABI } from "../ABIs";
import { CONTRACT_ADDRESSES, MEDIATOR_ADDRESS, config } from "../wagmi";

interface CreateAgreementParams {
  partyA: `0x${string}`;
  partyB: `0x${string}`;
  mediator?: `0x${string}`; // Optional, will use default if not provided
  depositA: bigint;
  depositB: bigint;
  token?: `0x${string}`; // Optional, will use MOCK_ERC20 if not provided
  manifestCid: string;
}

export const createAgreementStorage = async ({
  partyA,
  partyB,
  mediator = MEDIATOR_ADDRESS,
  depositA,
  depositB,
  token = CONTRACT_ADDRESSES.MOCK_ERC20,
  manifestCid,
}: CreateAgreementParams) => {
  try {
    console.log("Contract Addresses:", CONTRACT_ADDRESSES);
    if (!CONTRACT_ADDRESSES.AGREEMENT_FACTORY) {
      throw new Error("AGREEMENT_FACTORY address not configured");
    }

    // Create the agreement using AgreementFactory
    const agreementResult = await writeContract(config, {
      address: CONTRACT_ADDRESSES.AGREEMENT_FACTORY,
      abi: AgreementFactoryABI,
      functionName: "createAgreement",
      args: [partyA, partyB, mediator, depositA, depositB, token, manifestCid],
    });

    return {
      agreementTxHash: agreementResult,
      success: true,
    };
  } catch (error) {
    console.error("Error creating agreement storage:", error);
    throw error;
  }
};

// React hook for component usage
export const useCreateAgreement = () => {
  const { writeContract, isPending, error, data: txHash } = useWriteContract();
  const chainId = useChainId();

  const createAgreement = async (params: CreateAgreementParams) => {
    if (chainId !== Number(process.env.NEXT_PUBLIC_FLOW_EVM_TESTNET_CHAIN_ID)) {
      console.log("Switching chain to Flow EVM Testnet");
      await switchChain(config, {
        chainId: Number(
          process.env.NEXT_PUBLIC_FLOW_EVM_TESTNET_CHAIN_ID || "545"
        ) as 545,
      });
      // Wait a moment for the chain switch to fully complete
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    try {
      console.log("Creating agreement with params:", {
        address: CONTRACT_ADDRESSES.AGREEMENT_FACTORY,
        abi: AgreementFactoryABI,
        functionName: "createAgreement",
        args: [
          params.partyA,
          params.partyB,
          params.mediator || MEDIATOR_ADDRESS,
          params.depositA,
          params.depositB,
          params.token || CONTRACT_ADDRESSES.MOCK_ERC20,
          params.manifestCid,
        ],
      });
      // Create the agreement using AgreementFactory
      const agreementResult = await writeContract({
        address: CONTRACT_ADDRESSES.AGREEMENT_FACTORY,
        chainId: Number(
          process.env.NEXT_PUBLIC_FLOW_EVM_TESTNET_CHAIN_ID || "545"
        ) as 545,
        abi: AgreementFactoryABI,
        functionName: "createAgreement",
        args: [
          params.partyA,
          params.partyB,
          params.mediator || MEDIATOR_ADDRESS,
          params.depositA,
          params.depositB,
          params.token || CONTRACT_ADDRESSES.MOCK_ERC20,
          params.manifestCid,
        ],
      });

      return agreementResult;
    } catch (error) {
      console.error("Error creating agreement:", error);
      throw error;
    }
  };

  return {
    createAgreement,
    isPending,
    error,
    txHash,
  };
};

// // Hook for granting access (separate transaction)
// export const useGrantAccess = () => {
//   const { writeContract, isPending, error } = useWriteContract();

//   const grantAccess = async (agreementId: string, partyA: `0x${string}`) => {
//     try {
//       if (!CONTRACT_ADDRESSES.ACCESS_CONTROL) {
//         throw new Error("ACCESS_CONTROL address not configured");
//       }

//       const result = await writeContract({
//         address: CONTRACT_ADDRESSES.ACCESS_CONTROL,
//         abi: AccessControlABI,
//         functionName: "grantAccess",
//         args: [agreementId, partyA, MEDIATOR_ADDRESS],
//       });

//       return result;
//     } catch (error) {
//       console.error("Error granting access:", error);
//       throw error;
//     }
//   };

//   return {
//     grantAccess,
//     isPending,
//     error,
//   };
// };

export default createAgreementStorage;
