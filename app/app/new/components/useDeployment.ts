import { useCreateAgreement } from "@/lib/storage/createStorage";
import {
  BlockchainDeploymentState,
  DeploymentStepName,
  DeploymentStepStatus,
} from "@/types";
import { useEffect, useState } from "react";
import { parseEther } from "viem";
import { useAccount, useWaitForTransactionReceipt } from "wagmi";
import { stepDefinitions, stepOrder } from "./deploymentSteps";

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
  const {
    createAgreement,
    isPending: isCreatingAgreement,
    error: createError,
  } = useCreateAgreement();

  const [deploymentState, setDeploymentState] =
    useState<BlockchainDeploymentState | null>(null);
  const [currentStep, setCurrentStep] = useState<
    DeploymentStepName | "completed" | null
  >(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [canRetry, setCanRetry] = useState(false);
  const [pendingTxHash, setPendingTxHash] = useState<string | null>(null);

  const { isLoading: isTxPending, isSuccess: isTxSuccess } =
    useWaitForTransactionReceipt({
      hash: pendingTxHash as `0x${string}`,
    });

  const addLog = (message: string) => {
    setLogs((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${message}`,
    ]);
  };

  const checkDeploymentStatus = async () => {
    try {
      const response = await fetch(
        `/api/deployment-status?agreementId=${agreementId}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        setDeploymentState(data.currentState);
        setCanRetry(data.canResume);

        if (data.currentState?.deploymentSteps) {
          const failedSteps = data.currentState.deploymentSteps.filter(
            (step: { status: string }) => step.status === "failed"
          );
          const inProgressSteps = data.currentState.deploymentSteps.filter(
            (step: { status: string }) => step.status === "in_progress"
          );

          if (failedSteps.length > 0) {
            addLog(`❌ Found ${failedSteps.length} failed step(s)`);
            setIsProcessing(false);
          } else if (inProgressSteps.length > 0) {
            const currentInProgress = inProgressSteps[0];
            setCurrentStep(currentInProgress.stepName);
            addLog(`⏳ Step in progress: ${currentInProgress.stepName}`);
          } else if (data.isComplete) {
            addLog("🎉 All deployment steps completed successfully!");
            setCurrentStep("completed");
            setIsProcessing(false);
          } else if (data.nextStep) {
            addLog(`📋 Next step to execute: ${data.nextStep}`);
          }
        }

        if (data.isComplete && !isProcessing) {
          onComplete(data.currentState);
        } else if (data.currentState?.processStatus === "failed") {
          addLog(
            `❌ Deployment failed: ${
              data.currentState.errorDetails || "Unknown error"
            }`
          );
          setIsProcessing(false);
          setCanRetry(true);
        }

        return data;
      } else {
        throw new Error(data.error || "Failed to check deployment status");
      }
    } catch (error) {
      console.error("Error checking deployment status:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      addLog(`❌ Error checking status: ${errorMessage}`);
      return null;
    }
  };

  const executeStep = async (stepName: DeploymentStepName) => {
    setCurrentStep(stepName);
    setIsProcessing(true);

    const stepDef = stepDefinitions[stepName as keyof typeof stepDefinitions];
    if (!stepDef) {
      addLog(`⚠️ Skipping internal step: ${stepName}`);
      return;
    }
    addLog(`${stepDef.icon} Starting: ${stepDef.title}`);

    let requestPayload: Record<string, unknown> = {};

    try {
      let response;

      if (stepName === "ipfs_upload") {
        const currentStatus = await checkDeploymentStatus();
        if (currentStatus?.currentState?.cid) {
          addLog(
            `✅ Content already uploaded to IPFS: ${currentStatus.currentState.cid}`
          );
          addLog(
            `🔗 Gateway URL: https://gateway.lighthouse.storage/ipfs/${currentStatus.currentState.cid}`
          );
          setCurrentStep("contract_signing" as DeploymentStepName);
          addLog(`⏭️ Moving to next step: contract_signing`);
          await executeStep("contract_signing" as DeploymentStepName);
          return;
        }

        requestPayload = {
          agreementId,
          content: contractContent,
          fileName,
          fileType: "contract_unsigned",
        };
        addLog(`📤 Uploading contract to IPFS via Lighthouse.storage...`);
        addLog(`📄 Content length: ${contractContent.length} characters`);

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
        addLog(`✍️ Signing contract...`);

        response = await fetch("/api/sign-contract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestPayload),
        });
      } else if (stepName === "filecoin_access_deploy") {
        requestPayload = {
          agreementId,
          stepName: "filecoin_access_deploy",
        };
        addLog(`🔐 Deploying AccessControlManager contract to Filecoin...`);

        response = await fetch("/api/deploy-filecoin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestPayload),
        });
      } else if (stepName === "flow_deploy") {
        if (!isConnected || !address) {
          throw new Error(
            "Wallet not connected. Please connect your wallet first."
          );
        }

        addLog(`⚡ Creating MultiSigAgreement contract via wallet...`);

        const currentState = await checkDeploymentStatus();
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

          addLog(`📋 Transaction submitted`);
          addLog(`⏳ Waiting for confirmation...`);
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
        addLog(`✅ Completed: ${stepDef.title}`);

        if (stepName === "ipfs_upload" && result.cid) {
          addLog(`🗂️ IPFS CID: ${result.cid}`);
          addLog(
            `🔗 Gateway URL: https://gateway.lighthouse.storage/ipfs/${result.cid}`
          );
        }

        if (stepName === "filecoin_access_deploy" && result.contractAddr) {
          addLog(`📍 Contract Address: ${result.contractAddr}`);
        }

        if (result.txHash) {
          addLog(`📋 Transaction Hash: ${result.txHash}`);
        }

        await checkDeploymentStatus();

        if (result.nextStep && result.nextStep !== "completed") {
          addLog(`⏭️ Proceeding to next step: ${result.nextStep}`);
          await new Promise((resolve) => setTimeout(resolve, 2000));
          await executeStep(result.nextStep as DeploymentStepName);
        } else {
          addLog("🎉 All deployment steps completed successfully!");
          setCurrentStep("completed");
          setIsProcessing(false);
          const finalStatus = await checkDeploymentStatus();
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
      addLog(`❌ Failed: ${stepDef.title} - ${errorMessage}`);
      addLog(`🔍 Request payload: ${JSON.stringify(requestPayload, null, 2)}`);
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
      addLog(`❌ No ${missing.toLowerCase()} provided`);
      onError(`${missing} is required for deployment`);
      return;
    }

    addLog("🚀 Starting blockchain deployment process...");
    addLog(`📋 Agreement ID: ${agreementId}`);
    addLog(`📄 Contract file: ${fileName}`);
    addLog(`📏 Content size: ${contractContent.length} characters`);

    setLogs([]);
    setIsProcessing(true);
    setCanRetry(false);

    try {
      const status = await checkDeploymentStatus();

      if (status && status.isComplete) {
        addLog("✅ Deployment already completed!");
        setIsProcessing(false);
        onComplete(status.currentState);
        return;
      }

      if (status && status.nextStep) {
        addLog(`🔄 Resuming deployment from step: ${status.nextStep}`);
        await executeStep(status.nextStep as DeploymentStepName);
      } else {
        addLog("📤 Starting with IPFS upload...");
        await executeStep("ipfs_upload");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      addLog(`❌ Failed to start deployment: ${errorMessage}`);
      setIsProcessing(false);
      setCanRetry(true);
      onError(`Failed to start deployment: ${errorMessage}`);
    }
  };

  const executeNextPendingStep = async () => {
    if (!isConnected) {
      addLog("❌ Wallet not connected");
      onError("Please connect your wallet first");
      return;
    }

    try {
      addLog("🔍 Checking deployment status...");
      const status = await checkDeploymentStatus();

      if (status && status.nextStep) {
        addLog(`🚀 Executing next step: ${status.nextStep}`);

        if (status.currentState?.deploymentSteps) {
          const existingStep = status.currentState.deploymentSteps.find(
            (step: any) =>
              step.stepName === status.nextStep && step.status === "completed"
          );

          if (existingStep) {
            addLog(`⚠️ Step ${status.nextStep} already completed, skipping...`);

            const nextIncompleteStep = stepOrder.find((step) => {
              const stepData = status.currentState.deploymentSteps.find(
                (s: any) => s.stepName === step
              );
              return !stepData || stepData.status !== "completed";
            });

            if (nextIncompleteStep) {
              addLog(
                `➡️ Moving to next incomplete step: ${nextIncompleteStep}`
              );
              await executeStep(nextIncompleteStep as DeploymentStepName);
            } else {
              addLog("🎉 All steps completed!");
              setCurrentStep("completed");
              setIsProcessing(false);
              onComplete(status.currentState);
            }
            return;
          }
        }

        await executeStep(status.nextStep as DeploymentStepName);
      } else if (status && status.isComplete) {
        addLog("✅ All steps already completed!");
        onComplete(status.currentState);
      } else {
        addLog("🔄 Starting deployment from beginning...");
        await startDeployment();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      addLog(`❌ Failed to execute next step: ${errorMessage}`);
      console.error("Execute next step error:", error);
      onError(`Failed to execute next step: ${errorMessage}`);
    }
  };

  const retryDeployment = async () => {
    try {
      addLog("🔄 Attempting to retry deployment...");

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
        addLog(`✅ Deployment resumed. Next step: ${result.nextStep}`);
        await executeStep(result.nextStep as DeploymentStepName);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      addLog(`❌ Retry failed: ${errorMessage}`);
      onError(`Retry failed: ${errorMessage}`);
    }
  };

  const resetDeployment = async () => {
    try {
      addLog("🔄 Resetting deployment...");

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
        addLog("✅ Deployment reset. Starting fresh...");
        setLogs([]);
        await startDeployment();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      addLog(`❌ Reset failed: ${errorMessage}`);
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

    const step = deploymentState.deploymentSteps?.find(
      (s) => s.stepName === stepName
    );

    if (step) {
      return step.status as DeploymentStepStatus;
    }

    const stepIndex = stepOrder.indexOf(stepName);

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

  // Handle transaction confirmation for Flow deployment
  useEffect(() => {
    if (isTxSuccess && String(currentStep) === "flow_deploy") {
      addLog(`✅ Transaction confirmed`);
      addLog(`✅ Completed: Deploy Flow Contract`);

      checkDeploymentStatus().then(() => {
        addLog("🎉 All deployment steps completed successfully!");
        setCurrentStep("completed");
        setIsProcessing(false);
      });
    }
  }, [isTxSuccess, currentStep]);

  useEffect(() => {
    checkDeploymentStatus();
  }, [agreementId]);

  return {
    deploymentState,
    currentStep,
    isProcessing,
    logs,
    canRetry,
    pendingTxHash,
    isTxPending,
    isCreatingAgreement,
    createError,
    startDeployment,
    executeNextPendingStep,
    retryDeployment,
    resetDeployment,
    getStepStatus,
    getNextPendingStep,
  };
};
