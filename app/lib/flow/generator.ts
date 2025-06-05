import { ethers } from "ethers";

// Mock ERC20 ABI (simplified for hackathon)
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
];

export interface TransactionRequest {
  to: string;
  data: string;
  value?: string;
}

export function generateDepositTransaction(
  tokenAddress: string,
  recipientAddress: string,
  amount: string
): TransactionRequest {
  const iface = new ethers.Interface(ERC20_ABI);
  const data = iface.encodeFunctionData("transfer", [
    recipientAddress,
    ethers.parseEther(amount),
  ]);

  return {
    to: tokenAddress,
    data,
    value: "0",
  };
}

export function generateApprovalTransaction(
  tokenAddress: string,
  spenderAddress: string,
  amount: string
): TransactionRequest {
  const iface = new ethers.Interface(ERC20_ABI);
  const data = iface.encodeFunctionData("approve", [
    spenderAddress,
    ethers.parseEther(amount),
  ]);

  return {
    to: tokenAddress,
    data,
    value: "0",
  };
}
