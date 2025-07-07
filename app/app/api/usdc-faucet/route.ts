import { MockERC20ABI } from "@/lib/ABIs";
import { NextRequest, NextResponse } from "next/server";
import { createWalletClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { flowTestnet } from "viem/chains";

// In-memory store for rate limiting
const requestTimestamps = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_REQUESTS_PER_WINDOW = 1;

// Validate Ethereum address format
const validateAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
};

export async function GET(request: NextRequest) {
  try {
    const address = request.nextUrl.searchParams.get("address");

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

    // Rate limiting check
    const now = Date.now();
    const userTimestamps = (requestTimestamps.get(address) || []).filter(
      (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS
    );

    if (userTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
      const timeToWait = RATE_LIMIT_WINDOW_MS - (now - userTimestamps[0]);
      const hoursToWait = (timeToWait / (1000 * 60 * 60)).toFixed(1);
      return NextResponse.json(
        {
          error: `Too many requests. Please try again in ${hoursToWait} hours.`,
        },
        { status: 429 }
      );
    }

    // Add current request timestamp
    requestTimestamps.set(address, [...userTimestamps, now]);

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

    // Transfer 1,000 tokens (1k with 18 decimals)
    const transferAmount = parseEther("1000");

    console.log(`Transferring ${transferAmount} tokens to ${address}`);

    // Call transfer function on the ERC20 contract
    const txHash = await walletClient.writeContract({
      address: mockERC20Address as `0x${string}`,
      abi: MockERC20ABI,
      functionName: "transfer",
      args: [address as `0x${string}`, transferAmount],
    });

    console.log(`Faucet transaction successful: ${txHash}`);

    return NextResponse.json({
      success: true,
      message: "Tokens transferred successfully",
      txHash,
      amount: "1000",
      recipient: address,
      explorerUrl: `https://evm-testnet.flowscan.io/tx/${txHash}`,
    });
  } catch (error) {
    console.error("Faucet error:", error);

    let errorMessage = "Failed to transfer tokens";
    let statusCode = 500;

    if (error instanceof Error) {
      const errorMsg = error.message.toLowerCase();

      if (errorMsg.includes("insufficient funds")) {
        errorMessage = "Faucet has insufficient funds to send transaction";
        statusCode = 503;
      } else if (errorMsg.includes("execution reverted")) {
        errorMessage =
          "Contract execution failed. The faucet may have an insufficient token balance.";
        statusCode = 500;
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
