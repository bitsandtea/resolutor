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
