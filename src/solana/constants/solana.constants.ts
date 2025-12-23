export const SOLANA_MODULE_OPTIONS = 'SOLANA_MODULE_OPTIONS';

export const CLUSTERS = {
  MAINNET: 'mainnet-beta',
  TESTNET: 'testnet',
  DEVNET: 'devnet',
  LOCALNET: 'localnet',
} as const;
export type Cluster = (typeof CLUSTERS)[keyof typeof CLUSTERS];

export const DEFAULT_SOLANA_OPTIONS = {
  cluster: 'mainnet-beta' satisfies Cluster,
  commitment: 'confirmed' as const,
  retryEnabled: true,
  maxRetries: 3,
  timeout: 30000,
};

export const CLUSTER_URLS: Record<Cluster, string> = {
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
  devnet: 'https://api.devnet.solana.com',
  testnet: 'https://api.testnet.solana.com',
  localnet: 'http://localhost:8899',
};

export const CLUSTER_WS_URLS: Record<Cluster, string> = {
  'mainnet-beta': 'wss://api.mainnet-beta.solana.com',
  devnet: 'wss://api.devnet.solana.com',
  testnet: 'wss://api.testnet.solana.com',
  localnet: 'ws://localhost:8900',
};

/**
 * Genesis hashes for each Solana cluster
 * Used to auto-detect cluster from RPC endpoint via getGenesisHash()
 */
export const CLUSTER_GENESIS_HASHES: Record<
  Exclude<Cluster, 'localnet'>,
  string
> = {
  'mainnet-beta': '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d',
  devnet: 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG',
  testnet: '4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY',
};

/**
 * Reverse mapping: genesis hash -> cluster name
 * Used for cluster detection from RPC response
 */
export const GENESIS_HASH_TO_CLUSTER: Record<
  string,
  Exclude<Cluster, 'localnet'>
> = {
  '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d': 'mainnet-beta',
  EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG: 'devnet',
  '4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY': 'testnet',
};
