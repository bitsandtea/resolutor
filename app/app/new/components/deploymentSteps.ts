import { DeploymentStepName } from "@/types";

// Step definitions for UI display (excluding db_save which is internal)
export const stepDefinitions: Record<
  Exclude<DeploymentStepName, "db_save">,
  { title: string; description: string; icon: string }
> = {
  ipfs_upload: {
    title: "Upload to IPFS",
    description: "Uploading contract to decentralized storage",
    icon: "📁",
  },
  filecoin_access_deploy: {
    title: "Deploy Access Control",
    description: "Creating Filecoin access control contract",
    icon: "🔐",
  },
  flow_deploy: {
    title: "Deploy Flow Contract",
    description: "Creating Flow agreement contract",
    icon: "⚡",
  },
  contract_signing: {
    title: "Sign Contract",
    description: "Digitally sign the contract before deployment",
    icon: "✍️",
  },
};

export const stepOrder: DeploymentStepName[] = [
  "ipfs_upload",
  "contract_signing",
  "filecoin_access_deploy",
  "flow_deploy",
];
