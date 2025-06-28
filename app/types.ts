export type ContractFormData = Record<
  string,
  string | number | boolean | undefined
>;

export interface FormFieldOption {
  value: string;
  label: string;
}

export interface FormFieldDependency {
  placeholderId: string;
  condition: "equals" | "notEquals" | "contains";
  value: string | number | boolean;
}

export interface FormField {
  id: string;
  label: string;
  type:
    | "text"
    | "number"
    | "date"
    | "textarea"
    | "checkbox"
    | "select"
    | "radio"
    | "group_header"
    | "preserved_line";
  dataType:
    | "string"
    | "number"
    | "integer"
    | "boolean"
    | "date"
    | "text"
    | "enum";
  options?: FormFieldOption[];
  required?: boolean;
  description?: string;
  placeholderText?: string;
  sectionId?: string;
  uiHint?: "textarea" | "radio";
  dependsOn?: FormFieldDependency;
  isSectionHeader?: boolean;
  originalLine?: string;
}

export interface ContractSection {
  sectionId: string;
  title: string;
  description?: string;
  displayOrder?: number;
}

export interface ContractPlaceholder {
  id: string;
  label: string;
  dataType:
    | "string"
    | "number"
    | "integer"
    | "boolean"
    | "date"
    | "text"
    | "enum";
  required?: boolean;
  description?: string;
  defaultValue?: string | number | boolean;
  options?: FormFieldOption[];
  uiHint?: "textarea" | "radio";
  sectionId?: string;
  dependsOn?: FormFieldDependency;
}

export interface ContractTemplateMeta {
  title: string;
  templateFile: string;
  description?: string;
}

export interface ContractDefinition {
  templateMeta: ContractTemplateMeta;
  sections?: ContractSection[];
  placeholders: ContractPlaceholder[];
}

export interface ContractSigner {
  id: string;
  name: string;
  email: string;
  role: "creator" | "signer";
  status: "pending" | "invited" | "signed" | "rejected";
  depositAmount?: number; // Optional deposit amount for this signer
  depositPaid?: boolean; // Whether this signer has paid their deposit
}

export interface SignerFormData {
  signers: ContractSigner[];
}

export interface DepositPaymentStatus {
  partyA: {
    required: boolean;
    amount: number;
    paid: boolean;
  };
  partyB: {
    required: boolean;
    amount: number;
    paid: boolean;
  };
}

// Blockchain deployment types

export type ProcessStatus =
  | "draft"
  | "db_saved"
  | "ipfs_uploaded"
  | "filecoin_deployed"
  | "flow_deployed"
  | "completed"
  | "failed";

export type DeploymentStepName =
  | "db_save"
  | "ipfs_upload"
  | "contract_signing"
  | "filecoin_access_deploy"
  | "flow_deploy";

export type DeploymentStepStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "skipped";

export interface DeploymentStep {
  id: string;
  agreementId: string;
  stepName: DeploymentStepName;
  status: DeploymentStepStatus;
  startedAt: Date;
  completedAt?: Date;
  txHash?: string;
  contractAddr?: string;
  ipfsCid?: string;
  errorMessage?: string;
  gasUsed?: string;
  blockNumber?: string;
  retryCount: number;
  maxRetries: number;
  metadata?: Record<string, any>;
}

export interface BlockchainDeploymentState {
  agreementId: string;
  processStatus: ProcessStatus;
  currentStep: string;
  lastStepAt: Date;
  errorDetails?: string;
  retryCount: number;

  // Contract addresses
  flowContractAddr?: string;
  filecoinAccessControl?: string;

  // Transaction hashes
  flowFactoryTx?: string;
  filecoinAccessTx?: string;

  // IPFS data
  cid?: string;

  // Contract signing
  contractSigned?: boolean;
  signedAt?: Date;

  // Steps
  deploymentSteps: DeploymentStep[];
}

export interface IPFSUploadResult {
  cid: string;
  fileName: string;
  fileSize: number;
  uploadedAt: Date;
}

export interface BlockchainTransactionResult {
  txHash: string;
  contractAddr?: string;
  gasUsed?: string;
  blockNumber?: string;
  success: boolean;
  errorMessage?: string;
}

// API Response types
export interface SaveContractResponse {
  agreementId: string;
  cid?: string;
  processStatus: ProcessStatus;
}

export interface DeploymentStepResponse {
  success: boolean;
  step: DeploymentStep;
  nextStep?: DeploymentStepName;
  errorMessage?: string;
}

export interface ResumeDeploymentResponse {
  success: boolean;
  currentState: BlockchainDeploymentState;
  canResume: boolean;
  nextStep?: DeploymentStepName;
}

// UI Step types expanded for new workflow
export type UIStep =
  | "selectContract"
  | "fillForm"
  | "manageSigners"
  | "reviewContract"
  | "deploymentProgress"
  | "deploymentComplete"
  | "deploymentFailed"
  | "success";

export interface NetworkConfig {
  networkName: string;
  chainId: string;
  rpcUrl: string;
  explorerUrl?: string;
  factoryAddr?: string;
  tokenAddr?: string;
  isActive: boolean;
}

// Error types for better error handling
export interface DeploymentError {
  step: DeploymentStepName;
  message: string;
  txHash?: string;
  canRetry: boolean;
  userActionRequired?: string;
}
