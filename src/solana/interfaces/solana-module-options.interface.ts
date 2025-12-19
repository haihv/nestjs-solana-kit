import { ModuleMetadata, Type } from '@nestjs/common';

export type SolanaCluster = 'mainnet-beta' | 'devnet' | 'testnet' | 'localnet';
export type SolanaCommitment = 'processed' | 'confirmed' | 'finalized';

export interface SolanaModuleOptions {
  /**
   * The RPC URL for connecting to Solana
   * @example 'https://api.mainnet-beta.solana.com'
   */
  rpcUrl: string;

  /**
   * The Solana cluster to connect to
   * @default 'mainnet-beta'
   */
  cluster?: SolanaCluster;

  /**
   * The commitment level for queries
   * @default 'confirmed'
   */
  commitment?: SolanaCommitment;

  /**
   * WebSocket URL for subscriptions (optional)
   * @example 'wss://api.mainnet-beta.solana.com'
   */
  wsUrl?: string;

  /**
   * Enable request retry logic
   * @default true
   */
  retryEnabled?: boolean;

  /**
   * Maximum number of retry attempts
   * @default 3
   */
  maxRetries?: number;

  /**
   * Timeout for RPC requests in milliseconds
   * @default 30000
   */
  timeout?: number;
}

export interface SolanaModuleOptionsFactory {
  createSolanaModuleOptions():
    | Promise<SolanaModuleOptions>
    | SolanaModuleOptions;
}

export interface SolanaModuleAsyncOptions extends Pick<
  ModuleMetadata,
  'imports'
> {
  useExisting?: Type<SolanaModuleOptionsFactory>;
  useClass?: Type<SolanaModuleOptionsFactory>;
  useFactory?: (
    ...args: any[]
  ) => Promise<SolanaModuleOptions> | SolanaModuleOptions;
  inject?: any[];
}
