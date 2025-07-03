import { CONTRACT_ADDRESSES } from "@/lib/chain-config";
import { useCreateAccessControl } from "@/lib/storage/createAccess";
import { useCreateAgreement } from "@/lib/storage/createStorage";

import {
  BlockchainDeploymentState,
  DeploymentStepName,
  DeploymentStepStatus,
} from "@/types";
import { useEffect, useState } from "react";
import { parseEther, stringToHex } from "viem";
import { useAccount, useChainId, useWaitForTransactionReceipt } from "wagmi";
import {
  checkAndSwitchChainForStep,
  fetchDeploymentStatus,
  getRequiredChainForStep,
  updateDeploymentStep,
} from "../helpers";
import { stepDefinitions, stepOrder } from "./deploymentSteps";

// Chain requirements for each deployment step

const handleStepCompletion = async (
  completedStep: DeploymentStepName,
  currentChainId: number,
  onError: (error: string) => void
): Promise<void> => {
  // Remove automatic chain switching - let manual button trigger handle it
  console.log(`Step ${completedStep} completed`);
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
    isPending: isCreatingAgreement,
    error: createError,
    txHash: flowTxHash,
    isSuccess: isFlowSuccess,
    agreementId: flowAgreementId,
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
  const [nextStepButtonActive, setNextStepButtonActive] = useState(false);

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

  const { isSuccess: isFlowDeploySuccess } = useWaitForTransactionReceipt({
    hash: flowTxHash as `0x${string}`,
    query: { enabled: !!flowTxHash && currentStep === "flow_deploy" },
  });

  const checkDeploymentStatus = async (forceRefresh = false) => {
    // Add throttling to prevent excessive API calls
    const now = Date.now();
    if (!forceRefresh && now - lastPolledTime < 2000) {
      return deploymentState;
    }
    setLastPolledTime(now);

    const data = await fetchDeploymentStatus(agreementId);
    if (data) {
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
    }
    return null;
  };

  const executeStep = async (stepName: DeploymentStepName) => {
    setCurrentStep(stepName);
    setIsProcessing(true);

    const stepDef = stepDefinitions[stepName as keyof typeof stepDefinitions];
    console.debug(`[useDeployment] Executing step: ${stepName}`, { stepDef });
    if (!stepDef) {
      console.error(`[useDeployment] No step definition found for ${stepName}`);
      return;
    }

    let requestPayload: Record<string, unknown> = {};

    try {
      let response;
      if (stepName === "ipfs_upload") {
        console.debug("[useDeployment] Start: ipfs_upload step");
        const currentStatus = await checkDeploymentStatus(true);
        if (currentStatus?.currentState?.cid) {
          // CID already exists, stop processing to allow manual progression
          console.debug(
            "[useDeployment] CID already exists, skipping IPFS upload."
          );
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
        console.debug("[useDeployment] End: ipfs_upload step");
      } else if (stepName === "filecoin_access_deploy") {
        console.debug("[useDeployment] Start: filecoin_access_deploy step");
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
        await updateDeploymentStep(
          agreementId,
          "filecoin_access_deploy",
          "in_progress"
        );

        try {
          console.log("Creating agreement with file in useDeployment", {
            agreementId: agreementId,
            partyA: address,
            mediator: process.env.NEXT_PUBLIC_MEDIATOR_ADDRESS || "",
            fileCid: currentStatus.currentState.cid,
          });

          await createAccessControl(
            agreementId,
            address || "",
            process.env.NEXT_PUBLIC_MEDIATOR_ADDRESS || "",
            currentStatus.currentState.cid
          );

          // Don't mark as completed here - let the useEffect handle transaction confirmation
          // The transaction success will be handled by the useEffect that watches isAccessTxSuccess
          setIsProcessing(false); // Allow manual progression while waiting for confirmation
          console.debug("[useDeployment] End: filecoin_access_deploy step");
          return { success: true, txHash: "pending" };
        } catch (walletError) {
          await updateDeploymentStep(
            agreementId,
            "filecoin_access_deploy",
            "failed",
            undefined,
            undefined,
            `Wallet transaction failed: ${walletError}`
          );
          throw new Error(`Wallet transaction failed: ${walletError}`);
        }
      } else if (stepName === "flow_deploy") {
        console.debug("[useDeployment] Start: flow_deploy step");
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

          const { depositA, depositB } = agreementData.agreement;

          const createParams = {
            agreementId: stringToHex(agreementId, { size: 32 }),
            partyA: address,
            mediator:
              (process.env.NEXT_PUBLIC_MEDIATOR_ADDRESS as `0x${string}`) || "",
            depositA: parseEther(depositA.toString()),
            depositB: parseEther(depositB.toString()),
            token: CONTRACT_ADDRESSES[545].MOCK_ERC20,
            filecoinAccessControl:
              (process.env
                .NEXT_PUBLIC_ACCESS_CONTROL_ADDRESS as `0x${string}`) || "",
            signOnCreate: true,
          };

          console.log("createParams", createParams);

          await createAgreement(createParams);
          // Also update the partyA_address in the DB
          await fetch(`/api/contracts/${agreementId}/deposit-status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ partyA_address: address }),
          });
          console.debug("[useDeployment] End: flow_deploy step");
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

        // Handle step completion - just mark button as active for next step
        await handleStepCompletion(stepName, chainId, onError);

        // Stop processing and activate next step button
        setIsProcessing(false);
        setNextStepButtonActive(true);

        if (result.nextStep === "completed") {
          setCurrentStep("completed");
          setNextStepButtonActive(false);
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
      await updateDeploymentStep(
        agreementId,
        stepName,
        "failed",
        undefined,
        undefined,
        errorMessage
      );
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
        // CID exists, activate next step button
        setIsProcessing(false);
        setNextStepButtonActive(true);
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
    console.log("🚀 executeNextPendingStep: Starting execution");
    console.log("📋 executeNextPendingStep: Current state", {
      isConnected,
      address,
      chainId,
      currentStep,
      isProcessing,
      agreementId,
      nextStepButtonActive,
    });

    if (!isConnected) {
      console.log("❌ executeNextPendingStep: Wallet not connected");
      onError("Please connect your wallet first");
      return;
    }

    console.log("✅ executeNextPendingStep: Wallet connected, proceeding");

    try {
      console.log("📡 executeNextPendingStep: Checking deployment status...");
      const status = await checkDeploymentStatus();
      console.log("📊 executeNextPendingStep: Deployment status result", {
        hasStatus: !!status,
        nextStep: status?.nextStep,
        isComplete: status?.isComplete,
        currentState: status?.currentState
          ? {
              cid: status.currentState.cid,
              filecoinAccessControl: status.currentState.filecoinAccessControl,
              flowContractAddr: status.currentState.flowContractAddr,
              deploymentStepsCount:
                status.currentState.deploymentSteps?.length || 0,
            }
          : null,
      });

      if (status && status.nextStep) {
        console.log(
          `🎯 executeNextPendingStep: Found next step: ${status.nextStep}`
        );

        // Check and switch to required chain before executing step
        const requiredChain = getRequiredChainForStep(
          status.nextStep as DeploymentStepName
        );
        console.log("🔗 executeNextPendingStep: Chain requirements", {
          currentChainId: chainId,
          requiredChainId: requiredChain,
          needsSwitch: requiredChain && chainId !== requiredChain,
          stepName: status.nextStep,
        });

        const switchSuccess = await checkAndSwitchChainForStep(
          status.nextStep as DeploymentStepName,
          chainId
        );

        console.log("🔄 executeNextPendingStep: Chain switch result", {
          switchSuccess,
          step: status.nextStep,
          currentChainAfterSwitch: chainId,
        });

        if (!switchSuccess) {
          console.log(
            `❌ executeNextPendingStep: Chain switch failed for ${status.nextStep}`
          );
          onError(
            `Failed to switch to required chain for step: ${status.nextStep}`
          );
          return;
        }

        if (status.currentState?.deploymentSteps) {
          console.log(
            "📝 executeNextPendingStep: Checking existing deployment steps",
            {
              totalSteps: status.currentState.deploymentSteps.length,
              steps: status.currentState.deploymentSteps.map((s: any) => ({
                stepName: s.stepName,
                status: s.status,
                txHash: s.txHash,
                contractAddr: s.contractAddr,
              })),
            }
          );

          const existingStep = status.currentState.deploymentSteps.find(
            (step: any) =>
              step.stepName === status.nextStep && step.status === "completed"
          );

          console.log("🔍 executeNextPendingStep: Existing step check", {
            foundExistingStep: !!existingStep,
            stepName: existingStep?.stepName,
            stepStatus: existingStep?.status,
            stepTxHash: existingStep?.txHash,
          });

          if (existingStep) {
            console.log(
              `✅ executeNextPendingStep: Step ${status.nextStep} already completed, finding next incomplete step`
            );

            const nextIncompleteStep = stepOrder.find((step) => {
              const stepData = status.currentState.deploymentSteps.find(
                (s: any) => s.stepName === step
              );
              const isIncomplete = !stepData || stepData.status !== "completed";
              console.log(`🔍 executeNextPendingStep: Checking step ${step}`, {
                hasStepData: !!stepData,
                stepStatus: stepData?.status,
                isIncomplete,
              });
              return isIncomplete;
            });

            console.log("🎯 executeNextPendingStep: Next incomplete step", {
              nextIncompleteStep,
              allSteps: stepOrder,
              stepOrderInfo: stepOrder.map((step) => ({
                stepName: step,
                status: getStepStatus(step),
              })),
            });

            if (nextIncompleteStep) {
              console.log(
                `🔄 executeNextPendingStep: Switching chain for incomplete step: ${nextIncompleteStep}`
              );

              // Check and switch chain for the incomplete step as well
              const incompleteStepRequiredChain = getRequiredChainForStep(
                nextIncompleteStep as DeploymentStepName
              );
              console.log(
                "🔗 executeNextPendingStep: Incomplete step chain requirements",
                {
                  step: nextIncompleteStep,
                  currentChainId: chainId,
                  requiredChainId: incompleteStepRequiredChain,
                  needsSwitch:
                    incompleteStepRequiredChain &&
                    chainId !== incompleteStepRequiredChain,
                }
              );

              const incompleteStepSwitchSuccess =
                await checkAndSwitchChainForStep(
                  nextIncompleteStep as DeploymentStepName,
                  chainId
                );

              console.log(
                "🔗 executeNextPendingStep: Incomplete step chain switch",
                {
                  step: nextIncompleteStep,
                  switchSuccess: incompleteStepSwitchSuccess,
                  currentChainAfterSwitch: chainId,
                }
              );

              if (!incompleteStepSwitchSuccess) {
                console.log(
                  `❌ executeNextPendingStep: Failed to switch chain for ${nextIncompleteStep}`
                );
                onError(
                  `Failed to switch to required chain for step: ${nextIncompleteStep}`
                );
                return;
              }

              console.log(
                `🚀 executeNextPendingStep: Executing incomplete step: ${nextIncompleteStep}`
              );
              console.log("📋 executeNextPendingStep: Pre-execution state", {
                currentStep,
                isProcessing,
                nextStepButtonActive,
              });
              await executeStep(nextIncompleteStep as DeploymentStepName);
            } else {
              console.log(
                "🎉 executeNextPendingStep: All steps completed, marking as done"
              );
              console.log("📋 executeNextPendingStep: Final completion state", {
                deploymentState: status.currentState,
              });
              setCurrentStep("completed");
              setIsProcessing(false);
              setNextStepButtonActive(false);
              onComplete(status.currentState);
            }
            return;
          }
        } else {
          console.log(
            "📝 executeNextPendingStep: No existing deployment steps found in currentState"
          );
        }

        console.log(
          `🚀 executeNextPendingStep: Executing next step: ${status.nextStep}`
        );
        console.log("📋 executeNextPendingStep: Pre-execution state", {
          currentStep,
          isProcessing,
          nextStepButtonActive,
          stepToExecute: status.nextStep,
        });
        await executeStep(status.nextStep as DeploymentStepName);
      } else if (status && status.isComplete) {
        console.log("🎉 executeNextPendingStep: Deployment already complete");
        console.log("📋 executeNextPendingStep: Complete deployment state", {
          deploymentState: status.currentState,
        });
        onComplete(status.currentState);
      } else {
        console.log(
          "🔄 executeNextPendingStep: No next step found, starting deployment"
        );
        console.log(
          "📋 executeNextPendingStep: Starting deployment with params",
          {
            agreementId,
            hasContractContent: !!contractContent,
            fileName,
          }
        );
        await startDeployment();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("❌ executeNextPendingStep: Error occurred", {
        error,
        errorMessage,
        errorStack: error instanceof Error ? error.stack : undefined,
        currentStep,
        isProcessing,
        nextStepButtonActive,
      });
      onError(`Failed to execute next step: ${errorMessage}`);
    }

    console.log("🏁 executeNextPendingStep: Function completed");
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
        agreementId,
        "filecoin_access_deploy",
        "in_progress",
        accessTxHash
      );
      // Force refresh to show transaction hash immediately
      checkDeploymentStatus(true);
    }
  }, [accessTxHash, currentStep]);

  // Handle when flow transaction hash becomes available
  useEffect(() => {
    if (flowTxHash && currentStep === "flow_deploy") {
      updateDeploymentStep(
        agreementId,
        "flow_deploy",
        "in_progress",
        flowTxHash
      );
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
        agreementId,
        "filecoin_access_deploy",
        "completed",
        accessTxHash,
        process.env.NEXT_PUBLIC_ACCESS_CONTROL_ADDRESS
      );

      // Just handle step completion without auto-advancing
      handleStepCompletion("filecoin_access_deploy", chainId, onError);

      // Refresh deployment status and activate next step button
      setTimeout(async () => {
        await checkDeploymentStatus(true);
        setIsProcessing(false);
        setNextStepButtonActive(true);
      }, 1000);
    }
  }, [isAccessTxSuccess, accessTxHash, currentStep, chainId, onError]);

  // Handle access control errors
  useEffect(() => {
    if (accessError && currentStep === "filecoin_access_deploy") {
      updateDeploymentStep(
        agreementId,
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
        agreementId,
        "flow_deploy",
        "completed",
        flowTxHash,
        process.env.NEXT_PUBLIC_MULTISIG_ADDRESS
      );

      // Handle step completion without auto-advancing
      handleStepCompletion("flow_deploy", chainId, onError);

      // Clear pending state
      setPendingTxHash(null);

      // Check if deployment is complete and finalize
      setTimeout(async () => {
        const updatedStatus = await checkDeploymentStatus(true);

        if (updatedStatus?.isComplete) {
          setCurrentStep("completed");
          setIsProcessing(false);
          setNextStepButtonActive(false);
          onComplete(updatedStatus.currentState);
        } else {
          // Stop processing and activate next step button
          setIsProcessing(false);
          setNextStepButtonActive(true);
        }
      }, 2000);
    }
  }, [isFlowSuccess, flowTxHash, currentStep, chainId, onError]);

  // Handle flow agreement creation errors
  useEffect(() => {
    if (createError && currentStep === "flow_deploy") {
      updateDeploymentStep(
        agreementId,
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
            // Stop processing and activate next step button
            setIsProcessing(false);
            setNextStepButtonActive(true);

            if (status.isComplete) {
              setCurrentStep("completed");
              setNextStepButtonActive(false);
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
      await updateDeploymentStep(agreementId, stepName, "pending");

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
    nextStepButtonActive,
    startDeployment,
    executeNextPendingStep,
    retryDeployment,
    resetDeployment,
    getStepStatus,
    getNextPendingStep,
    retryStep,
  };
};
