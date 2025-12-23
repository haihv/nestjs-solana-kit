import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createSolanaRpc } from '@solana/kit';
import {
  SOLANA_MODULE_OPTIONS,
  GENESIS_HASH_TO_CLUSTER,
  Cluster,
  CLUSTERS,
} from '../constants/solana.constants';
import { SolanaModuleOptions } from '../interfaces/solana-module-options.interface';

const DEFAULT_CLUSTER: Cluster = CLUSTERS.MAINNET;

/**
 * SolanaConfigService - Manages Solana module configuration
 *
 * This service centralizes all configuration-related concerns,
 * allowing other services to access cluster and RPC settings
 * without being tightly coupled to the RPC service.
 *
 * Supports automatic cluster detection via getGenesisHash() RPC call.
 * If cluster is explicitly provided, it takes precedence over auto-detection.
 */
@Injectable()
export class SolanaConfigService implements OnModuleInit {
  private readonly logger = new Logger(SolanaConfigService.name);
  private readonly moduleOptions: SolanaModuleOptions;
  private detectedCluster: Cluster | null = null;
  private clusterDetectionPromise: Promise<Cluster> | null = null;

  constructor(
    @Inject(SOLANA_MODULE_OPTIONS)
    options: SolanaModuleOptions,
  ) {
    this.moduleOptions = options;

    if (options.cluster) {
      this.logger.log(
        `Solana configuration initialized with explicit cluster: ${options.cluster}`,
      );
    } else {
      this.logger.log(
        'Solana configuration initialized, cluster will be auto-detected',
      );
    }
  }

  /**
   * NestJS lifecycle hook - auto-detect cluster on module initialization
   */
  async onModuleInit(): Promise<void> {
    if (!this.moduleOptions.cluster) {
      try {
        const cluster = await this.detectCluster();
        this.logger.log(`Auto-detected cluster: ${cluster}`);
      } catch (error) {
        this.logger.warn(
          `Failed to auto-detect cluster, defaulting to mainnet-beta: ${error}`,
        );
        this.detectedCluster = DEFAULT_CLUSTER;
      }
    }
  }

  /**
   * Detect cluster from RPC endpoint using getGenesisHash()
   * Results are cached after first detection
   */
  private async detectCluster(): Promise<Cluster> {
    if (this.detectedCluster) {
      return this.detectedCluster;
    }

    // Prevent concurrent detection calls
    if (this.clusterDetectionPromise) {
      return this.clusterDetectionPromise;
    }

    this.clusterDetectionPromise = this.performClusterDetection();
    return this.clusterDetectionPromise;
  }

  private async performClusterDetection(): Promise<Cluster> {
    // Check for localnet URL patterns first (no RPC call needed)
    const url = this.moduleOptions.rpcUrl.toLowerCase();
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      this.detectedCluster = 'localnet';
      return this.detectedCluster;
    }

    const rpc = createSolanaRpc(this.moduleOptions.rpcUrl);
    const genesisHash = await rpc.getGenesisHash().send();

    const cluster: Cluster =
      GENESIS_HASH_TO_CLUSTER[genesisHash] ?? DEFAULT_CLUSTER;

    this.detectedCluster = cluster;
    return cluster;
  }

  /**
   * Get the current cluster
   *
   * Returns explicit cluster if provided in options, otherwise returns
   * the auto-detected cluster. Falls back to DEFAULT_CLUSTER if detection
   * hasn't completed yet.
   *
   * @returns The current cluster (mainnet-beta, devnet, testnet, localnet)
   */
  get clusterName(): Cluster {
    return (
      this.moduleOptions.cluster || this.detectedCluster || DEFAULT_CLUSTER
    );
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
