import {
 BlockchainDeploymentState,
 DeploymentStepName,
 DeploymentStepStatus,
} from "@/types";
import React from "react";
import { stepDefinitions } from "./deploymentSteps";

interface DeploymentProgressProps {
  deploymentState: BlockchainDeploymentState | null;
  currentStep: DeploymentStepName | "completed" | null;
  isProcessing: boolean;
  getStepStatus: (stepName: DeploymentStepName) => DeploymentStepStatus;
}

const DeploymentProgress: React.FC<DeploymentProgressProps> = ({
  deploymentState,
  currentStep,
  isProcessing,
  getStepStatus,
}) => {
  const renderStepIcon = (stepName: DeploymentStepName) => {
    const status = getStepStatus(stepName);
    const stepDef = stepDefinitions[stepName as keyof typeof stepDefinitions];

    switch (status) {
      case "completed":
        return <span className="text-green-500 text-2xl">✅</span>;
      case "in_progress":
        return <span className="text-blue-500 text-2xl animate-spin">⏳</span>;
      case "failed":
        return <span className="text-red-500 text-2xl">❌</span>;
      default:
        return (
          <span className="text-gray-400 text-2xl">
            {stepDef?.icon || "⚙️"}
          </span>
        );
    }
  };

  return (
    <div className="bg-gray-50 p-6 rounded-lg">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        Deployment Progress
      </h3>

      <div className="space-y-4">
        {(Object.keys(stepDefinitions) as (keyof typeof stepDefinitions)[]).map(
          (stepName, index) => {
            const stepDef = stepDefinitions[stepName];
            const status = getStepStatus(stepName as DeploymentStepName);

            return (
              <div key={stepName} className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  {renderStepIcon(stepName as DeploymentStepName)}
                </div>
                <div className="flex-grow">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-800">
                      {stepDef.title}
                    </h4>
                    <span
                      className={`text-sm px-2 py-1 rounded ${
                        status === "completed"
                          ? "bg-green-100 text-green-800"
                          : status === "in_progress"
                          ? "bg-blue-100 text-blue-800"
                          : status === "failed"
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {status.charAt(0).toUpperCase() +
                        status.slice(1).replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{stepDef.description}</p>

                  {/* Show transaction details if available */}
                  {deploymentState && deploymentState.deploymentSteps && (
                    <>
                      {deploymentState.deploymentSteps
                        .filter((s) => s.stepName === stepName)
                        .map((step) => (
                          <div key={step.id} className="text-xs mt-1 space-y-1">
                            {step.txHash && (
                              <p className="text-blue-600">
                                📋 TX: {step.txHash.slice(0, 10)}...
                                {step.txHash.slice(-8)}
                              </p>
                            )}
                            {step.contractAddr && (
                              <p className="text-green-600">
                                📍 Contract: {step.contractAddr.slice(0, 8)}...
                                {step.contractAddr.slice(-6)}
                              </p>
                            )}
                            {step.ipfsCid && (
                              <p className="text-purple-600">
                                🗂️ IPFS: {step.ipfsCid.slice(0, 12)}...
                                {step.ipfsCid.slice(-8)}
                              </p>
                            )}
                            {step.errorMessage && (
                              <p className="text-red-600">
                                ❌ Error: {step.errorMessage}
                              </p>
                            )}
                          </div>
                        ))}
                    </>
                  )}

                  {/* Show deployment state details for completed steps */}
                  {deploymentState && status === "completed" && (
                    <div className="text-xs mt-1 space-y-1">
                      {stepName === "ipfs_upload" && deploymentState.cid && (
                        <>
                          <p className="text-purple-600">
                            🗂️ CID: {deploymentState.cid.slice(0, 12)}...
                            {deploymentState.cid.slice(-8)}
                          </p>
                          <a
                            href={`https://gateway.lighthouse.storage/ipfs/${deploymentState.cid}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline block"
                          >
                            🔗 View on IPFS Gateway
                          </a>
                        </>
                      )}
                      {stepName === "contract_signing" &&
                        deploymentState.contractSigned && (
                          <p className="text-green-600">✅ Contract Signed</p>
                        )}
                      {stepName === "filecoin_access_deploy" &&
                        deploymentState.filecoinAccessControl && (
                          <p className="text-green-600">
                            📍 Access Control:{" "}
                            {deploymentState.filecoinAccessControl.slice(0, 8)}
                            ...{deploymentState.filecoinAccessControl.slice(-6)}
                          </p>
                        )}
                      {stepName === "flow_deploy" &&
                        deploymentState.flowContractAddr && (
                          <p className="text-green-600">
                            📍 Flow Contract:{" "}
                            {deploymentState.flowContractAddr.slice(0, 8)}...
                            {deploymentState.flowContractAddr.slice(-6)}
                          </p>
                        )}
                    </div>
                  )}
                </div>
              </div>
            );
          }
        )}
      </div>
    </div>
  );
};

export default DeploymentProgress;
