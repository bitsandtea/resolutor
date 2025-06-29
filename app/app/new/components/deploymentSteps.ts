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
  filecoin_store_file: {
    title: "Store File on Filecoin",
    description: "Storing contract file in Filecoin access control",
    icon: "💾",
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
  "filecoin_access_deploy",
  "filecoin_store_file",
  "flow_deploy",
  "contract_signing",
];
