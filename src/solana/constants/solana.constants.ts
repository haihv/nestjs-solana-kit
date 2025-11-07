export const SOLANA_MODULE_OPTIONS = 'SOLANA_MODULE_OPTIONS';

export const DEFAULT_SOLANA_OPTIONS = {
  cluster: 'mainnet-beta' as const,
  commitment: 'confirmed' as const,
  retryEnabled: true,
  maxRetries: 3,
  timeout: 30000,
};

export const CLUSTER_URLS = {
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
  devnet: 'https://api.devnet.solana.com',
  testnet: 'https://api.testnet.solana.com',
  localnet: 'http://localhost:8899',
};

export const CLUSTER_WS_URLS = {
  'mainnet-beta': 'wss://api.mainnet-beta.solana.com',
  devnet: 'wss://api.devnet.solana.com',
  testnet: 'wss://api.testnet.solana.com',
  localnet: 'ws://localhost:8900',
};
