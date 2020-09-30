require("dotenv").config();
const Web3 = require("web3");
const SuperfluidSDK = require("@superfluid-finance/ethereum-contracts");
const HDWalletProvider = require("@truffle/hdwallet-provider");

async function main() {
    const web3Provider = new HDWalletProvider(
        process.env.GOERLI_MNEMONIC,
        process.env.GOERLI_PROVIDER_URL,
    );
    const web3 = new Web3(web3Provider);
    const accounts = web3Provider.addresses;
    const admin = accounts[0];
    const bob = accounts[1];
    console.log("admin", admin);
    console.log("bob", bob);
    const minAmount = web3.utils.toWei("100", "ether");
    const sf = new SuperfluidSDK.Framework({
        chainId: 5,
        version: "preview-20200928", // This is for using different protocol release
        web3Provider: web3Provider // your web3 provider
    });
    await sf.initialize();

    const daiAddress = await sf.resolver.get("tokens.fDAI");
    const dai = await sf.contracts.TestToken.at(daiAddress);
    const daixWrapper = await sf.getERC20Wrapper(dai);
    const daix = await sf.contracts.ISuperToken.at(daixWrapper.wrapperAddress);
    console.log("daix address", daix.address);

    // minting
    if (web3.utils.toBN(await daix.balanceOf(admin)).lt(web3.utils.toBN(minAmount))) {
        console.log("Minting and upgrading...");
        await dai.mint(admin, minAmount, { from: admin });
        await dai.approve(daix.address, minAmount, { from: admin });
        await daix.upgrade(minAmount, { from: admin });
        console.log("Done minting and upgrading.");
    }
    console.log("admin balance", (await daix.balanceOf(admin)).toString());
    console.log("bob balance", (await daix.balanceOf(bob)).toString());

    console.log("Admin net flow", (await sf.agreements.cfa.getNetFlow(daix.address, admin)).toString());
    console.log("Bob net flow", (await sf.agreements.cfa.getNetFlow(daix.address, bob)).toString());

    // create flow
    const currentFlowData = await sf.agreements.cfa.getFlow(daix.address, admin, bob);
    if (currentFlowData.timestamp.toString() != "0") {
        console.log("Deleting the existing flow...");
        await sf.host.callAgreement(
            sf.agreements.cfa.address,
            sf.agreements.cfa.contract.methods.deleteFlow(
                daix.address, admin, bob, "0x"
            ).encodeABI(), {
                from: admin
            }
        );
        console.log("Flow deleted.");
    }

    console.log("Admin net flow", (await sf.agreements.cfa.getNetFlow(daix.address, admin)).toString());
    console.log("Bob net flow", (await sf.agreements.cfa.getNetFlow(daix.address, bob)).toString());

    console.log("Creating a new flow...");
    await sf.host.callAgreement(
        sf.agreements.cfa.address,
        sf.agreements.cfa.contract.methods.createFlow(
            daix.address, bob, "385802469135802", "0x"
        ).encodeABI(), {
            from: admin
        }
    );
    console.log("Flow created.")

    // check net flow rates
    console.log("Admin net flow", (await sf.agreements.cfa.getNetFlow(daix.address, admin)).toString());
    console.log("Bob net flow", (await sf.agreements.cfa.getNetFlow(daix.address, bob)).toString());
}

main();
