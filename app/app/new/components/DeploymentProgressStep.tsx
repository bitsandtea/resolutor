import { useGrantAccess } from "@/lib/storage/createStorage";
import { BlockchainDeploymentState } from "@/types";
import React from "react";
import { useAccount } from "wagmi";
import DeploymentActions from "./DeploymentActions";
import DeploymentLogs from "./DeploymentLogs";
import DeploymentProgress from "./DeploymentProgress";
import { useDeployment } from "./useDeployment";

interface DeploymentProgressStepProps {
  agreementId: string;
  onComplete: (deploymentState: BlockchainDeploymentState) => void;
  onError: (error: string) => void;
  onBack: () => void;
  contractContent: string;
  fileName: string;
}

const DeploymentProgressStep: React.FC<DeploymentProgressStepProps> = ({
  agreementId,
  onComplete,
  onError,
  onBack,
  contractContent,
  fileName,
}) => {
  const { address, isConnected } = useAccount();
  const {
    grantAccess,
    isPending: isGrantingAccess,
    error: accessError,
  } = useGrantAccess();

  const {
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
  } = useDeployment({
    agreementId,
    contractContent,
    fileName,
    onComplete,
    onError,
  });

  const nextPendingStep = getNextPendingStep();

  return (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold text-gray-800">
          Blockchain Deployment
        </h2>
        <p className="text-gray-600">
          Deploying your contract to IPFS, Filecoin, and Flow networks
        </p>
      </div>

      <DeploymentActions
        isConnected={isConnected}
        nextPendingStep={nextPendingStep}
        isProcessing={isProcessing}
        deploymentState={deploymentState}
        canRetry={canRetry}
        isCreatingAgreement={isCreatingAgreement}
        isGrantingAccess={isGrantingAccess}
        isTxPending={isTxPending}
        pendingTxHash={pendingTxHash}
        createError={createError || accessError}
        executeNextPendingStep={executeNextPendingStep}
        startDeployment={startDeployment}
        retryDeployment={retryDeployment}
        resetDeployment={resetDeployment}
        onBack={onBack}
      />

      <DeploymentProgress
        deploymentState={deploymentState}
        currentStep={currentStep}
        isProcessing={isProcessing}
        getStepStatus={getStepStatus}
      />

      <DeploymentLogs logs={logs} />
    </div>
  );
};

export default DeploymentProgressStep;
