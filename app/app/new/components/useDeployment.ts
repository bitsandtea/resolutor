import { useCreateAccessControl } from "@/lib/storage/createAccess";
import { useCreateAgreement } from "@/lib/storage/createStorage";
import {
  BlockchainDeploymentState,
  DeploymentStepName,
  DeploymentStepStatus,
} from "@/types";
import { useEffect, useState } from "react";
import { parseEther } from "viem";
import { useAccount, useChainId, useWaitForTransactionReceipt } from "wagmi";
import { stepDefinitions, stepOrder } from "./deploymentSteps";

import { config, CONTRACT_ADDRESSES } from "@/lib/wagmi";
import { switchChain } from "@wagmi/core";

// Chain requirements for each deployment step
const STEP_CHAIN_REQUIREMENTS: Record<DeploymentStepName, number | null> = {
  ipfs_upload: null, // No specific chain required
  filecoin_access_deploy: Number(
    process.env.NEXT_PUBLIC_FILECOIN_CALIBRATION_CHAIN_ID || "314159"
  ),
  filecoin_store_file: Number(
    process.env.NEXT_PUBLIC_FILECOIN_CALIBRATION_CHAIN_ID || "314159"
  ),
  flow_deploy: Number(process.env.NEXT_PUBLIC_FLOW_CHAIN_ID || "747"), // Flow Testnet
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

  const { isLoading: isTxPending, isSuccess: isTxSuccess } =
    useWaitForTransactionReceipt({
      hash: (accessTxHash || flowTxHash || pendingTxHash) as `0x${string}`,
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
        if (
          chainId !==
          Number(process.env.NEXT_PUBLIC_FILECOIN_CALIBRATION_CHAIN_ID)
        ) {
          console.log("Switching chain to Filecoin Calibration Chain");
          await switchChain(config, {
            chainId: Number(
              process.env.NEXT_PUBLIC_FILECOIN_CALIBRATION_CHAIN_ID || "314159"
            ) as 314159,
          });
        }

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

          // Update database with the predefined ACCESS_CONTROL_ADDRESS
          const updateResponse = await fetch("/api/update-deployment-step", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agreementId,
              stepName: "filecoin_access_deploy",
              status: "completed",
              contractAddr: process.env.NEXT_PUBLIC_ACCESS_CONTROL_ADDRESS,
            }),
          });

          if (!updateResponse.ok) {
            console.error("Failed to update filecoin access control address");
          }

          // Handle step completion and chain switching for next step
          await handleStepCompletion(
            "filecoin_access_deploy",
            chainId,
            onError
          );

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
        if (
          chainId !==
          Number(process.env.NEXT_PUBLIC_FILECOIN_CALIBRATION_CHAIN_ID)
        ) {
          console.log(
            "Switching chain to Filecoin Calibration Chain for file storage"
          );
          await switchChain(config, {
            chainId: Number(
              process.env.NEXT_PUBLIC_FILECOIN_CALIBRATION_CHAIN_ID || "314159"
            ) as 314159,
          });
        }

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
          await storeFile({
            fileCid: currentStatus.currentState.cid,
            agreementId: agreementId,
          });

          // Update database to mark step as completed
          const updateResponse = await fetch("/api/update-deployment-step", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agreementId,
              stepName: "filecoin_store_file",
              status: "completed",
            }),
          });

          if (!updateResponse.ok) {
            console.error("Failed to update filecoin store file step");
          }

          // Handle step completion and chain switching for next step
          await handleStepCompletion("filecoin_store_file", chainId, onError);

          // Stop processing to allow manual progression
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
            token: CONTRACT_ADDRESSES.MOCK_ERC20,
            filecoinAccessControl:
              (process.env
                .NEXT_PUBLIC_FILECOIN_ACCESS_CONTROL as `0x${string}`) || "",
          };

          await createAgreement(createParams);

          // Don't return immediately - let the useEffect handle transaction completion
          // The transaction success will be handled by the useEffect that watches isFlowSuccess
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
    }
  }, [accessTxHash, currentStep]);

  // Handle when flow transaction hash becomes available
  useEffect(() => {
    if (flowTxHash && currentStep === "flow_deploy") {
      updateDeploymentStep("flow_deploy", "in_progress", flowTxHash);
    }
  }, [flowTxHash, currentStep]);

  // Handle access control transaction confirmation
  useEffect(() => {
    if (
      isTxSuccess &&
      accessTxHash &&
      currentStep === "filecoin_access_deploy"
    ) {
      // Update step as completed
      updateDeploymentStep("filecoin_access_deploy", "completed", accessTxHash);

      // Handle step completion and chain switching for next step
      handleStepCompletion("filecoin_access_deploy", chainId, onError);

      // Stop processing to allow manual progression
      setIsProcessing(false);
    }
  }, [isTxSuccess, accessTxHash, currentStep, chainId, onError]);

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

  // Handle flow transaction confirmation
  useEffect(() => {
    if (isFlowSuccess && flowTxHash && currentStep === "flow_deploy") {
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
    isFlowSuccess,
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
