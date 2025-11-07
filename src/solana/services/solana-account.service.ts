import { Injectable, Logger } from '@nestjs/common';
import type { Address, Lamports } from '@solana/kit';
import { SolanaRpcService } from './solana-rpc.service';
import { SolanaUtilsService } from './solana-utils.service';
import type { AccountInfo } from '../types';

@Injectable()
export class SolanaAccountService {
  private readonly logger = new Logger(SolanaAccountService.name);

  constructor(
    private readonly rpcService: SolanaRpcService,
    private readonly utilsService: SolanaUtilsService,
  ) {}

  /**
   * Get the SOL balance of an account
   * @param accountAddress The account address as string or Address type
   * @returns The balance in lamports
   */
  async getBalance(accountAddress: string | Address): Promise<Lamports> {
    try {
      const addr = this.utilsService.toAddress(accountAddress);
      const rpc = this.rpcService.rpc;

      const { value } = await rpc.getBalance(addr).send();

      this.logger.debug(`Balance for ${addr}: ${value} lamports`);
      return value;
    } catch (error) {
      this.logger.error(`Failed to get balance for ${accountAddress}`, error);
      throw error;
    }
  }

  /**
   * Get the SOL balance in SOL (not lamports)
   * @param accountAddress The account address
   * @returns The balance in SOL
   */
  async getBalanceInSol(accountAddress: string | Address): Promise<number> {
    const lamports = await this.getBalance(accountAddress);
    return Number(lamports) / 1_000_000_000;
  }

  /**
   * Get account information
   * @param accountAddress The account address
   * @returns Account information including owner, lamports, executable status, and data
   */
  async getAccountInfo(
    accountAddress: string | Address,
  ): Promise<AccountInfo | null> {
    try {
      const addr = this.utilsService.toAddress(accountAddress);
      const rpc = this.rpcService.rpc;

      const { value } = await rpc
        .getAccountInfo(addr, { encoding: 'base64' })
        .send();

      if (!value) {
        this.logger.warn(`No account info found for ${addr}`);
        return null;
      }

      this.logger.debug(`Account info retrieved for ${addr}`);
      return value;
    } catch (error) {
      this.logger.error(
        `Failed to get account info for ${accountAddress}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get multiple accounts in a single call
   * @param accountAddresses Array of account addresses
   * @returns Array of account information
   */
  async getMultipleAccounts(
    accountAddresses: (string | Address)[],
  ): Promise<readonly (AccountInfo | null)[]> {
    try {
      const addresses = accountAddresses.map((addr) =>
        this.utilsService.toAddress(addr),
      );
      const rpc = this.rpcService.rpc;

      const { value } = await rpc
        .getMultipleAccounts(addresses, { encoding: 'base64' })
        .send();

      this.logger.debug(`Retrieved info for ${addresses.length} accounts`);
      return value;
    } catch (error) {
      this.logger.error('Failed to get multiple accounts', error);
      throw error;
    }
  }

  /**
   * Get all token accounts owned by an account
   * @param ownerAddress The owner's address
   * @param tokenMintAddress Optional: Filter by specific token mint
   * @returns Array of token accounts with parsed data
   */
  async getTokenAccounts(
    ownerAddress: string | Address,
    tokenMintAddress?: string | Address,
  ): Promise<readonly any[]> {
    try {
      const owner = this.utilsService.toAddress(ownerAddress);
      const rpc = this.rpcService.rpc;

      const filters = tokenMintAddress
        ? {
            mint: this.utilsService.toAddress(tokenMintAddress),
          }
        : {
            programId: this.utilsService.toAddress(
              'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            ),
          }; // SPL Token Program

      const { value } = await rpc
        .getTokenAccountsByOwner(owner, filters, { encoding: 'jsonParsed' })
        .send();

      this.logger.debug(`Found ${value.length} token accounts for ${owner}`);
      return value;
    } catch (error) {
      this.logger.error(
        `Failed to get token accounts for ${ownerAddress}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Check if an account exists
   * @param accountAddress The account address
   * @returns True if account exists
   */
  async accountExists(accountAddress: string | Address): Promise<boolean> {
    try {
      const info = await this.getAccountInfo(accountAddress);
      return info !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get the minimum balance required for rent exemption
   * @param dataLength The data length in bytes
   * @returns The minimum balance in lamports
   */
  async getMinimumBalanceForRentExemption(
    dataLength: bigint,
  ): Promise<Lamports> {
    try {
      const rpc = this.rpcService.rpc;
      const balance = await rpc
        .getMinimumBalanceForRentExemption(dataLength)
        .send();

      this.logger.debug(
        `Minimum balance for ${dataLength} bytes: ${balance} lamports`,
      );
      return balance;
    } catch (error) {
      this.logger.error(
        'Failed to get minimum balance for rent exemption',
        error,
      );
      throw error;
    }
  }
}
