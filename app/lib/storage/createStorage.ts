import { switchChain } from "@wagmi/core";
import { decodeEventLog } from "viem";
import {
  useChainId,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { AgreementFactoryABI } from "../ABIs";
import { CONTRACT_ADDRESSES, MEDIATOR_ADDRESS, config } from "../wagmi";

interface CreateAgreementParams {
  partyA: `0x${string}`;
  mediator: `0x${string}`; // Optional, will use default if not provided
  depositA: bigint;
  depositB: bigint;
  token: `0x${string}`; // Optional, will use MOCK_ERC20 if not provided
  filecoinAccessControl: `0x${string}`;
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
        address: CONTRACT_ADDRESSES.AGREEMENT_FACTORY,
        abi: AgreementFactoryABI,
        functionName: "createAgreement",
        args: [
          params.partyA,
          params.mediator || MEDIATOR_ADDRESS,
          params.depositA,
          params.depositB,
          params.token || CONTRACT_ADDRESSES.MOCK_ERC20,
          CONTRACT_ADDRESSES.ACCESS_CONTROL,
        ],
      };
      console.log("Creating agreement with params:", sendParams);
      // Create the agreement using AgreementFactory
      const agreementResult = await writeContract(sendParams);

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
    receipt,
    isConfirming,
    isSuccess,
    contractAddress: getCreatedContractAddress(),
  };
};
