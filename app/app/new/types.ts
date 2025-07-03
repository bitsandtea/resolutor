export interface PlaceholderDefinition {
  id: string;
  label: string;
  dataType:
    | "string"
    | "text"
    | "number"
    | "integer"
    | "date"
    | "boolean"
    | "enum";
  description?: string;
  required?: boolean;
  sectionId?: string;
  defaultValue?: any;
  options?: { value: string; label: string }[];
  validationRules?: any;
  uiHint?: "textarea" | "checkbox" | "radio" | "dropdown" | string;
  dependsOn?: {
    placeholderId: string;
    value: any;
    condition?: "equals" | "notEquals" | "contains";
  };
}

export interface ContractDefinition {
  templateMeta: {
    templateId: string;
    title: string;
    version?: string;
    description?: string;
    templateFile?: string; // Path to the .md template, relative to /public
  };
  parties?: Array<{ roleId: string; roleLabel: string; [key: string]: any }>;
  sections?: Array<{
    sectionId: string;
    title: string;
    description?: string;
    displayOrder?: number;
  }>;
  placeholders: PlaceholderDefinition[];
  signatureBlocks?: Array<{ [key: string]: any }>;
}

export interface FormField {
  id: string;
  label: string;
  type:
    | "text"
    | "date"
    | "number"
    | "textarea"
    | "checkbox"
    | "radio"
    | "select"
    | "preserved_line"
    | "group_header";
  options?: { label: string; value: string }[];
  originalLine?: string; // For section titles or descriptions
  placeholderText?: string; // Hint for user
  groupName?: string; // For radio buttons if placeholder.dataType === 'enum' && placeholder.uiHint === 'radio'
  isChecked?: boolean; // For checkboxes, formData[id] will hold this. Temporarily re-added for old code.
  isRadioOption?: boolean; // UI rendering hint
  lineNumber?: number; // Order derived from definition.json and sections. Temporarily re-added for old code.
  dataType: PlaceholderDefinition["dataType"];
  required?: boolean;
  description?: string;
  sectionId?: string;
  uiHint?: PlaceholderDefinition["uiHint"];
  dependsOn?: PlaceholderDefinition["dependsOn"];
  isSectionHeader?: boolean; // To render section titles
}

export type ContractFormData = Record<
  string,
  string | number | boolean | undefined
>;

export interface ContractSigner {
  id: string;
  name: string;
  email: string;
  role: "creator" | "signer";
  status: "pending" | "signed" | "rejected";
  depositAmount?: number;
}

// New types for blockchain deployment process

export type ProcessStatus =
  | "draft"
  | "db_saved"
  | "ipfs_uploaded"
  | "filecoin_access_deployed"
  | "flow_deployed"
  | "completed"
  | "failed";

export type DeploymentStepName =
  | "db_save"
  | "ipfs_upload"
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
  filecoinStorageTx?: string;
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

// UI Step types - imported from main types file

// Error types for better error handling
export interface DeploymentError {
  step: DeploymentStepName;
  message: string;
  txHash?: string;
  canRetry: boolean;
  userActionRequired?: string;
}
