import Web3 from "web3";

const adminPrivateKey = process.env.ADMIN_WALLET_PRIVATE_KEY;

// const localKeyProvider = new HDWalletProvider({
//   privateKeys: [adminPrivateKey],
//   providerOrUrl:
//     "https://polygon-mumbai.g.alchemy.com/v2/RFEvJAPXa4iS42sVjzUIt5KwMOvBXsxQ",
// });
// const web3 = new Web3(localKeyProvider);

// const web3 = new Web3("https://polygon-mumbai.g.alchemy.com/v2/RFEvJAPXa4iS42sVjzUIt5KwMOvBXsxQ");
const web3 = new Web3("https://polygon-mumbai-pokt.nodies.app");

web3.eth.accounts.wallet.add(adminPrivateKey);

const adminAccount = web3.eth.accounts.privateKeyToAccount(adminPrivateKey);

export { web3, adminAccount };
