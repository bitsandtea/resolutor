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
  agreementId: `0x${string}`;
  partyA: `0x${string}`;
  mediator: `0x${string}`;
  depositA: bigint;
  depositB: bigint;
  token: `0x${string}`;
  filecoinAccessControl: `0x${string}`;
  signOnCreate: boolean;
  fileCid?: string;
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

  const getCreatedAgreementId = (): string | null => {
    if (!receipt || !receipt.logs) return null;

    try {
      for (const log of receipt.logs) {
        try {
          const decodedLog = decodeEventLog({
            abi: AgreementFactoryABI,
            data: log.data,
            topics: log.topics,
          });

          if (decodedLog.eventName === "AgreementCreated" && decodedLog.args) {
            return (decodedLog.args as any).agreementId.toString();
          }
        } catch (e) {
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
        chainId: Number(
          process.env.NEXT_PUBLIC_FILECOIN_CALIBRATION_CHAIN_ID || "314159"
        ) as 314159,
        functionName: "storeFile",
        args: [params.fileCid, params.agreementId],
      };
      console.log("Storing file in createStorage", storeFileParams);

      const storeFileResult = await writeContract(storeFileParams);
      return storeFileResult;
    } catch (error) {
      console.error("Error storing file:", error);
      // Re-throw the error with a more descriptive message
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (
        errorMessage.includes("execution reverted") ||
        errorMessage.includes("reverted")
      ) {
        throw new Error(
          "Contract execution failed: The file may already exist or access control failed"
        );
      } else if (errorMessage.includes("User rejected")) {
        throw new Error("Transaction rejected by user");
      } else if (errorMessage.includes("insufficient funds")) {
        throw new Error("Insufficient funds for transaction");
      }
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
      const sendParams = {
        address:
          (process.env.NEXT_PUBLIC_MULTISIG_ADDRESS as `0x${string}`) ||
          CONTRACT_ADDRESSES.ESCROW_CONTRACT,
        abi: AgreementFactoryABI,
        functionName: "createAgreement",
        args: [
          params.agreementId,
          params.partyA,
          params.mediator || MEDIATOR_ADDRESS,
          params.depositA,
          params.depositB,
          params.token || CONTRACT_ADDRESSES.MOCK_ERC20,
          params.filecoinAccessControl,
          params.signOnCreate,
        ],
      };

      console.log(
        `Using createAgreement - Create and Sign in one transaction!`,
        sendParams
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
    agreementId: getCreatedAgreementId(),
  };
};
