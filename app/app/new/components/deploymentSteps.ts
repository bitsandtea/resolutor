import { DeploymentStepName } from "@/types";

// Step definitions for UI display (excluding db_save which is internal)
export const stepDefinitions: Record<
  Exclude<DeploymentStepName, "db_save">,
  { title: string; description: string; icon: string }
> = {
  ipfs_upload: {
    title: "Upload to IPFS",
    description: "Uploading contract to decentralized storage",
    icon: "��",
  },
  filecoin_access_deploy: {
    title: "Deploy to Filecoin",
    description: "Creating access control and storing file in one transaction",
    icon: "🔐",
  },
  flow_deploy: {
    title: "Create & Sign Agreement",
    description: "Deploying Flow contract and signing in one transaction",
    icon: "🚀",
  },
};

export const stepOrder: DeploymentStepName[] = [
  "ipfs_upload",
  "filecoin_access_deploy",
  "flow_deploy",
];
