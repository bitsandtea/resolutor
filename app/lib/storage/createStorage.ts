import { switchChain } from "@wagmi/core";
import { decodeEventLog } from "viem";
import {
  useChainId,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { AccessControlABI, AgreementFactoryABI } from "../ABIs";
import { CONTRACT_ADDRESSES, MEDIATOR_ADDRESS, config } from "../wagmi";

interface CreateAgreementParams {
  partyA: `0x${string}`;

  partyB?: `0x${string}`; // Optional - if provided, will use createAndSignAgreement
  mediator: `0x${string}`; // Optional, will use default if not provided
  depositA: bigint;
  depositB: bigint;
  token: `0x${string}`; // Optional, will use MOCK_ERC20 if not provided
  filecoinAccessControl: `0x${string}`;
  fileCid?: string; // Optional IPFS hash to store after agreement creation
  agreementId?: string; // Optional agreement ID for file storage
}

interface StoreFileParams {
  fileCid: string;
  agreementId: string;
}

// React hook for component usage
export const useCreateAgreement = () => {
  const { writeContract, isPending, error, data: txHash } = useWriteContract();
  const chainId = useChainId();

  // Wait for transaction receipt
  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess,
  } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Extract contract address from receipt
  const getCreatedContractAddress = (): `0x${string}` | null => {
    if (!receipt || !receipt.logs) return null;

    try {
      // Find the AgreementCreated event in the logs
      for (const log of receipt.logs) {
        try {
          const decodedLog = decodeEventLog({
            abi: AgreementFactoryABI,
            data: log.data,
            topics: log.topics,
          });

          // Check if this is the AgreementCreated event
          if (decodedLog.eventName === "AgreementCreated" && decodedLog.args) {
            // The first argument is the contract address
            return (decodedLog.args as any).contractAddr as `0x${string}`;
          }
        } catch (e) {
          // Skip logs that can't be decoded with our ABI
          continue;
        }
      }
    } catch (error) {
      console.error("Error parsing transaction logs:", error);
    }

    return null;
  };

  const storeFile = async (params: StoreFileParams) => {
    if (
      chainId !== Number(process.env.NEXT_PUBLIC_FILECOIN_CALIBRATION_CHAIN_ID)
    ) {
      console.log(
        "Switching chain to Filecoin Calibration Chain for file storage"
      );
      await switchChain(config, {
        chainId: Number(
          process.env.NEXT_PUBLIC_FILECOIN_CALIBRATION_CHAIN_ID || "314159"
        ) as 314159,
      });
      // Wait a moment for the chain switch to fully complete
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    try {
      const storeFileParams = {
        address: CONTRACT_ADDRESSES.ACCESS_CONTROL,
        abi: AccessControlABI,
        functionName: "storeFile",
        args: [params.fileCid, params.agreementId],
      };

      const storeFileResult = await writeContract(storeFileParams);
      return storeFileResult;
    } catch (error) {
      console.error("Error storing file:", error);
      throw error;
    }
  };

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
      // Always use createAndSignAgreement for optimized one-transaction flow
      // Pass address(0) for partyB if unknown - they can join later via signContract
      const partyBAddress =
        params.partyB &&
        params.partyB !== "0x0000000000000000000000000000000000000000"
          ? params.partyB
          : ("0x0000000000000000000000000000000000000000" as `0x${string}`);

      const sendParams = {
        address: CONTRACT_ADDRESSES.AGREEMENT_FACTORY,
        abi: AgreementFactoryABI,
        functionName: "createAndSignAgreement",
        args: [
          params.partyA,
          partyBAddress,
          params.mediator || MEDIATOR_ADDRESS,
          params.depositA,
          params.depositB,
          params.token || CONTRACT_ADDRESSES.MOCK_ERC20,
          CONTRACT_ADDRESSES.ACCESS_CONTROL,
        ],
      };

      console.log(
        `Using createAndSignAgreement - Create and Sign in one transaction!${
          partyBAddress === "0x0000000000000000000000000000000000000000"
            ? " (PartyB will join later)"
            : " (Both parties known)"
        }`
      );

      // Create the agreement using AgreementFactory
      const agreementResult = await writeContract(sendParams);

      // If fileCid and agreementId are provided, store the file after agreement creation
      if (params.fileCid && params.agreementId) {
        console.log("Storing file after agreement creation");
        await storeFile({
          fileCid: params.fileCid,
          agreementId: params.agreementId,
        });
      }

      return agreementResult;
    } catch (error) {
      console.error("Error creating agreement:", error);
      throw error;
    }
  };

  return {
    createAgreement,
    storeFile,
    isPending,
    error,
    txHash,
    receipt,
    isConfirming,
    isSuccess,
    contractAddress: getCreatedContractAddress(),
  };
};
