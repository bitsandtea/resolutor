"use client";

import { TransactionProvider } from "@/lib/context/TransactionContext";
import {
  BlockchainDeploymentState,
  ContractDefinition,
  ContractFormData,
  ContractPlaceholder,
  ContractSection,
  ContractSigner,
  FormField,
  UIStep,
} from "@/types";
import React, { ChangeEvent, useEffect, useState } from "react";
import ContractFormStep from "./components/ContractFormStep";
import ContractSelectionStep from "./components/ContractSelectionStep";
import ContractSignersStep from "./components/ContractSignersStep";
import DeploymentProgressStep from "./components/DeploymentProgressStep";

// Custom hook for intervals
function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = React.useRef<() => void>();

  React.useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  React.useEffect(() => {
    function tick() {
      savedCallback.current?.();
    }
    if (delay !== null) {
      const id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}

// --- START: Type Definitions ---
// Removed local type definitions as they are now imported
// --- END: Type Definitions ---

// type ContractFormData = Record<string, string | number | boolean | undefined>; // Also removed, part of imported types

const NewContractPage: React.FC = () => {
  const [uiStep, setUiStep] = useState<UIStep>("selectContract");
  const [availableDefinitions, setAvailableDefinitions] = useState<
    { filename: string; name: string }[]
  >([]);
  const [selectedDefinitionFilename, setSelectedDefinitionFilename] = useState<
    string | null
  >(null);
  const [currentDefinition, setCurrentDefinition] =
    useState<ContractDefinition | null>(null);

  const [contractName, setContractName] = useState<string>("MyContract");
  const [templateOriginalContent, setTemplateOriginalContent] =
    useState<string>("");
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [formData, setFormData] = useState<ContractFormData>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [signers, setSigners] = useState<ContractSigner[]>([]);
  const [contractResult, setContractResult] = useState<{
    agreementId: string;
    cid?: string;
  } | null>(null);
  const [preDeploymentIsLoading, setPreDeploymentIsLoading] =
    useState<boolean>(false);
  const [deploymentState, setDeploymentState] =
    useState<BlockchainDeploymentState | null>(null);

  // Draft persistence state
  const [draftId, setDraftId] = useState<string | null>(null);
  const [isDraftLoading, setIsDraftLoading] = useState<boolean>(false);
  const [isDraftSaving, setIsDraftSaving] = useState<boolean>(false);
  const [draftWasLoaded, setDraftWasLoaded] = useState<boolean>(false);

  // Step transition loading state
  const [isStepTransitioning, setIsStepTransitioning] =
    useState<boolean>(false);

  // Effect to load draft on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlDraftId = urlParams.get("draftId");

    if (urlDraftId) {
      // Load specific draft from URL
      loadDraft(urlDraftId);
    }
    // If no draftId in URL, start fresh - don't load any draft
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update URL when draftId changes
  useEffect(() => {
    if (draftId) {
      const url = new URL(window.location.href);
      url.searchParams.set("draftId", draftId);
      window.history.replaceState({}, "", url.toString());
    }
  }, [draftId]);

  // Auto-save effect - save draft when important data changes
  useInterval(() => {
    if (
      uiStep !== "selectContract" &&
      selectedDefinitionFilename &&
      !isDraftLoading &&
      uiStep !== "deploymentProgress"
    ) {
      saveDraft();
    }
  }, 10000); // Save every 10 seconds

  // Effect to fetch available contract definitions
  useEffect(() => {
    const fetchDefinitions = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const definitions = [
          {
            filename: "rentalLeaseDefinition",
            name: "Rental Lease",
          },
          {
            filename: "freelanceContract.definition.json",
            name: "Freelance Contract",
          },
        ];
        setAvailableDefinitions(definitions);
      } catch (error) {
        console.error("Error setting contract definitions:", error);
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
    if (!selectedDefinitionFilename) {
      setCurrentDefinition(null);
      setTemplateOriginalContent("");
      setFormFields([]);
      setFormData({});
      setSigners([]);
      return;
    }

    const loadDefinitionAndTemplate = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        // Fetch the definition JSON using the filename
        let definitionData: ContractDefinition;
        if (selectedDefinitionFilename === "rentalLeaseDefinition") {
          const rentalLeaseDefinition = await import(
            "@/public/contracts/defined/rentalLease.definition.json"
          );
          definitionData = rentalLeaseDefinition.default as ContractDefinition;
        } else {
          // TODO: replace with actual definition
          const rentalLeaseDefinition = await import(
            "@/public/contracts/defined/rentalLease.definition.json"
          );
          definitionData = rentalLeaseDefinition.default as ContractDefinition;
        }
        setCurrentDefinition(definitionData);
        if (
          definitionData.templateMeta &&
          definitionData.templateMeta.templateFile
        ) {
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

          // Call the new parser function
          parseContractDefinition(definitionData);

          if (definitionData.templateMeta.title) {
            setContractName(
              definitionData.templateMeta.title.replace(/\s+/g, "_") + "_Filled"
            );
          }
        } else {
          throw new Error("Template file path not specified in definition.");
        }
        // Only set to fillForm if we're not loading a draft AND no draft was loaded
        if (!isDraftLoading && !draftWasLoaded && uiStep === "selectContract") {
          setUiStep("fillForm");
        }

        // Auto-save initial draft when template is loaded
        setTimeout(() => {
          saveDraft();
        }, 500);
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
        setSigners([]);
        setUiStep("selectContract");
      } finally {
        setIsLoading(false);
      }
    };

    loadDefinitionAndTemplate();
  }, [selectedDefinitionFilename, isDraftLoading, draftWasLoaded]);

  // Function to provide placeholder data for form fields
  const getPlaceholderValue = (placeholderId: string): string => {
    const placeholderData: Record<string, string> = {
      OWNER_NAME: "John Smith",
      RESIDENT_NAME: "Vitalik Buterin",
      RENTAL_ADDRESS: "123 Crypto Street, Apt 4B",
      CITY: "San Francisco",
      RENT_AMOUNT: "2500",
      RENT_DUE_DAY: "1st",
      LEASE_START_DATE: "2024-02-01",
      LEASE_END_DATE: "2025-01-31",
      LEASE_TYPE: "fixed",
      PAYABLE_TO: "John Smith",
      PAYMENT_METHOD: "Online Portal",
      FIRST_MONTH_RENT: "2500",
      SECURITY_DEPOSIT: "2500",
      TOTAL_PAYMENT: "5000",
      DEPOSIT_REFUND_DAYS: "30",
      LATE_FEE: "75",
      LATE_FEE_PERCENTAGE: "5",
      LATE_AFTER_DAY: "5th day of the month",
      NSF_FEE: "35",
      UTILITIES_EXCEPTIONS: "Water and Trash",
      APPROVED_OCCUPANTS: "",
      PET_DEPOSIT: "500",
      PET_RENT: "50",
      PARKING_SPACE: "Spot #42",
      PARKING_FEE: "150",
      OWNER_ADDRESS_FOR_NOTICES:
        "456 Property Management Ave, San Francisco, CA 94105",
      INVENTORY_ITEMS:
        "Refrigerator (Samsung RF23M8070SG), Stove (GE Profile PGS930SELSS), Dishwasher (Bosch SHPM65Z55N), Washer/Dryer (LG WM3900HWA/DLEX3900W)",
      KEY_DETAILS: "2x front door keys, 1x mailbox key, 1x garage remote",
      ADDITIONS_EXCEPTIONS:
        "Tenant may install smart home devices with written consent",
    };
    return placeholderData[placeholderId] || "";
  };

  // NEW: Function to parse the contract definition JSON into form fields
  const parseContractDefinition = (definition: ContractDefinition) => {
    const newFormFields: FormField[] = [];
    const newFormData: ContractFormData = {};

    // Optional: Process sections to create headers
    if (definition.sections) {
      definition.sections
        .sort(
          (a: ContractSection, b: ContractSection) =>
            (a.displayOrder || 0) - (b.displayOrder || 0)
        )
        .forEach((section: ContractSection) => {
          newFormFields.push({
            id: `section_header_${section.sectionId}`,
            label: section.title,
            type: "group_header",
            dataType: "string",
            originalLine: section.description,
            isSectionHeader: true,
          });
        });
    }

    definition.placeholders.forEach((p: ContractPlaceholder) => {
      let fieldType: FormField["type"] = "text";
      if (p.dataType === "boolean") {
        fieldType = "checkbox";
      } else if (p.dataType === "date") {
        fieldType = "date";
      } else if (p.dataType === "number" || p.dataType === "integer") {
        fieldType = "number";
      } else if (p.dataType === "text") {
        fieldType = "textarea";
      } else if (p.dataType === "string") {
        fieldType = "text";
      }
      if (p.dataType === "enum") {
        fieldType = p.uiHint === "radio" ? "radio" : "select";
      }
      if (p.uiHint === "textarea") fieldType = "textarea";

      const formField: FormField = {
        id: p.id,
        label: p.label,
        type: fieldType,
        dataType: p.dataType,
        options: p.options,
        required: p.required,
        description: p.description,
        placeholderText: p.description || p.label,
        sectionId: p.sectionId,
        uiHint: p.uiHint,
        dependsOn: p.dependsOn,
      };

      if (fieldType === "radio" && p.options) {
        newFormFields.push(formField);
        const placeholderData = getPlaceholderValue(p.id);
        newFormData[p.id] =
          p.defaultValue ??
          placeholderData ??
          (p.options.length > 0 ? p.options[0].value : "");
      } else {
        newFormFields.push(formField);
        if (p.dataType === "boolean") {
          newFormData[p.id] =
            p.defaultValue !== undefined ? Boolean(p.defaultValue) : false;
        } else {
          const placeholderData = getPlaceholderValue(p.id);
          newFormData[p.id] =
            p.defaultValue !== undefined ? p.defaultValue : placeholderData;
        }
      }
    });

    newFormFields.sort((a, b) => {
      if (a.isSectionHeader && !b.isSectionHeader) return -1;
      if (!a.isSectionHeader && b.isSectionHeader) return 1;
      return 0;
    });

    setFormFields(newFormFields);
    setFormData(newFormData);
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const { checked } = e.target as HTMLInputElement;
      setFormData((prev: ContractFormData) => ({ ...prev, [name]: checked }));
    } else if (type === "radio") {
      setFormData((prev: ContractFormData) => ({ ...prev, [name]: value }));
    } else {
      setFormData((prev: ContractFormData) => ({ ...prev, [name]: value }));
    }
  };

  const generateContractText = (): string => {
    if (!currentDefinition || !templateOriginalContent) return "";
    let populatedText = templateOriginalContent;

    currentDefinition.placeholders.forEach(
      (placeholder: ContractPlaceholder) => {
        const regex = new RegExp(
          `{{\s*${placeholder.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\s*}}`,
          "g"
        );
        const value = formData[placeholder.id];

        if (value !== undefined) {
          populatedText = populatedText.replace(regex, String(value));
        } else if (placeholder.defaultValue !== undefined) {
          populatedText = populatedText.replace(
            regex,
            String(placeholder.defaultValue)
          );
        }
      }
    );
    return populatedText;
  };

  const handleSaveContract = async () => {
    setPreDeploymentIsLoading(true);
    if (!currentDefinition) {
      setErrorMessage("No contract definition loaded.");
      setUiStep("manageSigners");
      return;
    }

    const creatorSigner = signers.find((s) => s.role === "creator");
    if (!creatorSigner || !creatorSigner.email) {
      setErrorMessage("Creator information is required to save the contract.");
      setUiStep("manageSigners");
      return;
    }

    setIsLoading(true);
    setUiStep("deploymentProgress");
    setErrorMessage(null);

    const populatedContract = generateContractText();
    const filename = `${
      contractName.replace(/[^a-z0-9_\-]/gi, "_") || "contract"
    }.md`;

    try {
      const otherSigner = signers.find((s) => s.role === "signer");

      const response = await fetch("/api/save-contract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename,
          content: populatedContract,
          templateType: selectedDefinitionFilename || "unknown",
          partyA: creatorSigner.email,
          partyB: otherSigner?.email || null,
          depositA: creatorSigner.depositAmount || 0,
          depositB: otherSigner?.depositAmount || 0,
          signers,
          draftId: draftId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `Failed to save contract: ${response.statusText}`
        );
      }
      const result = await response.json();
      setContractResult(result);

      // Update draftId if save-contract returned a new agreement ID
      if (result.agreementId && result.agreementId !== draftId) {
        setDraftId(result.agreementId);
        localStorage.setItem("draftId", result.agreementId);
        console.log(`Updated draftId from ${draftId} to ${result.agreementId}`);
      }

      // Contract saved to DB successfully, now UI will handle blockchain deployment
      setIsLoading(false);
    } catch (error) {
      console.error("Error saving contract:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to save contract."
      );
      setUiStep("manageSigners");
      setIsLoading(false);
    } finally {
      setPreDeploymentIsLoading(false);
    }
  };

  const handleFormStepNext = async () => {
    setIsStepTransitioning(true);
    setErrorMessage(null); // Clear any previous error messages

    const creatorSigner: ContractSigner = {
      id: "creator_" + Date.now(),
      name: "John Smith",
      email: "john.smith@company.com",
      role: "creator",
      status: "pending",
      depositAmount: 1000,
    };

    const defaultSigner: ContractSigner = {
      id: "signer_" + Date.now(),
      name: "Michael Davis",
      email: "michael.davis@company.com",
      role: "signer",
      status: "pending",
      depositAmount: 1000,
    };

    setSigners([creatorSigner, defaultSigner]);
    setUiStep("manageSigners");

    // Save draft after step change and clear loading state
    try {
      await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay for UI smoothness
      await saveDraft();
    } finally {
      setIsStepTransitioning(false);
    }
  };

  const handleSignersStepNext = () => {
    setErrorMessage(null); // Clear any previous error messages
    setUiStep("deploymentProgress");
    handleSaveContract();
  };

  const handleSignersStepBack = () => {
    setUiStep("fillForm");
  };

  const handleDeploymentComplete = (
    deploymentState: BlockchainDeploymentState
  ) => {
    setDeploymentState(deploymentState);
    setUiStep("success");
  };

  const handleDeploymentError = (error: string) => {
    setErrorMessage(error);
    setUiStep("deploymentFailed");
  };

  const handleDeploymentBack = () => {
    setUiStep("manageSigners");
  };

  const generateShareableMessage = (
    contractTitle: string,
    creatorName: string,
    signUrl: string
  ): string => {
    return `📋 You've been invited to review and sign: "${contractTitle}"

👤 Created by: ${creatorName}

🔗 Review & Sign: ${signUrl}

⏰ Valid for 7 days
Powered by Resolutor`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert("Copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy: ", err);
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      alert("Copied to clipboard!");
    }
  };

  const shareViaWhatsApp = (message: string) => {
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  };

  const shareViaTelegram = (message: string) => {
    const telegramUrl = `https://t.me/share/url?text=${encodeURIComponent(
      message
    )}`;
    window.open(telegramUrl, "_blank");
  };

  const shareViaEmail = (subject: string, body: string) => {
    const emailUrl = `mailto:?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
    window.open(emailUrl);
  };

  const resetWizard = () => {
    setUiStep("selectContract");
    setSelectedDefinitionFilename(null);
    setCurrentDefinition(null);
    setContractName("MyContract");
    setFormFields([]);
    setFormData({});
    setSigners([]);
    setContractResult(null);
    setDeploymentState(null);
    setErrorMessage(null);
    setDraftId(null);
    localStorage.removeItem("draftId");
  };

  // Draft persistence functions
  const saveDraft = async () => {
    if (isDraftSaving) return Promise.resolve();

    setIsDraftSaving(true);
    try {
      const creatorSigner = signers.find((s) => s.role === "creator");
      const creatorEmail = creatorSigner?.email || "anonymous@example.com";

      const response = await fetch("/api/save-draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          draftId,
          currentStep: uiStep,
          selectedDefinitionFilename,
          contractName,
          formData,
          signers,
          populatedContract: generateContractText(),
          creatorEmail,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save draft");
      }

      const result = await response.json();
      if (result.success && result.draftId) {
        // Update draftId if it changed (e.g., new draft created due to old one not found)
        if (result.draftId !== draftId) {
          console.log(`Draft ID changed from ${draftId} to ${result.draftId}`);
          setDraftId(result.draftId);
          localStorage.setItem("draftId", result.draftId);

          // Update URL with new draft ID
          const newUrl = `${window.location.pathname}?draftId=${result.draftId}`;
          window.history.replaceState({}, "", newUrl);
        } else {
          setDraftId(result.draftId);
          localStorage.setItem("draftId", result.draftId);

          // Update URL with draft ID if it's not already there
          const urlParams = new URLSearchParams(window.location.search);
          if (!urlParams.get("draftId")) {
            const newUrl = `${window.location.pathname}?draftId=${result.draftId}`;
            window.history.replaceState({}, "", newUrl);
          }
        }
      }
    } catch (error) {
      console.error("Error saving draft:", error);
      // Don't show error to user for auto-save
    } finally {
      setIsDraftSaving(false);
    }
  };

  const loadDraft = async (draftIdToLoad?: string) => {
    setIsDraftLoading(true);
    try {
      const idToUse =
        draftIdToLoad || draftId || localStorage.getItem("draftId");
      if (!idToUse) {
        console.log("No draft ID available");
        setIsDraftLoading(false);
        return;
      }

      console.log("Loading draft with ID:", idToUse);
      const response = await fetch(`/api/save-draft?draftId=${idToUse}`);
      if (!response.ok) {
        if (response.status === 404) {
          console.log("Draft not found, clearing local storage");
          localStorage.removeItem("draftId");
          setDraftId(null);
          setIsDraftLoading(false);
          return;
        }
        throw new Error("Failed to load draft");
      }

      const result = await response.json();
      console.log("Draft loaded successfully:", result);

      if (result.success && result.draft) {
        const draft = result.draft;

        setDraftId(draft.id);
        setSelectedDefinitionFilename(draft.selectedDefinitionFilename);
        setContractName(draft.contractName || "MyContract");
        setFormData(draft.formData || {});
        setSigners(draft.signers || []);

        // Always set contractResult if we have a draft ID - this allows deployment progress to work
        if (draft.agreementId || draft.id) {
          setContractResult({
            agreementId: draft.agreementId || draft.id,
            cid: draft.cid,
          });
        }

        localStorage.setItem("draftId", draft.id);

        // Set UI step last, after all other state is set
        // This ensures the template loading effect won't override our UI step
        setDraftWasLoaded(true);
        setTimeout(() => {
          // Determine UI step based on actual progress, not just saved currentStep
          let targetStep: UIStep;

          // Check processStatus first for deployment-related progress
          if (draft.processStatus) {
            const deploymentStatusMap: Record<string, UIStep> = {
              ipfs_uploaded: "deploymentProgress",
              filecoin_access_deployed: "deploymentProgress",
              filecoin_stored: "deploymentProgress",
              flow_deployed: "deploymentProgress",
              completed: "success",
            };

            if (deploymentStatusMap[draft.processStatus]) {
              targetStep = deploymentStatusMap[draft.processStatus];
            } else if (draft.signers && draft.signers.length > 0) {
              // Has signers data, should be at deployment or signers step
              targetStep = "deploymentProgress";
            } else if (
              draft.formData &&
              Object.keys(draft.formData).length > 0
            ) {
              // Has form data, should be at signers step
              targetStep = "manageSigners";
            } else if (draft.selectedDefinitionFilename) {
              // Has selected template, should be at form step
              targetStep = "fillForm";
            } else {
              targetStep = "selectContract";
            }
          } else {
            // Fallback to original logic for drafts without processStatus
            const deploymentSteps = [
              "ipfs_upload",
              "filecoin_access_deploy",
              "filecoin_store_file",
              "flow_deploy",
            ];

            if (deploymentSteps.includes(draft.currentStep)) {
              targetStep = "deploymentProgress";
            } else if (draft.currentStep === "completed") {
              targetStep = "success";
            } else if (draft.signers && draft.signers.length > 0) {
              targetStep = "manageSigners";
            } else if (
              draft.formData &&
              Object.keys(draft.formData).length > 0
            ) {
              targetStep = "manageSigners";
            } else if (draft.selectedDefinitionFilename) {
              targetStep = "fillForm";
            } else {
              targetStep = "selectContract";
            }
          }

          console.log(
            "Mapping processStatus:",
            draft.processStatus,
            "currentStep:",
            draft.currentStep,
            "to UI step:",
            targetStep
          );
          setUiStep(targetStep);
        }, 100);
      }
    } catch (error) {
      console.error("Error loading draft:", error);
      setErrorMessage("Failed to load saved draft");
    } finally {
      setIsDraftLoading(false);
    }
  };

  const inputBaseClasses =
    "w-full py-2.5 px-3 border border-gray-300 rounded text-base text-gray-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none";

  // Show loading state while draft is being loaded
  if (isDraftLoading) {
    return (
      <div className="flex flex-col items-center justify-center flex-grow">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-gray-600 text-lg">Loading saved draft...</p>
      </div>
    );
  }

  if (
    isLoading &&
    uiStep === "selectContract" &&
    availableDefinitions.length === 0
  ) {
    return (
      <ContractSelectionStep
        availableDefinitions={availableDefinitions}
        onSelectDefinition={setSelectedDefinitionFilename}
        isLoading={isLoading}
        errorMessage={errorMessage}
      />
    );
  }

  if (uiStep === "selectContract") {
    return (
      <ContractSelectionStep
        availableDefinitions={availableDefinitions}
        onSelectDefinition={setSelectedDefinitionFilename}
        isLoading={isLoading}
        errorMessage={errorMessage}
      />
    );
  }

  if (isLoading && uiStep === "fillForm" && !currentDefinition) {
    return (
      <div className="flex flex-col items-center justify-center flex-grow">
        <p className="text-gray-600 text-lg">
          Loading contract details for {selectedDefinitionFilename}...
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
          onClick={() => {
            setUiStep("selectContract");
            setSelectedDefinitionFilename(null);
            setErrorMessage(null);
            setSigners([]);
          }}
          className="mt-4 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
        >
          Back to Selection
        </button>
      </div>
    );
  }

  if (uiStep === "deploymentProgress") {
    if (!contractResult && !preDeploymentIsLoading) {
      return (
        <div className="flex flex-col items-center justify-center flex-grow">
          <p className="text-red-500 text-lg">
            Contract must be saved before deployment. Please try again.
          </p>
          <button
            onClick={() => setUiStep("manageSigners")}
            className="mt-4 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
          >
            Back to Signers
          </button>
        </div>
      );
    }

    return (
      <DeploymentProgressStep
        agreementId={contractResult?.agreementId || ""}
        onComplete={handleDeploymentComplete}
        onError={handleDeploymentError}
        onBack={handleDeploymentBack}
        contractContent={generateContractText()}
        fileName={contractName + ".md"}
      />
    );
  }

  if (uiStep === "deploymentFailed") {
    return (
      <div className="flex flex-col items-center justify-center flex-grow">
        <div className="text-center space-y-4 max-w-2xl">
          <div className="bg-red-100 rounded-full p-6 mx-auto w-fit">
            <svg
              className="w-16 h-16 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>

          <h1 className="text-3xl font-bold text-red-600">Deployment Failed</h1>
          <p className="text-lg text-gray-600">
            There was an error during the blockchain deployment process.
          </p>

          {errorMessage && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-lg text-left">
              <h3 className="font-semibold text-red-800 mb-2">
                Error Details:
              </h3>
              <p className="text-red-700 text-sm">{errorMessage}</p>
            </div>
          )}

          <div className="flex justify-center space-x-4 pt-6">
            <button
              onClick={() => setUiStep("deploymentProgress")}
              className="bg-yellow-500 text-white py-3 px-6 rounded-lg hover:bg-yellow-600 font-medium"
            >
              🔄 Try Again
            </button>
            <button
              onClick={() => setUiStep("manageSigners")}
              className="bg-gray-500 text-white py-3 px-6 rounded-lg hover:bg-gray-600 font-medium"
            >
              ← Back to Signers
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center flex-grow">
        <p className="text-gray-600 text-lg">
          {(uiStep as UIStep) === "deploymentProgress"
            ? `Processing blockchain deployment...`
            : "Loading..."}
        </p>
        {errorMessage && <p className="text-red-500 mt-2">{errorMessage}</p>}
      </div>
    );
  }

  // Show loading state during step transition
  if (isStepTransitioning) {
    return (
      <div className="flex flex-col items-center justify-center flex-grow">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-gray-600 text-lg">Setting up signers...</p>
      </div>
    );
  }

  if (uiStep === "success" && contractResult && currentDefinition) {
    const creatorSigner = signers.find((s) => s.role === "creator");
    const otherSigners = signers.filter((s) => s.role !== "creator");

    return (
      <div className="flex flex-col items-center w-full">
        <div className="w-full max-w-3xl bg-white p-8 rounded-lg shadow-xl">
          <div className="text-center space-y-6">
            {/* Success Icon */}
            <div className="flex justify-center">
              <div className="bg-green-100 rounded-full p-6">
                <svg
                  className="w-16 h-16 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>

            {/* Success Message */}
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                🎉 Contract Successfully Deployed!
              </h1>
              <p className="text-lg text-gray-600">
                Your contract has been deployed to blockchain and is ready for
                signatures
              </p>
            </div>

            {/* Contract Summary */}
            <div className="bg-gray-50 p-6 rounded-lg text-left space-y-4">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Contract Summary
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">
                    Contract Name:
                  </span>
                  <p className="text-gray-600">{contractName}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">
                    Contract Type:
                  </span>
                  <p className="text-gray-600">
                    {currentDefinition.templateMeta.title}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">
                    Agreement ID:
                  </span>
                  <p className="text-gray-600 font-mono text-xs">
                    {contractResult.agreementId}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">IPFS CID:</span>
                  <p className="text-gray-600 font-mono text-xs">
                    {contractResult.cid || deploymentState?.cid}
                  </p>
                </div>
                {deploymentState?.flowContractAddr && (
                  <div>
                    <span className="font-medium text-gray-700">
                      Flow Contract:
                    </span>
                    <p className="text-gray-600 font-mono text-xs">
                      {deploymentState.flowContractAddr}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Signers Summary */}
            <div className="bg-blue-50 p-6 rounded-lg text-left space-y-4">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Signers & Next Steps
              </h2>

              {creatorSigner && (
                <div className="mb-4">
                  <h3 className="font-medium text-gray-700 mb-2">
                    Contract Creator
                  </h3>
                  <div className="bg-white p-3 rounded border">
                    <p className="font-medium">{creatorSigner.name}</p>
                    <p className="text-gray-600">{creatorSigner.email}</p>
                    <p className="text-blue-600 text-sm">
                      💰 Deposit Amount: $
                      {(creatorSigner.depositAmount || 0).toFixed(2)}
                    </p>
                    <p className="text-green-600 text-sm">
                      ✅ Contract deployed on blockchain
                    </p>
                  </div>
                </div>
              )}

              {otherSigners.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-700 mb-2">
                    Pending Signers
                  </h3>
                  <div className="space-y-2">
                    {otherSigners.map((signer) => (
                      <div
                        key={signer.id}
                        className="bg-white p-3 rounded border"
                      >
                        <p className="font-medium">{signer.name}</p>
                        <p className="text-gray-600">{signer.email}</p>
                        <p className="text-blue-600 text-sm">
                          💰 Deposit Amount: $
                          {(signer.depositAmount || 0).toFixed(2)}
                        </p>
                        <p className="text-orange-600 text-sm">
                          ⏳ Awaiting signature
                        </p>

                        {/* Share Options for Each Signer */}
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-sm font-medium text-gray-700 mb-2">
                            Share signing link with {signer.name}:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => {
                                const signUrl = `${window.location.origin}/sign/${contractResult.agreementId}`;
                                copyToClipboard(signUrl);
                              }}
                              className="bg-gray-500 text-white px-3 py-1 rounded text-sm hover:bg-gray-600"
                            >
                              📋 Copy Link
                            </button>
                            <button
                              onClick={() => {
                                const signUrl = `${window.location.origin}/sign/${contractResult.agreementId}`;
                                const message = generateShareableMessage(
                                  contractName,
                                  creatorSigner?.name || "Contract Creator",
                                  signUrl
                                );
                                copyToClipboard(message);
                              }}
                              className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
                            >
                              📋 Copy Message
                            </button>
                            <button
                              onClick={() => {
                                const signUrl = `${window.location.origin}/sign/${contractResult.agreementId}`;
                                const message = generateShareableMessage(
                                  contractName,
                                  creatorSigner?.name || "Contract Creator",
                                  signUrl
                                );
                                shareViaWhatsApp(message);
                              }}
                              className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
                            >
                              💬 WhatsApp
                            </button>
                            <button
                              onClick={() => {
                                const signUrl = `${window.location.origin}/sign/${contractResult.agreementId}`;
                                const message = generateShareableMessage(
                                  contractName,
                                  creatorSigner?.name || "Contract Creator",
                                  signUrl
                                );
                                shareViaTelegram(message);
                              }}
                              className="bg-blue-400 text-white px-3 py-1 rounded text-sm hover:bg-blue-500"
                            >
                              ✈️ Telegram
                            </button>
                            <button
                              onClick={() => {
                                const signUrl = `${window.location.origin}/sign/${contractResult.agreementId}`;
                                const subject = `Contract Signature Request: ${contractName}`;
                                const message = generateShareableMessage(
                                  contractName,
                                  creatorSigner?.name || "Contract Creator",
                                  signUrl
                                );
                                shareViaEmail(subject, message);
                              }}
                              className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
                            >
                              📧 Email
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {otherSigners.length === 0 && (
                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
                  <p className="text-yellow-800 text-sm">
                    <strong>Note:</strong> No additional signers were added.
                    This contract is ready for your signature only.
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center space-x-4 pt-6">
              <button
                onClick={resetWizard}
                className="bg-blue-500 text-white py-3 px-6 rounded-lg hover:bg-blue-600 font-medium"
              >
                Create Another Contract
              </button>
              <button
                onClick={() => (window.location.href = "/")}
                className="bg-gray-500 text-white py-3 px-6 rounded-lg hover:bg-gray-600 font-medium"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <TransactionProvider>
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
              Definition: {selectedDefinitionFilename}
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
        {errorMessage && uiStep === "manageSigners" && (
          <p className="text-red-500 mb-4">{errorMessage}</p>
        )}

        <div className="w-full max-w-3xl bg-white p-8 rounded-lg shadow-xl">
          {uiStep === "fillForm" && currentDefinition && (
            <ContractFormStep
              currentDefinition={currentDefinition}
              formFields={formFields}
              formData={formData}
              contractName={contractName}
              inputBaseClasses={inputBaseClasses}
              isLoading={isLoading}
              errorMessage={errorMessage}
              onContractNameChange={setContractName}
              onFormFieldChange={handleChange}
              onSubmit={handleFormStepNext}
              selectedDefinitionFilename={selectedDefinitionFilename}
            />
          )}

          {uiStep === "manageSigners" && currentDefinition && (
            <ContractSignersStep
              signers={signers}
              onSignersChange={setSigners}
              onNext={handleSignersStepNext}
              onBack={handleSignersStepBack}
              isLoading={isLoading || isStepTransitioning || isDraftSaving}
              inputBaseClasses={inputBaseClasses}
            />
          )}

          {uiStep === "manageSigners" && !currentDefinition && (
            <div className="text-center space-y-4">
              <p className="text-red-500 text-lg">
                Failed to maintain contract state. Please start over.
              </p>
              <button
                onClick={resetWizard}
                className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
              >
                Start Over
              </button>
            </div>
          )}
        </div>
      </div>
    </TransactionProvider>
  );
};

export default NewContractPage;
