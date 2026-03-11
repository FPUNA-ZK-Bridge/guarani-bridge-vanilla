import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

const {
  EPHEMERY_RPC_URL,
  EPHEMERY_PRIVATE_KEY,
  EPHEMERY_CHAIN_ID,
  BLOCKDAG_RPC_URL,
  BLOCKDAG_CHAIN_ID,
  BLOCKDAG_PRIVATE_KEY,
  SEPOLIA_RPC_URL,
  SEPOLIA_CHAIN_ID,
  SEPOLIA_PRIVATE_KEY,
} = process.env;

export default {
  solidity: "0.8.24",
  networks: {
    localN1: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 20,
      },
      mining: { auto: true, interval: 100000 },
    },
    localN2: {
      url: "http://127.0.0.1:9545",
      chainId: 1338,
    },
    ephemery: {
      url: EPHEMERY_RPC_URL ?? "http://127.0.0.1:8545",
      // si querés setear chainId por env (mejor opcional)
      chainId: EPHEMERY_CHAIN_ID ? Number(EPHEMERY_CHAIN_ID) : undefined,
      accounts: EPHEMERY_PRIVATE_KEY ? [EPHEMERY_PRIVATE_KEY] : undefined,
      // timeout: 600000,
    },
    sepolia: {
      url: SEPOLIA_RPC_URL ?? "http://127.0.0.1:8545",
      chainId: SEPOLIA_CHAIN_ID ? Number(SEPOLIA_CHAIN_ID) : undefined,
      accounts: SEPOLIA_PRIVATE_KEY ? [SEPOLIA_PRIVATE_KEY] : undefined,
    },
    blockdag: {
      url: BLOCKDAG_RPC_URL ?? "http://127.0.0.1:8545",
      // si querés setear chainId por env (mejor opcional)
      chainId: BLOCKDAG_CHAIN_ID ? Number(BLOCKDAG_CHAIN_ID) : undefined,
      accounts: BLOCKDAG_PRIVATE_KEY ? [BLOCKDAG_PRIVATE_KEY] : undefined,
      // timeout: 600000,
    },
    // Docker networks
    dockerN1: {
      url: "http://hardhat-n1:8545",
      chainId: 31337,
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 20,
      },
      mining: { auto: true, interval: 100000 },
    },
    dockerN2: {
      url: "http://anvil-n2:9545",
      chainId: 1338,
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 20,
      },
    },
  },
};
