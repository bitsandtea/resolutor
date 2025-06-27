import { useWriteContract } from "wagmi";
import { AccessControlABI } from "../ABIs";
import { CONTRACT_ADDRESSES } from "../wagmi";

// function createAgreement(
//        string calldata agreementId,
//        address partyA,
//        address mediator,
//        address flowContractAddr
//    ) external {

const { writeContract, isPending, error } = useWriteContract();
const createAgreement = async (agreementId: string, agreement: any) => {
  const result = await writeContract({
    address: CONTRACT_ADDRESSES.ACCESS_CONTROL,
    abi: AccessControlABI,
    functionName: "createAgreement",
    args: [agreementId, agreement.partyA, agreement.mediator],
  });

  return result;
};
