import { Inject, Injectable, Logger } from '@nestjs/common';
import { SOLANA_MODULE_OPTIONS } from '../constants/solana.constants';
import {
  SolanaModuleOptions,
  SolanaCluster,
} from '../interfaces/solana-module-options.interface';

/**
 * SolanaConfigService - Manages Solana module configuration
 *
 * This service centralizes all configuration-related concerns,
 * allowing other services to access cluster and RPC settings
 * without being tightly coupled to the RPC service.
 */
@Injectable()
export class SolanaConfigService {
  private readonly logger = new Logger(SolanaConfigService.name);
  private readonly cluster: SolanaCluster;
  private readonly moduleOptions: SolanaModuleOptions;

  constructor(
    @Inject(SOLANA_MODULE_OPTIONS)
    options: SolanaModuleOptions,
  ) {
    this.moduleOptions = options;
    this.cluster = options.cluster || 'mainnet-beta';
    this.logger.log(
      `Solana configuration initialized for cluster: ${this.cluster}`,
    );
  }

  /**
   * Get the current cluster
   * @returns The current cluster (mainnet-beta, devnet, testnet, localnet, etc.)
   */
  get clusterName(): SolanaCluster {
    return this.cluster;
  }

  /**
   * Get the module options
   * @returns The complete module options including RPC URL, cluster, and commitment level
   */
  get options(): SolanaModuleOptions {
    return this.moduleOptions;
  }

  /**
   * Get the RPC URL
   * @returns The configured RPC endpoint URL
   */
  get rpcUrl(): string {
    return this.moduleOptions.rpcUrl;
  }

  /**
   * Get the commitment level
   * @returns The commitment level (processed, confirmed, finalized)
   */
  get commitment(): string {
    return this.moduleOptions.commitment || 'confirmed';
  }

  /**
   * Get the WebSocket URL if configured
   * @returns The WebSocket URL or undefined if not configured
   */
  get wsUrl(): string | undefined {
    return this.moduleOptions.wsUrl;
  }
}
