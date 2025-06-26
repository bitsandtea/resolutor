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
    | "group_header";
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
  status: "pending" | "invited" | "signed";
  depositAmount?: number; // Optional deposit amount for this signer
}

export interface SignerFormData {
  signers: ContractSigner[];
}
