import { useWriteContract } from "wagmi";
import { AccessControlABI } from "../ABIs";
import { CONTRACT_ADDRESSES } from "../wagmi";

export const useCreateAccessControl = () => {
  const { writeContract, isPending, error, data: txHash } = useWriteContract();

  const createAccessControl = (
    agreementId: string,
    partyA: string,
    mediator: string,
    fileCid: string
  ) => {
    writeContract({
      chainId:
        Number(process.env.NEXT_PUBLIC_FILECOIN_CALIBRATION_CHAIN_ID) || 3141,
      address: CONTRACT_ADDRESSES.ACCESS_CONTROL,
      abi: AccessControlABI,
      functionName: "createAgreementWithFile",
      args: [agreementId, partyA, mediator, fileCid],
    });
  };

  return {
    createAccessControl,
    isPending,
    error,
    txHash,
  };
};
