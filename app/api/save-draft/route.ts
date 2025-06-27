import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      draftId, // Optional - if provided, update existing draft
      currentStep,
      selectedDefinitionFilename,
      contractName,
      formData,
      signers,
      populatedContract,
      creatorEmail,
    } = body;

    if (!currentStep) {
      return NextResponse.json(
        { success: false, error: "currentStep is required" },
        { status: 400 }
      );
    }

    let agreement;

    if (draftId) {
      // Update existing draft
      agreement = await prisma.agreement.update({
        where: { id: draftId },
        data: {
          currentStep,
          templateType: selectedDefinitionFilename,
          contractName,
          formData: formData ? JSON.stringify(formData) : undefined,
          signersData: signers ? JSON.stringify(signers) : undefined,
          draftContent: populatedContract,
          partyA: creatorEmail,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new draft
      agreement = await prisma.agreement.create({
        data: {
          currentStep,
          processStatus: "draft",
          templateType: selectedDefinitionFilename,
          contractName,
          formData: formData ? JSON.stringify(formData) : undefined,
          signersData: signers ? JSON.stringify(signers) : undefined,
          draftContent: populatedContract,
          partyA: creatorEmail,
        },
      });
    }

    return NextResponse.json({
      success: true,
      draftId: agreement.id,
      message: "Draft saved successfully",
    });
  } catch (error) {
    console.error("Error saving draft:", error);
    let errorMessage = "An unknown error occurred";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      {
        success: false,
        error: "Failed to save draft",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const draftId = searchParams.get("draftId");
    const creatorEmail = searchParams.get("creatorEmail");

    if (!draftId && !creatorEmail) {
      return NextResponse.json(
        { success: false, error: "draftId or creatorEmail is required" },
        { status: 400 }
      );
    }

    let agreement;

    if (draftId) {
      agreement = await prisma.agreement.findUnique({
        where: { id: draftId },
      });
    } else if (creatorEmail) {
      // Find the most recent draft for this creator
      agreement = await prisma.agreement.findFirst({
        where: {
          partyA: creatorEmail,
          processStatus: "draft",
        },
        orderBy: { updatedAt: "desc" },
      });
    }

    if (!agreement) {
      return NextResponse.json(
        { success: false, error: "Draft not found" },
        { status: 404 }
      );
    }

    // Parse JSON fields
    const formData = agreement.formData
      ? JSON.parse(agreement.formData as string)
      : null;
    const signersData = agreement.signersData
      ? JSON.parse(agreement.signersData as string)
      : null;

    return NextResponse.json({
      success: true,
      draft: {
        id: agreement.id,
        currentStep: agreement.currentStep,
        selectedDefinitionFilename: agreement.templateType,
        contractName: agreement.contractName,
        formData,
        signers: signersData,
        populatedContract: agreement.draftContent,
        creatorEmail: agreement.partyA,
        agreementId: agreement.id,
      },
    });
  } catch (error) {
    console.error("Error loading draft:", error);
    let errorMessage = "An unknown error occurred";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      {
        success: false,
        error: "Failed to load draft",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
