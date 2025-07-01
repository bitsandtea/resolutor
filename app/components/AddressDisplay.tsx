"use client";

import React, { useState } from "react";

export interface AddressDisplayProps {
  address: string;
  maxLength?: number;
  clipboard?: boolean;
  className?: string;
}

const AddressDisplay: React.FC<AddressDisplayProps> = ({
  address,
  maxLength = 16,
  clipboard = false,
  className = "",
}) => {
  const [copied, setCopied] = useState(false);

  // Format address for display (shortened)
  const getDisplayAddress = (addr: string, maxLen: number): string => {
    if (!addr) return "";
    if (addr.length <= maxLen) return addr;

    // For Ethereum-style addresses, show beginning and end
    if (addr.startsWith("0x") && addr.length === 42) {
      const prefixLen = Math.floor((maxLen - 3) / 2);
      const suffixLen = maxLen - 3 - prefixLen;
      return `${addr.slice(0, 2 + prefixLen)}...${addr.slice(-suffixLen)}`;
    }

    // For other addresses, truncate with ellipsis
    return `${addr.slice(0, maxLen - 3)}...`;
  };

  const handleCopyToClipboard = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = address;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const baseClassName = `inline-flex items-center font-mono text-sm ${className}`;

  return (
    <span
      className={baseClassName}
      title={address} // Shows full address on hover
    >
      <span className="truncate">{getDisplayAddress(address, maxLength)}</span>

      {clipboard && (
        <button
          onClick={handleCopyToClipboard}
          className={`ml-2 p-1 rounded transition-colors ${
            copied
              ? "text-green-600 hover:text-green-700"
              : "text-gray-500 hover:text-gray-700"
          }`}
          title={copied ? "Copied!" : "Copy to clipboard"}
        >
          {copied ? (
            <svg
              className="w-4 h-4"
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
          ) : (
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          )}
        </button>
      )}
    </span>
  );
};

export default AddressDisplay;
