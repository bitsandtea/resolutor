"use client";

import React, { useState } from "react";

const FaucetInfo: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex justify-between items-center w-full text-left hover:bg-gray-100 rounded p-2 transition-colors"
      >
        <h4 className="font-medium text-gray-800">
          💰 Need Tokens for Deposits?
        </h4>
        <svg
          className={`w-5 h-5 text-gray-600 transform transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M19 9l-7 7-7-7"
          ></path>
        </svg>
      </button>
      {isOpen && (
        <div className="mt-4 text-sm text-gray-700 space-y-3 pl-2">
          <p>
            This dApp uses mock USDC tokens on the Flow EVM Testnet for handling
            deposits. If your wallet has insufficient funds, you can get free
            tokens from our faucet.
          </p>
          <div>
            <p className="font-medium">How to use the faucet:</p>
            <ol className="list-decimal list-inside space-y-1 mt-1 pl-2 text-gray-600">
              <li>Open a terminal or command prompt.</li>
              <li>
                Replace{" "}
                <code className="bg-gray-100 px-1 rounded text-xs">
                  YOUR_WALLET_ADDRESS
                </code>{" "}
                with your actual wallet address in the command below.
              </li>
              <li>Execute the command to receive 1000 mock USDC tokens.</li>
            </ol>
          </div>
          <pre className="bg-gray-900 text-green-400 p-3 rounded-md text-xs overflow-x-auto border">
            <code>
              {`curl -X GET "http://localhost:3000/api/usdc-faucet?address=YOUR_WALLET_ADDRESS"`}
            </code>
          </pre>
          <p className="text-gray-600 text-xs">
            💡 After running the command, your wallet balance should update
            shortly.
          </p>
        </div>
      )}
    </div>
  );
};

export default FaucetInfo;
