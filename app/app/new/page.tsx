"use client";

import React, { ChangeEvent, useEffect, useState } from "react";

// --- START: Type Definitions ---
interface PlaceholderDefinition {
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

interface ContractDefinition {
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

interface FormField {
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
// --- END: Type Definitions ---

type ContractFormData = Record<string, string | number | boolean | undefined>;

const NewContractPage: React.FC = () => {
  const [uiStep, setUiStep] = useState<
    "selectContract" | "fillForm" | "generating"
  >("selectContract");
  const [availableDefinitions, setAvailableDefinitions] = useState<
    { filename: string; name: string }[]
  >([]);
  const [selectedDefinitionName, setSelectedDefinitionName] = useState<
    string | null
  >(null);
  const [currentDefinition, setCurrentDefinition] =
    useState<ContractDefinition | null>(null);

  const [contractName, setContractName] = useState<string>("MyContract");
  const [templateOriginalContent, setTemplateOriginalContent] =
    useState<string>("");
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [formData, setFormData] = useState<ContractFormData>({});
  const [isLoading, setIsLoading] = useState<boolean>(false); // Initially false, true during async ops
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Effect to fetch available contract definitions
  useEffect(() => {
    const fetchDefinitions = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const definitions = [
          {
            filename: "rentalLease.definition.json",
            name: "Rental Lease",
          },
          {
            filename: "freelanceContract.definition.json",
            name: "Freelance Contract",
          },
        ];
        setAvailableDefinitions(definitions);
      } catch (error) {
        console.error("Error fetching contract definitions:", error);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load contract definitions."
        );
        setAvailableDefinitions([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDefinitions();
  }, []);

  // Effect to load selected definition and its template
  useEffect(() => {
    if (!selectedDefinitionName) {
      setCurrentDefinition(null);
      setTemplateOriginalContent("");
      setFormFields([]);
      setFormData({});
      return;
    }

    const loadDefinitionAndTemplate = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        // Fetch the definition JSON
        const definitionResponse = await fetch(
          `/contracts/defined/${selectedDefinitionName}`
        );
        if (!definitionResponse.ok) {
          throw new Error(
            `Failed to fetch definition ${selectedDefinitionName}: ${definitionResponse.statusText}`
          );
        }
        const definitionData: ContractDefinition =
          await definitionResponse.json();
        setCurrentDefinition(definitionData);

        // Fetch the markdown template
        if (
          definitionData.templateMeta &&
          definitionData.templateMeta.templateFile
        ) {
          // Assuming templateFile is a path relative to /public, e.g., "contracts/rentalLease.md" or just "rentalLease.md"
          // Ensure the path starts correctly for fetch
          const templatePath =
            definitionData.templateMeta.templateFile.startsWith("/")
              ? definitionData.templateMeta.templateFile
              : `/${definitionData.templateMeta.templateFile}`;

          const templateResponse = await fetch(templatePath);
          if (!templateResponse.ok) {
            throw new Error(
              `Failed to fetch template ${templatePath}: ${templateResponse.statusText}`
            );
          }
          const templateText = await templateResponse.text();
          setTemplateOriginalContent(templateText);

          // Placeholder for new parsing logic
          // parseContractDefinitionFromJson(definitionData, templateText);
          // For now, clear old fields
          setFormFields([]);
          setFormData({});
          if (definitionData.templateMeta.title) {
            setContractName(
              definitionData.templateMeta.title.replace(/\s+/g, "_") + "_Filled"
            );
          }
        } else {
          throw new Error("Template file path not specified in definition.");
        }
        setUiStep("fillForm"); // Move to form filling step
      } catch (error) {
        console.error("Error loading definition or template:", error);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load selected contract details."
        );
        setCurrentDefinition(null);
        setTemplateOriginalContent("");
        setFormFields([]);
        setUiStep("selectContract"); // Revert to selection on error
      } finally {
        setIsLoading(false);
      }
    };

    loadDefinitionAndTemplate();
  }, [selectedDefinitionName]);

  const parseMarkdownTemplate = (markdown: string) => {
    // THIS FUNCTION WILL BE REPLACED by parseContractDefinitionFromJson
    // For now, let's keep it to avoid breaking the rest of the file during partial updates
    // but it should not be called if currentDefinition is set.
    if (currentDefinition) return; // Prevent old parser from running

    const lines = markdown.split("\n");
    const parsedFields: FormField[] = [];
    const initialFormData: ContractFormData = {};
    let currentRadioGroupName: string | null = null;
    let radioGroupIndex = 0;

    lines.forEach((line, index) => {
      const lineNumber = index;
      const placeholderRegex = /(`?{{\s*([\w_]+)\s*}}`?)/g;
      const checkboxRegex = /^\s*\*\s*\[(\s|x|X)?\]\s*(.*)/;
      const radioHeaderRegex = /^(.*\S.*)\s*\(select one\):\s*$/i;
      let fieldAddedForLine = false;

      const radioHeaderMatch = line.match(radioHeaderRegex);
      if (radioHeaderMatch && currentDefinition === null) {
        // only run old logic if no new definition
        currentRadioGroupName = `radio_group_${radioGroupIndex++}_${radioHeaderMatch[1]
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "_")}`;
        parsedFields.push({
          id: currentRadioGroupName + "_header",
          label: radioHeaderMatch[1].trim(),
          type: "preserved_line",
          originalLine: line,
          groupName: currentRadioGroupName,
          lineNumber,
          dataType: "string",
        });
        initialFormData[currentRadioGroupName] = "";
        fieldAddedForLine = true;
      } else if (line.match(/^\s*\*\s*\[/) && currentDefinition === null) {
        const itemMatch = line.match(checkboxRegex);
        if (itemMatch) {
          const isCheckedInitial = itemMatch[1]?.trim().toLowerCase() === "x";
          const optionLabel = itemMatch[2].trim();
          const optionVarPlaceholder = optionLabel.match(placeholderRegex);
          const baseOptionLabel = optionLabel
            .replace(placeholderRegex, "")
            .trim();
          const baseId = `item_${lineNumber}_${baseOptionLabel
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "_")
            .substring(0, 20)}`;

          if (currentRadioGroupName && line.match(/^\s{2,}\*\s*\[/)) {
            const radioOptionId = `${baseId}_radio_option`;
            parsedFields.push({
              id: radioOptionId,
              label: baseOptionLabel,
              type: "radio",
              originalLine: line,
              groupName: currentRadioGroupName,
              placeholderText: optionLabel,
              isRadioOption: true,
              lineNumber,
              dataType: "string",
            });
            if (optionVarPlaceholder) {
              const varName = optionVarPlaceholder[0].replace(
                /`?{{\s*|\s*}}`?/g,
                ""
              );
              const varInputId = `var_${varName}_for_${radioOptionId}`;
              parsedFields.push({
                id: varInputId,
                label: `${baseOptionLabel} - ${varName.replace(/_/g, " ")}`,
                type: inferInputType(varName, line, optionVarPlaceholder[0]),
                originalLine: optionVarPlaceholder[0],
                placeholderText: optionVarPlaceholder[0],
                lineNumber: lineNumber + 0.1,
                dataType: "string",
              });
              initialFormData[varInputId] = "";
            }
          } else {
            const checkboxId = `${baseId}_checkbox`;
            parsedFields.push({
              id: checkboxId,
              label: baseOptionLabel,
              type: "checkbox",
              originalLine: line,
              isChecked: isCheckedInitial,
              placeholderText: optionLabel,
              lineNumber,
              dataType: "string",
            });
            initialFormData[checkboxId] = isCheckedInitial;
            currentRadioGroupName = null;
          }
          fieldAddedForLine = true;
        }
      } else {
        currentRadioGroupName = null;
      }

      if (!fieldAddedForLine) {
        let lastIndex = 0;
        let lineHasInputs = false;
        let match;
        while ((match = placeholderRegex.exec(line)) !== null) {
          lineHasInputs = true;
          if (match.index > lastIndex) {
            // Potentially add text part before placeholder here if needed for layout
          }
          const fullPlaceholder = match[0];
          const varName = match[1];
          const inputId = `var_${varName}`;
          const inputType = inferInputType(varName, line, fullPlaceholder);
          parsedFields.push({
            id: inputId,
            label: extractLabel(line, fullPlaceholder, varName),
            type: inputType,
            originalLine: line,
            placeholderText: fullPlaceholder,
            lineNumber,
            dataType: "string",
          });
          initialFormData[inputId] = "";
          lastIndex = placeholderRegex.lastIndex;
        }
        if (!lineHasInputs) {
          parsedFields.push({
            id: `preserved_${lineNumber}`,
            label: "",
            type: "preserved_line",
            originalLine: line,
            lineNumber,
            dataType: "string",
          });
        }
      }
    });
    parsedFields.sort((a, b) => (a.lineNumber || 0) - (b.lineNumber || 0));
    setFormFields(parsedFields);
    setFormData(initialFormData);
  };

  const inferInputType = (
    varName: string,
    line: string,
    placeholder: string
  ): FormField["type"] => {
    // THIS FUNCTION WILL BE REPLACED
    if (currentDefinition) return "text"; // Default for new logic until fully replaced
    const lowerVar = varName.toLowerCase();
    if (lowerVar.includes("date")) return "date";
    if (
      lowerVar.includes("amount") ||
      lowerVar.includes("rent") ||
      lowerVar.includes("fee") ||
      lowerVar.includes("deposit") ||
      lowerVar.includes("percent")
    )
      return "number";
    if (line.trim() === placeholder) return "textarea";
    return "text";
  };

  const extractLabel = (
    line: string,
    placeholder: string,
    varName: string
  ): string => {
    // THIS FUNCTION WILL BE REPLACED
    if (currentDefinition) return varName.replace(/_/g, " "); // Default for new logic
    const parts = line.split(placeholder);
    const precedingText = parts[0].trim();
    if (
      precedingText &&
      !precedingText.endsWith(":") &&
      !precedingText.endsWith("-") &&
      precedingText.length > 3
    ) {
      const labelCandidate = precedingText.split(/[:*-]/).pop()?.trim();
      if (labelCandidate) return labelCandidate;
    }
    return varName.replace(/_/g, " ");
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const { checked } = e.target as HTMLInputElement;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else if (type === "radio") {
      const radioGroupName = (e.target as HTMLInputElement).name;
      setFormData((prev) => ({ ...prev, [radioGroupName]: value }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const generateContractText = (): string => {
    const outputLines = templateOriginalContent.split("\n");
    formFields.forEach((field) => {
      if (field.type === "preserved_line") return;
      let lineToUpdate = outputLines[field.lineNumber || 0];
      if (lineToUpdate === undefined) return;

      if (field.type === "checkbox") {
        const isChecked = formData[field.id] as boolean;
        const newCheckboxState = isChecked ? "[x]" : "[ ]";
        const originalCheckboxMarker = field.originalLine?.match(
          /^(\s*\*\s*\[(\s|x|X)?\])/
        )?.[0];
        if (originalCheckboxMarker) {
          lineToUpdate = lineToUpdate.replace(
            originalCheckboxMarker,
            originalCheckboxMarker.replace(
              /\s*\[(\s|x|X)?\]\s*/,
              ` ${newCheckboxState} `
            )
          );
        }
      } else if (field.isRadioOption && field.groupName) {
        const radioGroupValue = formData[field.groupName] as string;
        const isSelected = field.id === radioGroupValue;
        const newRadioState = isSelected ? "[x]" : "[ ]";
        const originalRadioMarker = field.originalLine?.match(
          /^(\s*\*\s*\[(\s|x|X)?\])/
        )?.[0];
        if (originalRadioMarker) {
          lineToUpdate = lineToUpdate.replace(
            originalRadioMarker,
            originalRadioMarker.replace(
              /\s*\[(\s|x|X)?\]\s*/,
              ` ${newRadioState} `
            )
          );
        }
      } else if (field.placeholderText) {
        const valueToInsert = String(
          formData[field.id] === undefined ? "" : formData[field.id]
        );
        const placeholderEscaped = field.placeholderText.replace(
          /[.*+\-?^{}()|[\]\\]/g,
          "\\$&"
        );
        lineToUpdate = lineToUpdate.replace(
          new RegExp(placeholderEscaped, "g"),
          valueToInsert
        );
      }
      outputLines[field.lineNumber || 0] = lineToUpdate;
    });
    return outputLines.join("\n");
  };

  const handleSaveContract = async () => {
    if (!currentDefinition) {
      setErrorMessage("No contract definition loaded.");
      return;
    }
    setIsLoading(true);
    setUiStep("generating");
    setErrorMessage(null);

    const populatedContract = generateContractText();
    console.log("Generated Contract (to be saved):\n", populatedContract);

    const filename = `${
      contractName.replace(/[^a-z0-9_\-]/gi, "_") || "contract"
    }.md`;

    try {
      const response = await fetch("/api/save-contract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ filename, content: populatedContract }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `Failed to save contract: ${response.statusText}`
        );
      }
      const result = await response.json();
      alert(`Contract saved successfully: ${result.path}`);
    } catch (error) {
      console.error("Error saving contract:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to save contract."
      );
    } finally {
      setIsLoading(false);
      setUiStep("fillForm");
    }
  };

  const inputBaseClasses =
    "w-full py-2.5 px-3 border border-gray-300 rounded text-base text-gray-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none";

  const renderFormField = (field: FormField) => {
    if (!currentDefinition) {
      const commonProps = {
        name: field.id,
        id: field.id,
        onChange: handleChange,
        key: field.id,
      };
      if (
        field.type === "text" ||
        field.type === "date" ||
        field.type === "number"
      ) {
        return (
          <div key={field.id} className="mb-5">
            <label
              htmlFor={field.id}
              className="block mb-2 font-semibold text-gray-700 text-sm"
            >
              {field.label}:
            </label>
            <input
              type={field.type}
              {...commonProps}
              value={(formData[field.id] as string) || ""}
              className={inputBaseClasses}
            />
          </div>
        );
      } else if (field.type === "textarea") {
        return (
          <div key={field.id} className="mb-5">
            <label
              htmlFor={field.id}
              className="block mb-2 font-semibold text-gray-700 text-sm"
            >
              {field.label}:
            </label>
            <textarea
              {...commonProps}
              value={(formData[field.id] as string) || ""}
              rows={3}
              className={`${inputBaseClasses} min-h-[80px] resize-y`}
            ></textarea>
          </div>
        );
      }
      return (
        <div key={field.id} className="my-1 text-sm text-gray-500">
          {" "}
          (Old field: {field.label || field.originalLine})
        </div>
      );
    }
    return (
      <div key={field.id} className="my-1 text-sm text-blue-500">
        Field: {field.label} (ID: {field.id}) - Type: {field.dataType} (UI:{" "}
        {field.type})
      </div>
    );
  };

  if (
    isLoading &&
    uiStep === "selectContract" &&
    availableDefinitions.length === 0
  ) {
    return (
      <div className="flex flex-col items-center justify-center flex-grow">
        <p className="text-gray-600 text-lg">Loading available contracts...</p>
        {errorMessage && <p className="text-red-500 mt-2">{errorMessage}</p>}
      </div>
    );
  }

  if (uiStep === "selectContract") {
    return (
      <div className="flex flex-col items-center w-full p-4">
        <h1 className="text-4xl font-bold text-gray-800 mb-6">
          Select a Contract Template
        </h1>
        {errorMessage && <p className="text-red-500 mb-4">{errorMessage}</p>}
        {availableDefinitions.length === 0 && !isLoading && (
          <p className="text-gray-600">
            No contract definitions found in{" "}
            <code>/public/contracts/defined/</code>.
          </p>
        )}
        {availableDefinitions.length > 0 && (
          <ul className="w-full max-w-md bg-white p-6 rounded-lg shadow-lg">
            {availableDefinitions.map((def) => (
              <li key={def.filename} className="mb-3">
                <button
                  onClick={() => setSelectedDefinitionName(def.name)}
                  className="w-full text-left py-3 px-4 bg-gray-100 hover:bg-blue-500 hover:text-white rounded-md transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  {def.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (isLoading && uiStep === "fillForm" && !currentDefinition) {
    return (
      <div className="flex flex-col items-center justify-center flex-grow">
        <p className="text-gray-600 text-lg">
          Loading contract details for {selectedDefinitionName}...
        </p>
        {errorMessage && <p className="text-red-500 mt-2">{errorMessage}</p>}
      </div>
    );
  }

  if (uiStep === "fillForm" && !currentDefinition && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center flex-grow">
        <p className="text-red-500 text-lg">
          Failed to load contract details. Please try selecting a contract
          again.
        </p>
        <button
          onClick={() => setUiStep("selectContract")}
          className="mt-4 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
        >
          Back to Selection
        </button>
      </div>
    );
  }

  if (isLoading || uiStep === "generating") {
    return (
      <div className="flex flex-col items-center justify-center flex-grow">
        <p className="text-gray-600 text-lg">
          {uiStep === "generating"
            ? `Generating ${contractName}...`
            : "Loading..."}
        </p>
        {errorMessage && <p className="text-red-500 mt-2">{errorMessage}</p>}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col items-center w-full">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">
          New Contract Wizard
        </h1>
        {currentDefinition && uiStep === "fillForm" ? (
          <>
            <p className="text-lg text-gray-600 mb-2">
              Selected Contract:{" "}
              <span className="font-semibold">
                {currentDefinition.templateMeta.title}
              </span>
            </p>
            <p className="text-sm text-gray-500 mb-8">
              Definition: {selectedDefinitionName}
            </p>
          </>
        ) : (
          <p className="text-lg text-gray-600 mb-8">
            Follow the steps below to generate your new contract.
          </p>
        )}
        {errorMessage && uiStep === "fillForm" && (
          <p className="text-red-500 mb-4">{errorMessage}</p>
        )}

        <div className="w-full max-w-3xl bg-white p-8 rounded-lg shadow-xl">
          {uiStep === "fillForm" && currentDefinition && (
            <>
              <div className="mb-6">
                <label
                  htmlFor="contractName"
                  className="block mb-2 font-semibold text-gray-700 text-sm"
                >
                  Contract Name (for generated file):
                </label>
                <input
                  type="text"
                  id="contractName"
                  value={contractName}
                  onChange={(e) => setContractName(e.target.value)}
                  placeholder="e.g., MyRentalAgreement_Jan2024"
                  className={inputBaseClasses}
                />
              </div>

              <h2 className="text-2xl font-semibold mb-6 mt-8 text-gray-800 border-b pb-3">
                Fill Contract Details
              </h2>
              {formFields.length > 0 ? (
                formFields.map((field) => renderFormField(field))
              ) : (
                <p className="text-gray-500">
                  Form fields will appear here once the definition is processed.
                </p>
              )}

              {templateOriginalContent &&
                formFields.length === 0 &&
                !isLoading &&
                !errorMessage && (
                  <p className="text-gray-600 mt-4">
                    Definition loaded. Preparing form...
                  </p>
                )}

              {!isLoading &&
                formFields.length === 0 &&
                currentDefinition &&
                !errorMessage && (
                  <p className="text-orange-500 mt-4">
                    No form fields generated yet. This indicates the parsing
                    logic (next step) is pending or the definition's
                    placeholders array is empty.
                  </p>
                )}

              <button
                onClick={handleSaveContract}
                className="bg-blue-600 text-white py-3 px-5 rounded-md cursor-pointer text-lg transition-colors duration-200 ease-in-out w-full mt-6 hover:bg-blue-700 disabled:opacity-50"
                disabled={isLoading || !currentDefinition}
              >
                {isLoading ? "Generating..." : "Generate & Save Contract"}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default NewContractPage;
