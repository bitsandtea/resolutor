"use client";

import React, { ChangeEvent, useEffect, useState } from "react";

// Define the structure for a form field derived from the template
interface FormField {
  id: string; // Unique ID for the form element, derived from variable name or line number
  label: string; // Label to display for the field
  type:
    | "text"
    | "date"
    | "number"
    | "textarea"
    | "checkbox"
    | "radio"
    | "preserved_line";
  options?: { label: string; value: string }[]; // For radio groups: text shown to user and value stored
  originalLine: string; // The original line from the template, for context and reconstruction
  placeholderText?: string; // The original {{VAR_NAME}} or checkbox/radio option text
  groupName?: string; // For radio buttons, to group them
  isChecked?: boolean; // For checkboxes, initial state and current state
  isRadioOption?: boolean; // True if this field is an option within a radio group
  lineNumber: number; // Original line number for sorting and reconstruction
}

// Type for the form data store
type ContractFormData = Record<string, string | number | boolean>;

const NewContractPage: React.FC = () => {
  const [contractName, setContractName] = useState<string>("MyContract");
  const [templateOriginalContent, setTemplateOriginalContent] =
    useState<string>("");
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [formData, setFormData] = useState<ContractFormData>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const templatePath = "/rentalLease.md"; // Assuming rentalLease.md is in the public folder

  useEffect(() => {
    const fetchTemplateAndParse = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(templatePath);
        if (!response.ok) {
          throw new Error(`Failed to fetch template: ${response.statusText}`);
        }
        const text = await response.text();
        setTemplateOriginalContent(text);
        parseMarkdownTemplate(text);
      } catch (error) {
        console.error("Error fetching or parsing template:", error);
        setFormFields([
          {
            id: "error",
            label: "Error loading template.",
            type: "preserved_line",
            originalLine: "",
            lineNumber: 0,
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTemplateAndParse();
  }, []);

  const parseMarkdownTemplate = (markdown: string) => {
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
      if (radioHeaderMatch) {
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
        });
        initialFormData[currentRadioGroupName] = "";
        fieldAddedForLine = true;
      } else if (line.match(/^\s*\*\s*\[/)) {
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
            });
            initialFormData[checkboxId] = isCheckedInitial;
            if (optionVarPlaceholder) {
              const varName = optionVarPlaceholder[0].replace(
                /`?{{\s*|\s*}}`?/g,
                ""
              );
              const varInputId = `var_${varName}_for_${checkboxId}`;
              parsedFields.push({
                id: varInputId,
                label: `${baseOptionLabel} - ${varName.replace(/_/g, " ")}`,
                type: inferInputType(varName, line, optionVarPlaceholder[0]),
                originalLine: optionVarPlaceholder[0],
                placeholderText: optionVarPlaceholder[0],
                lineNumber: lineNumber + 0.1,
              });
              initialFormData[varInputId] = "";
            }
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
          });
        }
      }
    });
    parsedFields.sort((a, b) => a.lineNumber - b.lineNumber);
    setFormFields(parsedFields);
    setFormData(initialFormData);
  };

  const inferInputType = (
    varName: string,
    line: string,
    placeholder: string
  ): FormField["type"] => {
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
      setFormFields((prevFields) =>
        prevFields.map((f) =>
          f.id === name ? { ...f, isChecked: checked } : f
        )
      );
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
      let lineToUpdate = outputLines[field.lineNumber];
      if (lineToUpdate === undefined) return;

      if (field.type === "checkbox") {
        const isChecked = formData[field.id] as boolean;
        const newCheckboxState = isChecked ? "[x]" : "[ ]";
        const originalCheckboxMarker = field.originalLine.match(
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
        const originalRadioMarker = field.originalLine.match(
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
      outputLines[field.lineNumber] = lineToUpdate;
    });
    return outputLines.join("\n");
  };

  const handleGenerateAndDownload = () => {
    const populatedContract = generateContractText();
    console.log("Generated Contract:\n", populatedContract);
    const blob = new Blob([populatedContract], {
      type: "text/plain;charset=utf-8",
    });
    const link = document.createElement("a");
    const safeContractName =
      contractName.replace(/[^a-z0-9_\-]/gi, "_") || "contract";
    link.href = URL.createObjectURL(blob);
    link.download = `${safeContractName}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const inputBaseClasses =
    "w-full py-2.5 px-3 border border-gray-300 rounded text-base text-gray-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none";

  const renderFormField = (field: FormField) => {
    const commonProps = {
      name: field.id,
      id: field.id,
      onChange: handleChange,
      key: field.id,
    };
    const associatedVarField = formFields.find(
      (f) =>
        f.id.endsWith(`_for_${field.id}`) &&
        f.lineNumber > field.lineNumber &&
        f.lineNumber < field.lineNumber + 1
    );

    switch (field.type) {
      case "text":
      case "date":
      case "number":
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
      case "textarea":
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
      case "checkbox":
        return (
          <div
            key={field.id}
            className="border border-gray-200 p-4 rounded-md mt-2 mb-5"
          >
            <input
              type="checkbox"
              {...commonProps}
              checked={(formData[field.id] as boolean) || false}
              className="w-auto mr-2 align-middle"
            />
            <label
              htmlFor={field.id}
              className="font-normal ml-[5px] align-middle text-gray-700 text-sm"
            >
              {field.label}
            </label>
            {associatedVarField && (
              <div className="mt-2 ml-5">
                {renderFormField(associatedVarField)}
              </div>
            )}
          </div>
        );
      case "radio":
        if (!field.groupName || !field.isRadioOption) return null;
        return (
          <div key={field.id} className="mb-2">
            <input
              type="radio"
              {...commonProps}
              name={field.groupName}
              value={field.id}
              checked={formData[field.groupName] === field.id}
              className="w-auto mr-2 align-middle"
            />
            <label
              htmlFor={field.id}
              className="font-normal ml-[5px] align-middle text-gray-700 text-sm"
            >
              {field.label}
            </label>
            {associatedVarField && (
              <div className="mt-2 ml-5">
                {renderFormField(associatedVarField)}
              </div>
            )}
          </div>
        );
      case "preserved_line":
        if (field.groupName && field.id.endsWith("_header")) {
          const radioOptions = formFields.filter(
            (f) => f.groupName === field.groupName && f.isRadioOption
          );
          return (
            <div
              key={field.id}
              className="border border-gray-200 p-4 rounded-md mt-2 mb-5"
            >
              <p className="block mb-2 font-semibold text-gray-700 text-sm">
                {field.label} (select one):
              </p>
              {radioOptions.map((opt) => renderFormField(opt))}
            </div>
          );
        }
        return (
          <div
            key={field.id}
            className="whitespace-pre-wrap my-[5px] text-gray-800"
            dangerouslySetInnerHTML={{
              __html: field.originalLine
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;"),
            }}
          />
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center flex-grow">
        <p className="text-gray-600 text-lg">Loading template...</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col items-center w-full">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">
          New Contract Wizard
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Follow the steps below to generate your new contract.
        </p>
        <div className="w-full max-w-3xl bg-white p-8 rounded-lg shadow-xl">
          <div className="mb-6">
            <label
              htmlFor="contractName"
              className="block mb-2 font-semibold text-gray-700 text-sm"
            >
              Contract Name:
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
          {formFields.map((field) => renderFormField(field))}

          {templateOriginalContent &&
            !formFields.some((f) => f.type !== "preserved_line") && (
              <p className="text-gray-600 mt-4">
                No dynamic fields were found in the template. The original
                template will be used.
              </p>
            )}

          <button
            onClick={handleGenerateAndDownload}
            className="bg-blue-600 text-white py-3 px-5 rounded-md cursor-pointer text-lg transition-colors duration-200 ease-in-out w-full mt-6 hover:bg-blue-700 disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? "Loading..." : "Generate & Download Contract"}
          </button>
        </div>
      </div>
    </>
  );
};

export default NewContractPage;
