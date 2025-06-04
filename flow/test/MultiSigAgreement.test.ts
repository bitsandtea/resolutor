import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

// import { ethers } from "hardhat";

describe("MultiSigAgreement", function () {
  async function deployFixture() {
    const [owner, partyA, partyB, mediator, other] = await ethers.getSigners();

    // Deploy mock ERC20 token
    const MockToken = await ethers.getContractFactory("MockERC20");
    const token = await MockToken.deploy("Test USDC", "TUSDC");
    await token.waitForDeployment();

    // Deploy factory
    const AgreementFactory = await ethers.getContractFactory(
      "AgreementFactory"
    );
    const factory = await AgreementFactory.deploy();
    await factory.waitForDeployment();

    // Mint tokens and approve
    const depositA = ethers.parseUnits("1000", 18);
    const depositB = ethers.parseUnits("500", 18);

    await token.mint(partyA.address, depositA);
    await token.mint(partyB.address, depositB);

    return {
      factory,
      token,
      owner,
      partyA,
      partyB,
      mediator,
      other,
      depositA,
      depositB,
    };
  }

  async function createActiveAgreement() {
    const { factory, token, partyA, partyB, mediator, depositA, depositB } =
      await loadFixture(deployFixture);

    const factoryAddress = await factory.getAddress();
    const tokenAddress = await token.getAddress();

    await token.connect(partyA).approve(factoryAddress, depositA);
    await token.connect(partyB).approve(factoryAddress, depositB);

    const agreementAddr = await factory.createAgreement.staticCall(
      partyA.address,
      partyB.address,
      mediator.address,
      depositA,
      depositB,
      tokenAddress,
      "QmTestManifest"
    );

    await factory.createAgreement(
      partyA.address,
      partyB.address,
      mediator.address,
      depositA,
      depositB,
      tokenAddress,
      "QmTestManifest"
    );

    const agreement = await ethers.getContractAt(
      "MultiSigAgreement",
      agreementAddr
    );
    return { agreement, token, partyA, partyB, mediator, depositA, depositB };
  }

  describe("Deployment and Initialization", function () {
    it("Should create agreement through factory", async function () {
      const { factory, token, partyA, partyB, mediator, depositA, depositB } =
        await loadFixture(deployFixture);

      const factoryAddress = await factory.getAddress();
      const tokenAddress = await token.getAddress();

      // Approve tokens
      await token.connect(partyA).approve(factoryAddress, depositA);
      await token.connect(partyB).approve(factoryAddress, depositB);

      const tx = await factory.createAgreement(
        partyA.address,
        partyB.address,
        mediator.address,
        depositA,
        depositB,
        tokenAddress,
        "QmTestManifest"
      );

      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) =>
          log.topics[0] ===
          ethers.id("AgreementCreated(address,address,address)")
      );
      expect(event).to.not.be.undefined;
    });

    it("Should handle party B depositing later", async function () {
      const { factory, token, partyA, partyB, mediator, depositA, depositB } =
        await loadFixture(deployFixture);

      const factoryAddress = await factory.getAddress();
      const tokenAddress = await token.getAddress();

      // Only approve party A
      await token.connect(partyA).approve(factoryAddress, depositA);

      const agreementAddr = await factory.createAgreement.staticCall(
        partyA.address,
        partyB.address,
        mediator.address,
        depositA,
        depositB,
        tokenAddress,
        "QmTestManifest"
      );

      await factory.createAgreement(
        partyA.address,
        partyB.address,
        mediator.address,
        depositA,
        depositB,
        tokenAddress,
        "QmTestManifest"
      );

      const agreement = await ethers.getContractAt(
        "MultiSigAgreement",
        agreementAddr
      );
      const state = await agreement.getState();
      expect(state.status).to.equal(0); // Pending

      // Party B deposits later
      const agreementAddress = await agreement.getAddress();
      await token.connect(partyB).approve(agreementAddress, depositB);
      await agreement.connect(partyB).depositByPartyB();

      const newState = await agreement.getState();
      expect(newState.status).to.equal(1); // Active
    });
  });

  describe("Dispute Resolution", function () {
    it("Should allow parties to open dispute", async function () {
      const { agreement, partyA } = await createActiveAgreement();

      await expect(agreement.connect(partyA).openDispute("QmEvidenceHash"))
        .to.emit(agreement, "DisputeOpened")
        .withArgs(partyA.address, "QmEvidenceHash");

      const state = await agreement.getState();
      expect(state.status).to.equal(2); // Disputed
    });

    it("Should handle resolution proposal and approval", async function () {
      const { agreement, token, partyA, partyB, mediator, depositA, depositB } =
        await createActiveAgreement();

      // Open dispute
      await agreement.connect(partyA).openDispute("QmEvidenceHash");

      // Propose resolution (60-40 split)
      const amountToA = ((depositA + depositB) * 60n) / 100n;
      const amountToB = ((depositA + depositB) * 40n) / 100n;

      await agreement
        .connect(mediator)
        .proposeResolution(amountToA, amountToB, "QmResolutionProposal");

      // Get initial balances
      const initialBalanceA = await token.balanceOf(partyA.address);
      const initialBalanceB = await token.balanceOf(partyB.address);

      // Approve resolution (need 2 out of 3)
      await agreement.connect(partyA).approveResolution();
      await agreement.connect(partyB).approveResolution();

      // Check final balances
      const finalBalanceA = await token.balanceOf(partyA.address);
      const finalBalanceB = await token.balanceOf(partyB.address);

      expect(finalBalanceA - initialBalanceA).to.equal(amountToA);
      expect(finalBalanceB - initialBalanceB).to.equal(amountToB);

      const state = await agreement.getState();
      expect(state.status).to.equal(3); // Resolved
    });
  });

  describe("Timeout and Refunds", function () {
    it("Should allow refund after timeout", async function () {
      const { factory, token, partyA, partyB, mediator, depositA, depositB } =
        await loadFixture(deployFixture);

      const factoryAddress = await factory.getAddress();
      const tokenAddress = await token.getAddress();

      // Only approve party A
      await token.connect(partyA).approve(factoryAddress, depositA);

      const agreementAddr = await factory.createAgreement.staticCall(
        partyA.address,
        partyB.address,
        mediator.address,
        depositA,
        depositB,
        tokenAddress,
        "QmTestManifest"
      );

      await factory.createAgreement(
        partyA.address,
        partyB.address,
        mediator.address,
        depositA,
        depositB,
        tokenAddress,
        "QmTestManifest"
      );

      const agreement = await ethers.getContractAt(
        "MultiSigAgreement",
        agreementAddr
      );

      // Fast forward time
      await time.increase(7 * 24 * 60 * 60 + 1); // 7 days + 1 second

      const initialBalance = await token.balanceOf(partyA.address);
      await agreement.refundExpired();
      const finalBalance = await token.balanceOf(partyA.address);

      expect(finalBalance - initialBalance).to.equal(depositA);
    });
  });

  describe("Security", function () {
    it("Should prevent unauthorized access", async function () {
      const {
        factory,
        token,
        partyA,
        partyB,
        mediator,
        other,
        depositA,
        depositB,
      } = await loadFixture(deployFixture);

      const factoryAddress = await factory.getAddress();
      const tokenAddress = await token.getAddress();

      await token.connect(partyA).approve(factoryAddress, depositA);
      await token.connect(partyB).approve(factoryAddress, depositB);

      const agreementAddr = await factory.createAgreement.staticCall(
        partyA.address,
        partyB.address,
        mediator.address,
        depositA,
        depositB,
        tokenAddress,
        "QmTestManifest"
      );

      await factory.createAgreement(
        partyA.address,
        partyB.address,
        mediator.address,
        depositA,
        depositB,
        tokenAddress,
        "QmTestManifest"
      );

      const agreement = await ethers.getContractAt(
        "MultiSigAgreement",
        agreementAddr
      );

      // Unauthorized user cannot open dispute
      await expect(
        agreement.connect(other).openDispute("QmFakeEvidence")
      ).to.be.revertedWith("Only parties can call this");
    });

    it("Should prevent double approval", async function () {
      const { agreement, partyA, mediator, depositA, depositB } =
        await createActiveAgreement();

      await agreement.connect(partyA).openDispute("QmEvidenceHash");

      await agreement
        .connect(mediator)
        .proposeResolution(depositA, depositB, "QmResolutionProposal");

      await agreement.connect(partyA).approveResolution();

      await expect(
        agreement.connect(partyA).approveResolution()
      ).to.be.revertedWith("Already approved");
    });
  });
});
