import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createSolanaRpc } from '@solana/kit';
import { SolanaConfigService } from './solana-config.service';
import type { SolanaRpc } from '../types';

/**
 * SolanaRpcService - Manages RPC connection to Solana blockchain
 * Provides access to @solana/kit RPC client for blockchain operations
 */
@Injectable()
export class SolanaRpcService implements OnModuleDestroy {
  private readonly logger = new Logger(SolanaRpcService.name);
  private readonly _rpc: SolanaRpc;

  constructor(private readonly configService: SolanaConfigService) {
    this._rpc = createSolanaRpc(this.configService.rpcUrl);
    this.logger.log(
      `Connected to Solana ${this.configService.clusterName} at ${this.configService.rpcUrl}`,
    );
  }

  /**
   * Get the RPC instance for direct blockchain operations
   * @returns The configured Solana RPC client
   */
  get rpc(): SolanaRpc {
    return this._rpc;
  }

  /**
   * Check if the connection is healthy
   * @returns True if connection is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      const health = await this._rpc.getHealth().send();
      return health === 'ok';
    } catch (error) {
      this.logger.error('Health check failed', error);
      return false;
    }
  }

  /**
   * Lifecycle hook called when the module is being destroyed
   *
   * Performs cleanup operations when the NestJS module is shutting down.
   * Currently logs the cleanup event. Can be extended to close connections
   * or release resources if needed.
   *
   * @see https://docs.nestjs.com/fundamentals/lifecycle-events
   */
  onModuleDestroy() {
    this.logger.log('Cleaning up Solana connection');
    // Cleanup if needed
  }
}
