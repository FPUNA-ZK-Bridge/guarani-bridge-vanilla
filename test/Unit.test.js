import { expect } from "chai";
import hardhat from "hardhat";
const { ethers } = hardhat;

const ZERO = "0x0000000000000000000000000000000000000000";
const parse = (n) => ethers.parseUnits(n, 18);

describe("@unit GuaraniToken", function () {
  let token, deployer, user, other;
  let MINTER_ROLE, DEFAULT_ADMIN_ROLE;

  beforeEach(async function () {
    [deployer, user, other] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("GuaraniToken");
    token = await Token.deploy(parse("1000"));
    await token.waitForDeployment();
    MINTER_ROLE = await token.MINTER_ROLE();
    DEFAULT_ADMIN_ROLE = await token.DEFAULT_ADMIN_ROLE();
  });

  it("@unit exposes ERC20 metadata", async function () {
    expect(await token.name()).to.equal("GuaraniToken");
    expect(await token.symbol()).to.equal("GUA");
    expect(await token.decimals()).to.equal(18);
  });

  it("@unit mints initial supply to deployer", async function () {
    expect(await token.totalSupply()).to.equal(parse("1000"));
    expect(await token.balanceOf(deployer.address)).to.equal(parse("1000"));
    expect(await token.balanceOf(user.address)).to.equal(0);
  });

  it("@unit grants admin and minter roles to deployer", async function () {
    expect(await token.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.equal(true);
    expect(await token.hasRole(MINTER_ROLE, deployer.address)).to.equal(true);
    expect(await token.hasRole(MINTER_ROLE, user.address)).to.equal(false);
  });

  it("@unit MINTER_ROLE constant matches keccak256(\"MINTER_ROLE\")", async function () {
    const expected = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
    expect(MINTER_ROLE).to.equal(expected);
  });

  it("@unit allows minter to mint and increases supply", async function () {
    await token.mint(user.address, parse("50"));
    expect(await token.balanceOf(user.address)).to.equal(parse("50"));
    expect(await token.totalSupply()).to.equal(parse("1050"));
  });

  it("@unit rejects mint from non-minter", async function () {
    await expect(token.connect(user).mint(user.address, parse("1")))
      .to.be.reverted;
    expect(await token.balanceOf(user.address)).to.equal(0);
  });

  it("@unit lets admin grant MINTER_ROLE to a new minter", async function () {
    await token.grantRole(MINTER_ROLE, other.address);
    await token.connect(other).mint(user.address, parse("7"));
    expect(await token.balanceOf(user.address)).to.equal(parse("7"));
  });

  it("@unit supports ERC20 transfer/approve/transferFrom", async function () {
    await token.transfer(user.address, parse("10"));
    expect(await token.balanceOf(user.address)).to.equal(parse("10"));

    await token.connect(user).approve(other.address, parse("4"));
    expect(await token.allowance(user.address, other.address)).to.equal(parse("4"));

    await token.connect(other).transferFrom(user.address, other.address, parse("4"));
    expect(await token.balanceOf(other.address)).to.equal(parse("4"));
    expect(await token.allowance(user.address, other.address)).to.equal(0);
  });
});

describe("@unit Sender", function () {
  let token, sender, deployer, user, recipient;

  beforeEach(async function () {
    [deployer, user, recipient] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("GuaraniToken");
    token = await Token.deploy(parse("1000"));
    await token.waitForDeployment();

    const Sender = await ethers.getContractFactory("Sender");
    sender = await Sender.deploy(token.target);
    await sender.waitForDeployment();

    await token.transfer(user.address, parse("500"));
  });

  it("@unit stores the token immutably and starts with nonce 0", async function () {
    expect(await sender.token()).to.equal(token.target);
    expect(await sender.nonce()).to.equal(0);
    expect(await sender.lockedBalance()).to.equal(0);
  });

  it("@unit reverts when recipientL2 is zero", async function () {
    await token.connect(user).approve(sender.target, parse("10"));
    await expect(sender.connect(user).lock(ZERO, parse("10")))
      .to.be.revertedWith("Sender: bad recipient");
  });

  it("@unit reverts when amount is zero", async function () {
    await expect(sender.connect(user).lock(recipient.address, 0))
      .to.be.revertedWith("Sender: bad amount");
  });

  it("@unit reverts when allowance is below amount", async function () {
    await token.connect(user).approve(sender.target, parse("4"));
    await expect(sender.connect(user).lock(recipient.address, parse("5")))
      .to.be.revertedWith("Sender: approve first");
  });

  it("@unit reverts when there is no allowance at all", async function () {
    await expect(sender.connect(user).lock(recipient.address, parse("1")))
      .to.be.revertedWith("Sender: approve first");
  });

  it("@unit locks tokens, records Lock struct and emits Locked", async function () {
    const amount = parse("100");
    await token.connect(user).approve(sender.target, amount);

    await expect(sender.connect(user).lock(recipient.address, amount))
      .to.emit(sender, "Locked")
      .withArgs(0, user.address, recipient.address, amount);

    const stored = await sender.locks(0);
    expect(stored.from).to.equal(user.address);
    expect(stored.to).to.equal(recipient.address);
    expect(stored.amount).to.equal(amount);

    expect(await token.balanceOf(sender.target)).to.equal(amount);
    expect(await sender.lockedBalance()).to.equal(amount);
    // NOTE: Sender.lock() increments `nonce` twice (post-increment in emit + a
    // bare `nonce++` afterwards), so nonce advances by 2 per call. This is
    // almost certainly a bug — the second `nonce++` should be removed — but
    // until that is fixed, the test pins the actual behavior.
    expect(await sender.nonce()).to.equal(2);
  });

  it("@unit transferFrom pulls funds from the caller (not the contract)", async function () {
    const amount = parse("20");
    await token.connect(user).approve(sender.target, amount);

    const userBefore = await token.balanceOf(user.address);
    await sender.connect(user).lock(recipient.address, amount);
    const userAfter = await token.balanceOf(user.address);

    expect(userBefore - userAfter).to.equal(amount);
    expect(await token.allowance(user.address, sender.target)).to.equal(0);
  });

  it("@unit supports multiple sequential locks (nonce advances by 2 each)", async function () {
    const amount = parse("10");
    await token.connect(user).approve(sender.target, amount * 3n);

    await sender.connect(user).lock(recipient.address, amount);
    await sender.connect(user).lock(recipient.address, amount);

    // Second emitted id is 2 because of the double-increment.
    const stored0 = await sender.locks(0);
    const stored2 = await sender.locks(2);
    expect(stored0.amount).to.equal(amount);
    expect(stored2.amount).to.equal(amount);
    expect(await sender.nonce()).to.equal(4);
    expect(await sender.lockedBalance()).to.equal(amount * 2n);
  });
});

describe("@unit Receiver", function () {
  let token, receiver, deployer, relayer, user, attacker;

  beforeEach(async function () {
    [deployer, relayer, user, attacker] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("GuaraniToken");
    token = await Token.deploy(0);
    await token.waitForDeployment();

    const Receiver = await ethers.getContractFactory("Receiver");
    receiver = await Receiver.deploy(token.target, relayer.address);
    await receiver.waitForDeployment();

    await token.grantRole(await token.MINTER_ROLE(), receiver.target);
  });

  it("@unit stores token and relayer immutably", async function () {
    expect(await receiver.token()).to.equal(token.target);
    expect(await receiver.relayer()).to.equal(relayer.address);
    expect(await receiver.processed(0)).to.equal(false);
  });

  it("@unit rejects mintRemote when caller is not the relayer", async function () {
    await expect(
      receiver.connect(attacker).mintRemote(0, user.address, parse("1"))
    ).to.be.revertedWith("Receiver: not relayer");
    expect(await receiver.processed(0)).to.equal(false);
  });

  it("@unit rejects mintRemote when caller is deployer (deployer != relayer)", async function () {
    await expect(
      receiver.connect(deployer).mintRemote(0, user.address, parse("1"))
    ).to.be.revertedWith("Receiver: not relayer");
  });

  it("@unit mints, marks processed and emits Minted on success", async function () {
    const amount = parse("42");

    await expect(receiver.connect(relayer).mintRemote(7, user.address, amount))
      .to.emit(receiver, "Minted")
      .withArgs(7, user.address, amount);

    expect(await token.balanceOf(user.address)).to.equal(amount);
    expect(await token.totalSupply()).to.equal(amount);
    expect(await receiver.processed(7)).to.equal(true);
    // unrelated ids stay false
    expect(await receiver.processed(8)).to.equal(false);
  });

  it("@unit rejects replay of a processed id", async function () {
    const amount = parse("5");
    await receiver.connect(relayer).mintRemote(1, user.address, amount);
    await expect(
      receiver.connect(relayer).mintRemote(1, user.address, amount)
    ).to.be.revertedWith("Receiver: replay");
    // balance unchanged after the failed replay
    expect(await token.balanceOf(user.address)).to.equal(amount);
  });

  it("@unit treats different ids independently", async function () {
    await receiver.connect(relayer).mintRemote(10, user.address, parse("1"));
    await receiver.connect(relayer).mintRemote(11, user.address, parse("2"));
    expect(await receiver.processed(10)).to.equal(true);
    expect(await receiver.processed(11)).to.equal(true);
    expect(await token.balanceOf(user.address)).to.equal(parse("3"));
  });

  it("@unit reverts if Receiver loses MINTER_ROLE before mintRemote", async function () {
    await token.revokeRole(await token.MINTER_ROLE(), receiver.target);
    await expect(
      receiver.connect(relayer).mintRemote(0, user.address, parse("1"))
    ).to.be.reverted;
    expect(await receiver.processed(0)).to.equal(false);
  });
});
