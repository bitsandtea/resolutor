import { BlockchainDeploymentState, DeploymentStepName } from "@/types";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import React from "react";
import { stepDefinitions } from "./deploymentSteps";

interface DeploymentActionsProps {
  isConnected: boolean;
  nextPendingStep: DeploymentStepName | null;
  isProcessing: boolean;
  deploymentState: BlockchainDeploymentState | null;
  canRetry: boolean;
  isCreatingAgreement: boolean;
  isGrantingAccess: boolean;
  isTxPending: boolean;
  pendingTxHash: string | null;
  createError: Error | null;
  executeNextPendingStep: () => void;
  startDeployment: () => void;
  retryDeployment: () => void;
  resetDeployment: () => void;
  onBack: () => void;
}

const DeploymentActions: React.FC<DeploymentActionsProps> = ({
  isConnected,
  nextPendingStep,
  isProcessing,
  deploymentState,
  canRetry,
  isCreatingAgreement,
  isGrantingAccess,
  isTxPending,
  pendingTxHash,
  createError,
  executeNextPendingStep,
  startDeployment,
  retryDeployment,
  resetDeployment,
  onBack,
}) => {
  return (
    <div className="space-y-6">
      {/* Wallet Connection */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">
              Wallet Connection
            </h3>
            <p className="text-sm text-gray-600">
              Connect your wallet to deploy contracts to the blockchain
            </p>
          </div>
          <ConnectButton />
        </div>
      </div>

      {/* Execute Next Step Button */}
      {isConnected && nextPendingStep && !isProcessing && (
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">
                Ready to Deploy
              </h3>
              <p className="text-sm text-gray-600">
                Next step:{" "}
                {
                  stepDefinitions[
                    nextPendingStep as keyof typeof stepDefinitions
                  ]?.title
                }
              </p>
            </div>
            <button
              onClick={executeNextPendingStep}
              disabled={
                isProcessing ||
                isCreatingAgreement ||
                isGrantingAccess ||
                isTxPending
              }
              className="bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isCreatingAgreement || isGrantingAccess || isTxPending ? (
                <>⏳ Processing...</>
              ) : (
                <>🚀 Execute Next Step</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-center space-x-4">
        {!isProcessing && !deploymentState && isConnected && (
          <button
            onClick={startDeployment}
            className="bg-blue-500 text-white py-3 px-6 rounded-lg hover:bg-blue-600 font-medium"
          >
            🚀 Start Deployment
          </button>
        )}

        {!isProcessing && canRetry && (
          <button
            onClick={retryDeployment}
            className="bg-yellow-500 text-white py-3 px-6 rounded-lg hover:bg-yellow-600 font-medium"
          >
            🔄 Retry Failed Step
          </button>
        )}

        {!isProcessing && deploymentState?.processStatus === "failed" && (
          <button
            onClick={resetDeployment}
            className="bg-orange-500 text-white py-3 px-6 rounded-lg hover:bg-orange-600 font-medium"
          >
            🔄 Reset & Start Over
          </button>
        )}

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

      {/* Processing Status */}
      {(isProcessing ||
        isCreatingAgreement ||
        isGrantingAccess ||
        isTxPending) && (
        <div className="text-center">
          <p className="text-gray-600">
            ⏳ Deployment in progress... Please wait.
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {isTxPending
              ? "Waiting for transaction confirmation..."
              : "This may take a few minutes depending on network conditions."}
          </p>
          {pendingTxHash && (
            <p className="text-xs text-blue-600 mt-2">
              Transaction: {pendingTxHash}
            </p>
          )}
        </div>
      )}

      {/* Wallet Errors */}
      {createError && (
        <div className="bg-red-50 p-4 rounded-lg">
          <p className="text-red-800 font-medium">Wallet Error:</p>
          <p className="text-red-600 text-sm">{createError.message}</p>
        </div>
      )}
    </div>
  );
};

export default DeploymentActions;
