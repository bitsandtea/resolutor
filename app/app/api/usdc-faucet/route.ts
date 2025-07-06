import { MockERC20ABI } from "@/lib/ABIs";
import { NextRequest, NextResponse } from "next/server";
import { createWalletClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { flowTestnet } from "viem/chains";

// Validate Ethereum address format
const validateAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
};

export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json();

    // Validate required parameters
    if (!address) {
      return NextResponse.json(
        { error: "Missing required parameter: address" },
        { status: 400 }
      );
    }

    // Validate address format
    if (!validateAddress(address)) {
      return NextResponse.json(
        {
          error:
            "Invalid address format. Must be a valid Ethereum address (0x...)",
        },
        { status: 400 }
      );
    }

    // Get environment variables
    const faucetPrivateKey = process.env.USDC_FAUCET_PKEY;
    const mockERC20Address = process.env.NEXT_PUBLIC_MOCK_ERC20_ADDRESS;
    const flowRpcUrl = process.env.NEXT_PUBLIC_FLOW_RPC_URL;

    if (!faucetPrivateKey) {
      return NextResponse.json(
        { error: "Faucet private key not configured" },
        { status: 500 }
      );
    }

    if (!mockERC20Address) {
      return NextResponse.json(
        { error: "Mock ERC20 contract address not configured" },
        { status: 500 }
      );
    }

    if (!flowRpcUrl) {
      return NextResponse.json(
        { error: "Flow RPC URL not configured" },
        { status: 500 }
      );
    }

    // Create account from private key
    const account = privateKeyToAccount(`0x${faucetPrivateKey}`);

    // Create wallet client
    const walletClient = createWalletClient({
      account,
      chain: flowTestnet,
      transport: http(flowRpcUrl),
    });

    // Mint 100,000 tokens (100k with 18 decimals)
    const mintAmount = parseEther("100000");

    console.log(`Minting ${mintAmount} tokens to ${address}`);

    // Call mint function on the ERC20 contract
    const txHash = await walletClient.writeContract({
      address: mockERC20Address as `0x${string}`,
      abi: MockERC20ABI,
      functionName: "mint",
      args: [address as `0x${string}`, mintAmount],
    });

    console.log(`Faucet transaction successful: ${txHash}`);

    return NextResponse.json({
      success: true,
      message: "Tokens minted successfully",
      txHash,
      amount: "100000",
      recipient: address,
      explorerUrl: `https://evm-testnet.flowscan.io/tx/${txHash}`,
    });
  } catch (error) {
    console.error("Faucet error:", error);

    let errorMessage = "Failed to mint tokens";
    let statusCode = 500;

    if (error instanceof Error) {
      const errorMsg = error.message.toLowerCase();

      if (errorMsg.includes("insufficient funds")) {
        errorMessage = "Faucet has insufficient funds";
        statusCode = 503;
      } else if (errorMsg.includes("execution reverted")) {
        errorMessage =
          "Contract execution failed - may not have permission to mint";
        statusCode = 403;
      } else if (
        errorMsg.includes("network") ||
        errorMsg.includes("connection")
      ) {
        errorMessage = "Network connection failed";
        statusCode = 503;
      } else {
        errorMessage = error.message;
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: statusCode }
    );
  }
}
