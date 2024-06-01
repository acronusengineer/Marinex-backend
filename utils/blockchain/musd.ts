import MUSD_ABI from "./AbiMUSD.json";

import { web3, adminAccount } from "./localKeys";
import { getMUSDAddress } from "./manager";
import Web3 from "web3";

const ADMIN_WALLET_VENLY_ID = process.env.ADMIN_WALLET_VENLY_ID;

export const getBalance = async (address: string) => {
  try {
    console.log("getBalance-->");

    const musdContractAddress = await getMUSDAddress();

    const musdContract = new web3.eth.Contract(
      MUSD_ABI as any[],
      musdContractAddress
    );

    if (
      address === "" ||
      !Web3.utils.isAddress(address) ||
      !Web3.utils.checkAddressCheckSum(address)
    ) {
      return 0;
    }

    const totalBalance = await musdContract.methods
      .balanceOf(address)
      .call({ from: adminAccount.address }) as BigInt;

    return web3.utils.fromWei(totalBalance.toString(), "ether");
  } catch (error) {
    console.log(error);
  }
};

export const distribute = async (to: string, amount: number) => {
  console.log("distribute-->");
  try {
    const musdContractAddress = await getMUSDAddress();

    console.log(
      musdContractAddress,
      amount,
      web3.utils.toWei(amount.toString(), "ether").toString()
    );

    const musdContract = new web3.eth.Contract(
      MUSD_ABI as any[],
      musdContractAddress
    );

    console.log(
      await musdContract.methods
        .balanceOf(adminAccount.address)
        .call({ from: adminAccount.address })
    );

    const nonce = await web3.eth.getTransactionCount(adminAccount.address);

    await musdContract.methods
      .transfer(to, web3.utils.toWei(amount.toString(), "ether").toString())
      .send({ from: adminAccount.address, nonce: nonce.toString() });
  } catch (error) {
    console.log(error);
  }
};
