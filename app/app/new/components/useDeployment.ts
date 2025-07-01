import { CONTRACT_ADDRESSES } from "@/lib/chain-config";
import { useCreateAccessControl } from "@/lib/storage/createAccess";
import { useCreateAgreement } from "@/lib/storage/createStorage";
import { config } from "@/lib/wagmi";
import {
  BlockchainDeploymentState,
  DeploymentStepName,
  DeploymentStepStatus,
} from "@/types";
import { switchChain } from "@wagmi/core";
import { useEffect, useState } from "react";
import { parseEther } from "viem";
import { useAccount, useChainId, useWaitForTransactionReceipt } from "wagmi";
import { stepDefinitions, stepOrder } from "./deploymentSteps";

// Chain requirements for each deployment step
const STEP_CHAIN_REQUIREMENTS: Record<DeploymentStepName, number | null> = {
  ipfs_upload: null, // No specific chain required
  filecoin_access_deploy: Number(
    process.env.NEXT_PUBLIC_FILECOIN_CALIBRATION_CHAIN_ID || "314159"
  ),
  filecoin_store_file: Number(
    process.env.NEXT_PUBLIC_FILECOIN_CALIBRATION_CHAIN_ID || "314159"
  ),
  flow_deploy: Number(
    process.env.NEXT_PUBLIC_FLOW_EVM_TESTNET_CHAIN_ID || "545"
  ), // Flow Testnet
  db_save: null, // No specific chain required
};

// Helper functions for chain management
const getRequiredChainForStep = (
  stepName: DeploymentStepName
): number | null => {
  return STEP_CHAIN_REQUIREMENTS[stepName];
};

const getNextStepAfter = (
  currentStep: DeploymentStepName
): DeploymentStepName | null => {
  const currentIndex = stepOrder.indexOf(currentStep);
  if (currentIndex === -1 || currentIndex === stepOrder.length - 1) {
    return null;
  }
  return stepOrder[currentIndex + 1];
};

const checkAndSwitchChainForStep = async (
  stepName: DeploymentStepName,
  currentChainId: number
): Promise<boolean> => {
  const requiredChainId = getRequiredChainForStep(stepName);

  if (!requiredChainId || currentChainId === requiredChainId) {
    return true; // Already on correct chain or no specific chain required
  }

  try {
    console.log(`Switching chain to ${requiredChainId} for step ${stepName}`);
    await switchChain(config, { chainId: requiredChainId as any });
    return true;
  } catch (error) {
    console.error(`Failed to switch chain for step ${stepName}:`, error);
    return false;
  }
};

const handleStepCompletion = async (
  completedStep: DeploymentStepName,
  currentChainId: number,
  onError: (error: string) => void
): Promise<void> => {
  const nextStep = getNextStepAfter(completedStep);

  if (nextStep) {
    try {
      const switchSuccess = await checkAndSwitchChainForStep(
        nextStep,
        currentChainId
      );
      if (!switchSuccess) {
        onError(
          `Failed to switch to required chain for next step: ${nextStep}`
        );
      }
    } catch (error) {
      console.error("Error during chain switching:", error);
      onError(
        `Chain switching error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
};

interface UseDeploymentProps {
  agreementId: string;
  contractContent: string;
  fileName: string;
  onComplete: (deploymentState: BlockchainDeploymentState) => void;
  onError: (error: string) => void;
}

export const useDeployment = ({
  agreementId,
  contractContent,
  fileName,
  onComplete,
  onError,
}: UseDeploymentProps) => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const {
    createAgreement,
    storeFile,
    isPending: isCreatingAgreement,
    error: createError,
    txHash: flowTxHash,
    isSuccess: isFlowSuccess,
    contractAddress: flowContractAddress,
  } = useCreateAgreement();
  const {
    createAccessControl,
    isPending: isCreatingAccess,
    error: accessError,
    txHash: accessTxHash,
  } = useCreateAccessControl();

  const [deploymentState, setDeploymentState] =
    useState<BlockchainDeploymentState | null>(null);
  const [currentStep, setCurrentStep] = useState<
    DeploymentStepName | "completed" | null
  >(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [canRetry, setCanRetry] = useState(false);
  const [pendingTxHash, setPendingTxHash] = useState<string | null>(null);
  const [lastPolledTime, setLastPolledTime] = useState<number>(0);

  const { isLoading: isTxPending } = useWaitForTransactionReceipt({
    hash: (accessTxHash || flowTxHash || pendingTxHash) as `0x${string}`,
    query: { enabled: !!(accessTxHash || flowTxHash || pendingTxHash) },
  });

  // Separate transaction tracking for each step
  const { isSuccess: isAccessTxSuccess } = useWaitForTransactionReceipt({
    hash: accessTxHash as `0x${string}`,
    query: {
      enabled: !!accessTxHash && currentStep === "filecoin_access_deploy",
    },
  });

  const { isSuccess: isStoreTxSuccess } = useWaitForTransactionReceipt({
    hash: flowTxHash as `0x${string}`,
    query: { enabled: !!flowTxHash && currentStep === "filecoin_store_file" },
  });

  const { isSuccess: isFlowDeploySuccess } = useWaitForTransactionReceipt({
    hash: flowTxHash as `0x${string}`,
    query: { enabled: !!flowTxHash && currentStep === "flow_deploy" },
  });

  const updateDeploymentStep = async (
    stepName: string,
    status: string,
    txHash?: string,
    contractAddr?: string,
    errorMessage?: string
  ) => {
    try {
      const response = await fetch("/api/update-deployment-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agreementId,
          stepName,
          status,
          txHash,
          contractAddr,
          errorMessage,
        }),
      });

      const result = await response.json();
      if (!result.success) {
        console.error("Failed to update deployment step:", result.error);
      }
      return result.success;
    } catch (error) {
      console.error("Error updating deployment step:", error);
      return false;
    }
  };

  const checkDeploymentStatus = async (forceRefresh = false) => {
    try {
      // Add throttling to prevent excessive API calls
      const now = Date.now();
      if (!forceRefresh && now - lastPolledTime < 2000) {
        return deploymentState;
      }
      setLastPolledTime(now);

      const response = await fetch(
        `/api/deployment-status?agreementId=${encodeURIComponent(agreementId)}`,
        {
          method: "GET",
        }
      );

      const data = await response.json();
      if (data.success) {
        if (data.currentState) {
          setDeploymentState(data.currentState);

          // Update current step based on deployment state
          if (data.isComplete) {
            setCurrentStep("completed");
            setIsProcessing(false);
          }
        }

        if (data.isComplete && !isProcessing) {
          onComplete(data.currentState);
        } else if (data.currentState?.processStatus === "failed") {
          setIsProcessing(false);
          setCanRetry(true);
        }

        return data;
      } else {
        throw new Error(data.error || "Failed to check deployment status");
      }
    } catch (error) {
      console.error("Error checking deployment status:", error);
      return null;
    }
  };

  const executeStep = async (stepName: DeploymentStepName) => {
    setCurrentStep(stepName);
    setIsProcessing(true);

    const stepDef = stepDefinitions[stepName as keyof typeof stepDefinitions];
    if (!stepDef) {
      return;
    }

    let requestPayload: Record<string, unknown> = {};

    try {
      let response;
      if (stepName === "ipfs_upload") {
        const currentStatus = await checkDeploymentStatus(true);
        if (currentStatus?.currentState?.cid) {
          // CID already exists, stop processing to allow manual progression
          setIsProcessing(false);
          return;
        }

        requestPayload = {
          agreementId,
          content: contractContent,
          fileName,
          fileType: "contract_unsigned",
        };

        response = await fetch("/api/upload-ipfs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestPayload),
        });
      } else if (stepName === "filecoin_access_deploy") {
        // Chain switching is now handled automatically after step completion

        if (!isConnected || !address) {
          throw new Error(
            "Wallet not connected. Please connect your wallet first."
          );
        }

        // Mark step as in progress
        await updateDeploymentStep("filecoin_access_deploy", "in_progress");

        try {
          await createAccessControl(
            agreementId,
            address || "",
            process.env.NEXT_PUBLIC_MEDIATOR_ADDRESS || ""
          );

          // Don't mark as completed here - let the useEffect handle transaction confirmation
          // The transaction success will be handled by the useEffect that watches isAccessTxSuccess
          setIsProcessing(false); // Allow manual progression while waiting for confirmation

          return { success: true, txHash: "pending" };
        } catch (walletError) {
          await updateDeploymentStep(
            "filecoin_access_deploy",
            "failed",
            undefined,
            undefined,
            `Wallet transaction failed: ${walletError}`
          );
          throw new Error(`Wallet transaction failed: ${walletError}`);
        }
      } else if (stepName === "filecoin_store_file") {
        // Chain switching is now handled automatically after step completion

        if (!isConnected || !address) {
          throw new Error(
            "Wallet not connected. Please connect your wallet first."
          );
        }

        // Get the current deployment state to get the CID
        const currentStatus = await checkDeploymentStatus(true);
        if (!currentStatus?.currentState?.cid) {
          throw new Error(
            "IPFS CID not found. Please complete IPFS upload first."
          );
        }

        // Mark step as in progress
        await updateDeploymentStep("filecoin_store_file", "in_progress");

        try {
          console.log("Storing file in useDeployment", {
            fileCid: currentStatus.currentState.cid,
            agreementId: agreementId,
          });

          await storeFile({
            fileCid: currentStatus.currentState.cid,
            agreementId: agreementId,
          });

          // The transaction hash will be available via flowTxHash from the shared writeContract hook
          // The useEffect below will handle updating the step with the transaction hash

          // Don't mark as completed here - let the useEffect handle transaction confirmation
          setIsProcessing(false);

          return { success: true, txHash: "pending" };
        } catch (walletError) {
          const errorMessage =
            walletError instanceof Error
              ? walletError.message
              : String(walletError);
          console.error("Filecoin store file error:", walletError);

          // Check for specific error types
          let displayError = errorMessage;
          if (errorMessage.includes("execution reverted")) {
            displayError =
              "Transaction reverted. The file may already exist or access control failed.";
          } else if (errorMessage.includes("User rejected")) {
            displayError = "Transaction rejected by user.";
          } else if (errorMessage.includes("insufficient funds")) {
            displayError = "Insufficient funds for transaction.";
          }

          await updateDeploymentStep(
            "filecoin_store_file",
            "failed",
            undefined,
            undefined,
            displayError
          );

          // Ensure retry state is set
          setIsProcessing(false);
          setCanRetry(true);

          // Force refresh deployment status to show failed state
          await checkDeploymentStatus(true);

          throw new Error(displayError);
        }
      } else if (stepName === "flow_deploy") {
        if (!isConnected || !address) {
          throw new Error(
            "Wallet not connected. Please connect your wallet first."
          );
        }

        const currentState = await checkDeploymentStatus(true);
        if (!currentState?.currentState?.cid) {
          throw new Error(
            "IPFS CID not found. Please complete IPFS upload first."
          );
        }

        try {
          // Fetch actual deposit amounts and signer data from the database
          const agreementResponse = await fetch(
            `/api/contracts/${agreementId}`
          );
          if (!agreementResponse.ok) {
            throw new Error("Failed to fetch agreement data");
          }
          const agreementData = await agreementResponse.json();
          if (!agreementData.success) {
            throw new Error(agreementData.error || "Failed to load agreement");
          }

          const { depositA, depositB, signersData } = agreementData.agreement;

          // Parse signers data to get partyB address if available
          let partyBAddress: `0x${string}` | undefined;
          if (signersData) {
            try {
              const signers = JSON.parse(signersData);
              const otherSigner = signers.find((s: any) => s.role === "signer");
              // For demo purposes, we'll use a test address if partyB email is provided
              // In production, you'd look up the actual wallet address from email
              if (otherSigner?.email && otherSigner.email !== address) {
                // This is a placeholder - in real implementation you'd resolve email to wallet address
                partyBAddress =
                  "0x0000000000000000000000000000000000000000" as `0x${string}`;
              }
            } catch (e) {
              console.warn("Failed to parse signers data:", e);
            }
          }

          const createParams = {
            partyA: address,
            ...(partyBAddress && { partyB: partyBAddress }),
            mediator:
              (process.env.NEXT_PUBLIC_MEDIATOR_ADDRESS as `0x${string}`) || "",
            depositA: parseEther(depositA.toString()),
            depositB: parseEther(depositB.toString()),
            token: CONTRACT_ADDRESSES[545].MOCK_ERC20,
            filecoinAccessControl:
              (process.env
                .NEXT_PUBLIC_ACCESS_CONTROL_ADDRESS as `0x${string}`) || "",
          };

          console.log("createParams", createParams);

          await createAgreement(createParams);

          // Don't return immediately - let the useEffect handle transaction completion
          // The transaction success will be handled by the useEffect that watches isFlowDeploySuccess
          return;
        } catch (walletError) {
          throw new Error(`Wallet transaction failed: ${walletError}`);
        }
      }

      if (!response) {
        throw new Error(`No response for step ${stepName}`);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const result = await response.json();

      if (result.success) {
        await checkDeploymentStatus(true);

        // Handle step completion and chain switching for next step
        await handleStepCompletion(stepName, chainId, onError);

        // Stop processing to allow manual progression
        setIsProcessing(false);

        if (result.nextStep === "completed") {
          setCurrentStep("completed");
          const finalStatus = await checkDeploymentStatus(true);
          if (finalStatus?.isComplete) {
            onComplete(finalStatus.currentState);
          }
        }
      } else {
        throw new Error(result.error || `Failed to execute ${stepName}`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      setIsProcessing(false);
      setCanRetry(true);
      onError(`Deployment failed at ${stepDef.title}: ${errorMessage}`);
    }
  };

  const startDeployment = async () => {
    if (!agreementId || !contractContent || !fileName) {
      const missing = !agreementId
        ? "Agreement ID"
        : !contractContent
        ? "Contract content"
        : "File name";
      onError(`${missing} is required for deployment`);
      return;
    }

    setIsProcessing(true);
    setCanRetry(false);

    try {
      const status = await checkDeploymentStatus();

      if (status && status.isComplete) {
        setIsProcessing(false);
        onComplete(status.currentState);
        return;
      }

      // Check for existing CID to avoid duplicate uploads
      if (status?.currentState?.cid) {
        // CID exists, stop processing to allow manual progression
        setIsProcessing(false);
        return;
      }

      if (status && status.nextStep) {
        await executeStep(status.nextStep as DeploymentStepName);
      } else {
        await executeStep("ipfs_upload");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      setIsProcessing(false);
      setCanRetry(true);
      onError(`Failed to start deployment: ${errorMessage}`);
    }
  };

  const executeNextPendingStep = async () => {
    if (!isConnected) {
      onError("Please connect your wallet first");
      return;
    }

    try {
      const status = await checkDeploymentStatus();

      if (status && status.nextStep) {
        // Check and switch to required chain before executing step
        const switchSuccess = await checkAndSwitchChainForStep(
          status.nextStep as DeploymentStepName,
          chainId
        );

        if (!switchSuccess) {
          onError(
            `Failed to switch to required chain for step: ${status.nextStep}`
          );
          return;
        }

        if (status.currentState?.deploymentSteps) {
          const existingStep = status.currentState.deploymentSteps.find(
            (step: any) =>
              step.stepName === status.nextStep && step.status === "completed"
          );

          if (existingStep) {
            const nextIncompleteStep = stepOrder.find((step) => {
              const stepData = status.currentState.deploymentSteps.find(
                (s: any) => s.stepName === step
              );
              return !stepData || stepData.status !== "completed";
            });

            if (nextIncompleteStep) {
              // Check and switch chain for the incomplete step as well
              const incompleteStepSwitchSuccess =
                await checkAndSwitchChainForStep(
                  nextIncompleteStep as DeploymentStepName,
                  chainId
                );

              if (!incompleteStepSwitchSuccess) {
                onError(
                  `Failed to switch to required chain for step: ${nextIncompleteStep}`
                );
                return;
              }

              await executeStep(nextIncompleteStep as DeploymentStepName);
            } else {
              setCurrentStep("completed");
              setIsProcessing(false);
              onComplete(status.currentState);
            }
            return;
          }
        }

        await executeStep(status.nextStep as DeploymentStepName);
      } else if (status && status.isComplete) {
        onComplete(status.currentState);
      } else {
        await startDeployment();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Execute next step error:", error);
      onError(`Failed to execute next step: ${errorMessage}`);
    }
  };

  const retryDeployment = async () => {
    try {
      const response = await fetch("/api/deployment-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agreementId,
          action: "resume",
        }),
      });

      const result = await response.json();
      if (result.success) {
        await executeStep(result.nextStep as DeploymentStepName);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      onError(`Retry failed: ${errorMessage}`);
    }
  };

  const resetDeployment = async () => {
    try {
      const response = await fetch("/api/deployment-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agreementId,
          action: "reset",
        }),
      });

      const result = await response.json();
      if (result.success) {
        await startDeployment();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      onError(`Reset failed: ${errorMessage}`);
    }
  };

  const getStepStatus = (
    stepName: DeploymentStepName
  ): DeploymentStepStatus => {
    if (!deploymentState) {
      const currentIndex =
        currentStep && currentStep !== "completed"
          ? stepOrder.indexOf(currentStep as DeploymentStepName)
          : -1;
      const stepIndex = stepOrder.indexOf(stepName);

      if (currentIndex === -1) return "pending";
      if (stepIndex < currentIndex) return "completed";
      if (stepIndex === currentIndex)
        return isProcessing ? "in_progress" : "pending";
      return "pending";
    }

    // First check deployment steps for explicit status (including failed)
    const step = deploymentState.deploymentSteps?.find(
      (s) => s.stepName === stepName
    );

    if (step) {
      return step.status as DeploymentStepStatus;
    }

    // Then check if we have deployment state indicators (CID, contract addresses)
    // These are more reliable for completed steps
    if (stepName === "ipfs_upload" && deploymentState.cid) {
      return "completed";
    }

    if (
      stepName === "filecoin_access_deploy" &&
      deploymentState.filecoinAccessControl
    ) {
      return "completed";
    }

    // For filecoin_store_file, check if the process status indicates it's completed
    if (
      stepName === "filecoin_store_file" &&
      deploymentState.processStatus === "filecoin_stored"
    ) {
      return "completed";
    }

    if (stepName === "flow_deploy" && deploymentState.flowContractAddr) {
      return "completed";
    }

    // Fallback to step order logic
    const stepIndex = stepOrder.indexOf(stepName);
    const currentIndex =
      currentStep && currentStep !== "completed"
        ? stepOrder.indexOf(currentStep as DeploymentStepName)
        : -1;

    if (stepIndex < currentIndex) return "completed";
    if (stepIndex === currentIndex)
      return isProcessing ? "in_progress" : "pending";
    return "pending";
  };

  const getNextPendingStep = () => {
    for (const step of stepOrder) {
      const status = getStepStatus(step);
      if (status === "pending") {
        return step;
      }
    }
    return null;
  };

  // Handle when access control transaction hash becomes available
  useEffect(() => {
    if (accessTxHash && currentStep === "filecoin_access_deploy") {
      updateDeploymentStep(
        "filecoin_access_deploy",
        "in_progress",
        accessTxHash
      );
      // Force refresh to show transaction hash immediately
      checkDeploymentStatus(true);
    }
  }, [accessTxHash, currentStep]);

  // Handle when flow transaction hash becomes available (both flow_deploy and filecoin_store_file)
  useEffect(() => {
    if (flowTxHash && currentStep === "flow_deploy") {
      updateDeploymentStep("flow_deploy", "in_progress", flowTxHash);
      // Force refresh to show transaction hash immediately
      checkDeploymentStatus(true);
    }
  }, [flowTxHash, currentStep]);

  // Handle when storeFile transaction hash becomes available
  useEffect(() => {
    if (flowTxHash && currentStep === "filecoin_store_file") {
      updateDeploymentStep("filecoin_store_file", "in_progress", flowTxHash);
      // Force refresh to show transaction hash immediately
      checkDeploymentStatus(true);
    }
  }, [flowTxHash, currentStep]);

  // Handle access control transaction confirmation
  useEffect(() => {
    if (
      isAccessTxSuccess &&
      accessTxHash &&
      currentStep === "filecoin_access_deploy"
    ) {
      // Update step as completed with contract address
      updateDeploymentStep(
        "filecoin_access_deploy",
        "completed",
        accessTxHash,
        process.env.NEXT_PUBLIC_ACCESS_CONTROL_ADDRESS
      );

      // Handle step completion and chain switching for next step
      handleStepCompletion("filecoin_access_deploy", chainId, onError);

      // Refresh deployment status to show the success
      setTimeout(async () => {
        await checkDeploymentStatus(true);
        setIsProcessing(false);
      }, 1000);
    }
  }, [isAccessTxSuccess, accessTxHash, currentStep, chainId, onError]);

  // Handle storeFile transaction confirmation
  useEffect(() => {
    if (
      isStoreTxSuccess &&
      flowTxHash &&
      currentStep === "filecoin_store_file"
    ) {
      // Update step as completed
      updateDeploymentStep("filecoin_store_file", "completed", flowTxHash);

      // Handle step completion and chain switching for next step
      handleStepCompletion("filecoin_store_file", chainId, onError);

      // Refresh deployment status to show the success
      setTimeout(async () => {
        await checkDeploymentStatus(true);
        setIsProcessing(false);
      }, 1000);
    }
  }, [isStoreTxSuccess, flowTxHash, currentStep, chainId, onError]);

  // Handle access control errors
  useEffect(() => {
    if (accessError && currentStep === "filecoin_access_deploy") {
      updateDeploymentStep(
        "filecoin_access_deploy",
        "failed",
        accessTxHash || undefined,
        undefined,
        accessError.message
      );
      setIsProcessing(false);
      setCanRetry(true);
      onError(`Access Control deployment failed: ${accessError.message}`);
    }
  }, [accessError, currentStep]);

  // Handle storeFile errors
  useEffect(() => {
    if (createError && currentStep === "filecoin_store_file") {
      updateDeploymentStep(
        "filecoin_store_file",
        "failed",
        flowTxHash || undefined,
        undefined,
        createError.message
      );
      setIsProcessing(false);
      setCanRetry(true);
      onError(`File storage failed: ${createError.message}`);
    }
  }, [createError, currentStep, flowTxHash]);

  // Handle flow transaction confirmation
  useEffect(() => {
    if (isFlowDeploySuccess && flowTxHash && currentStep === "flow_deploy") {
      // Update step as completed with contract address
      updateDeploymentStep(
        "flow_deploy",
        "completed",
        flowTxHash,
        flowContractAddress || undefined
      );

      // Handle step completion and chain switching for next step
      handleStepCompletion("flow_deploy", chainId, onError);

      // Clear pending state
      setPendingTxHash(null);

      // Check if deployment is complete and finalize
      setTimeout(async () => {
        const updatedStatus = await checkDeploymentStatus(true);

        if (updatedStatus?.isComplete) {
          setCurrentStep("completed");
          setIsProcessing(false);
          onComplete(updatedStatus.currentState);
        } else {
          // Stop processing to allow manual progression if there are more steps
          setIsProcessing(false);
        }
      }, 2000);
    }
  }, [
    isFlowDeploySuccess,
    flowTxHash,
    currentStep,
    flowContractAddress,
    chainId,
    onError,
  ]);

  // Handle flow agreement creation errors
  useEffect(() => {
    if (createError && currentStep === "flow_deploy") {
      updateDeploymentStep(
        "flow_deploy",
        "failed",
        flowTxHash || undefined,
        undefined,
        createError.message
      );
      setPendingTxHash(null);
      setIsProcessing(false);
      setCanRetry(true);
      onError(`Flow Agreement deployment failed: ${createError.message}`);
    }
  }, [createError, currentStep, flowTxHash]);

  // Periodic polling for deployment status when processing
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isProcessing && currentStep && currentStep !== "completed") {
      interval = setInterval(async () => {
        const status = await checkDeploymentStatus();

        // Check if step completed on backend without transaction confirmation
        if (status?.currentState) {
          const stepStatus = getStepStatus(currentStep as DeploymentStepName);
          if (stepStatus === "completed" && isProcessing) {
            // Stop processing when step is completed, but don't auto-advance
            setIsProcessing(false);

            if (status.isComplete) {
              setCurrentStep("completed");
              onComplete(status.currentState);
            }
          }
        }
      }, 5000); // Poll every 5 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isProcessing, currentStep]);

  // Initial status check and deployment state initialization
  useEffect(() => {
    if (agreementId) {
      const initializeDeploymentState = async () => {
        const status = await checkDeploymentStatus(true);

        if (status?.currentState) {
          // Set the current step based on what's next
          if (status.nextStep) {
            setCurrentStep(status.nextStep as DeploymentStepName);
          } else if (status.isComplete) {
            setCurrentStep("completed");
            onComplete(status.currentState);
          }
        }
      };

      initializeDeploymentState();
    }
  }, [agreementId]);

  const retryStep = async (stepName: DeploymentStepName) => {
    if (isProcessing) {
      onError("Another deployment step is already in progress");
      return;
    }

    try {
      // Check and switch to required chain before retrying step
      const switchSuccess = await checkAndSwitchChainForStep(stepName, chainId);

      if (!switchSuccess) {
        onError(`Failed to switch to required chain for step: ${stepName}`);
        return;
      }

      // Reset the failed step to pending first
      await updateDeploymentStep(stepName, "pending");

      // Wait a moment for the database to update
      setTimeout(async () => {
        await checkDeploymentStatus(true);
        await executeStep(stepName);
      }, 500);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      onError(`Failed to retry ${stepName}: ${errorMessage}`);
    }
  };

  return {
    deploymentState,
    currentStep,
    isProcessing,
    canRetry,
    pendingTxHash,
    isTxPending,
    isCreatingAgreement,
    isCreatingAccess,
    createError,
    accessError,
    startDeployment,
    executeNextPendingStep,
    retryDeployment,
    resetDeployment,
    getStepStatus,
    getNextPendingStep,
    retryStep,
  };
};
