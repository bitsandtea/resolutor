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

import { config } from "@/lib/wagmi";
import { switchChain } from "@wagmi/core";

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
    isPending: isCreatingAgreement,
    error: createError,
    txHash: flowTxHash,
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
          setCurrentStep("filecoin_access_deploy" as DeploymentStepName);
          await executeStep("filecoin_access_deploy" as DeploymentStepName);
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
      } else if (stepName === "contract_signing") {
        requestPayload = {
          agreementId,
          stepName: "contract_signing",
        };

        response = await fetch("/api/sign-contract", {
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
          await createAgreement({
            partyA: address,
            partyB: "0x0000000000000000000000000000000000000000",
            depositA: parseEther("0.1"),
            depositB: parseEther("0.1"),
            manifestCid: currentState.currentState.cid,
          });

          setPendingTxHash("flow_deploy"); // Set a placeholder for tracking
          return { success: true, txHash: "pending", contractAddr: "pending" };
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

        if (result.nextStep && result.nextStep !== "completed") {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          await executeStep(result.nextStep as DeploymentStepName);
        } else {
          setCurrentStep("completed");
          setIsProcessing(false);
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
        // Skip IPFS upload and proceed to next step
        if (status.nextStep && status.nextStep !== "ipfs_upload") {
          await executeStep(status.nextStep as DeploymentStepName);
        } else {
          await executeStep("filecoin_access_deploy");
        }
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

    // First check if we have deployment state indicators (CID, contract addresses)
    // These are more reliable than deployment steps which might not be recorded properly
    if (stepName === "ipfs_upload" && deploymentState.cid) {
      return "completed";
    }
    if (stepName === "contract_signing" && deploymentState.contractSigned) {
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

    // Then check actual deployment steps
    const step = deploymentState.deploymentSteps?.find(
      (s) => s.stepName === stepName
    );

    if (step) {
      return step.status as DeploymentStepStatus;
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

      // Proceed to next step
      setTimeout(async () => {
        const updatedStatus = await checkDeploymentStatus(true);

        if (
          updatedStatus?.nextStep &&
          updatedStatus.nextStep !== "filecoin_access_deploy"
        ) {
          setTimeout(() => {
            executeStep(updatedStatus.nextStep as DeploymentStepName);
          }, 1000);
        } else if (updatedStatus?.isComplete) {
          setCurrentStep("completed");
          setIsProcessing(false);
          onComplete(updatedStatus.currentState);
        } else {
          // Fallback: proceed to flow deployment
          setTimeout(() => {
            executeStep("flow_deploy");
          }, 1000);
        }
      }, 2000);
    }
  }, [isTxSuccess, accessTxHash, currentStep]);

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

  // Handle completion of flow agreement creation (wagmi hook)
  useEffect(() => {
    // Only handle this if we're currently on the flow_deploy step
    if (currentStep === "flow_deploy" && pendingTxHash === "flow_deploy") {
      if (!isCreatingAgreement && !createError) {
        // Flow agreement creation completed successfully
        // Clear pending state
        setPendingTxHash(null);

        // Check deployment status and proceed to completion
        setTimeout(async () => {
          const updatedStatus = await checkDeploymentStatus(true);

          if (updatedStatus?.isComplete) {
            setCurrentStep("completed");
            setIsProcessing(false);
            onComplete(updatedStatus.currentState);
          } else {
            // Mark as completed manually if backend hasn't updated yet
            setCurrentStep("completed");
            setIsProcessing(false);
          }
        }, 2000);
      } else if (!isCreatingAgreement && createError) {
        // Flow agreement creation failed
        setPendingTxHash(null);
        setIsProcessing(false);
        setCanRetry(true);
        onError(`Flow Agreement deployment failed: ${createError.message}`);
      }
    }
  }, [isCreatingAgreement, createError, currentStep, pendingTxHash]);

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
            if (status.nextStep && status.nextStep !== "completed") {
              setCurrentStep(status.nextStep);
            } else if (status.isComplete) {
              setCurrentStep("completed");
              setIsProcessing(false);
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
  };
};
