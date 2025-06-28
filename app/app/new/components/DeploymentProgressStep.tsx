import { BlockchainDeploymentState } from "@/types";
import React from "react";
import { useAccount } from "wagmi";
import DeploymentActions from "./DeploymentActions";
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
  // const {
  //   grantAccess,
  //   isPending: isGrantingAccess,
  //   error: accessError,
  // } = useGrantAccess();

  const {
    deploymentState,
    currentStep,
    isProcessing,
    logs,
    canRetry,
    pendingTxHash,
    isTxPending,
    isCreatingAgreement,
    isCreatingAccess,
    createError,
    accessError: deploymentAccessError,
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
        isCreatingAccess={isCreatingAccess}
        // isGrantingAccess={isGrantingAccess}
        isTxPending={isTxPending}
        pendingTxHash={pendingTxHash}
        createError={createError || deploymentAccessError}
        // createError={createError || accessError || deploymentAccessError}
        executeNextPendingStep={executeNextPendingStep}
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

      {/* <DeploymentLogs logs={logs} /> */}

      <div className="flex justify-center pt-4">
        <button
          onClick={onBack}
          disabled={isProcessing}
          className={`py-3 px-6 rounded-lg font-medium ${
            isProcessing
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-gray-500 text-white hover:bg-gray-600"
          }`}
        >
          ← Back
        </button>
      </div>
    </div>
  );
};

export default DeploymentProgressStep;
