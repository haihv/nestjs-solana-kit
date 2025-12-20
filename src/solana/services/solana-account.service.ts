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

  /**
   * Get the decimals of an SPL token mint
   *
   * Fetches the mint account and extracts the decimals field.
   *
   * @param mintAddress The token mint address
   * @returns The number of decimals (0-9)
   * @throws Error if mint account doesn't exist or is invalid
   *
   * @example
   * ```typescript
   * const decimals = await accountService.getTokenDecimals(usdcMint);
   * // decimals = 6
   *
   * const rawAmount = BigInt(amount * 10 ** decimals);
   * ```
   */
  async getTokenDecimals(mintAddress: string | Address): Promise<number> {
    try {
      const mint = this.utilsService.toAddress(mintAddress);
      const accountInfo = await this.getAccountInfo(mint);

      if (!accountInfo) {
        throw new Error(`Mint account not found: ${mint}`);
      }

      const [base64Data] = accountInfo.data;
      const data = Buffer.from(base64Data, 'base64');

      // SPL Token mint layout: decimals is at offset 44
      // mint_authority (36) + supply (8) = 44
      const DECIMALS_OFFSET = 44;

      if (data.length < DECIMALS_OFFSET + 1) {
        throw new Error(`Invalid mint account data: ${mint}`);
      }

      const decimals = data[DECIMALS_OFFSET];
      this.logger.debug(`Token ${mint} has ${decimals} decimals`);
      return decimals;
    } catch (error) {
      this.logger.error(
        `Failed to get token decimals for ${mintAddress}`,
        error,
      );
      throw error;
    }
  }

  // ============================================================================
  // Batch Operations
  // ============================================================================

  /**
   * Get multiple accounts with typed decoding
   *
   * Fetches accounts and decodes them using a provided decoder function.
   *
   * @param addresses Array of account addresses
   * @param decoder Function to decode account data
   * @returns Array of decoded accounts (null for missing accounts)
   *
   * @example
   * ```typescript
   * type TokenAccount = { mint: Address; owner: Address; amount: bigint };
   *
   * const accounts = await accountService.getMultipleAccountsTyped(
   *   tokenAccountAddresses,
   *   (data) => decodeTokenAccount(data)
   * );
   * ```
   */
  async getMultipleAccountsTyped<T>(
    addresses: (string | Address)[],
    decoder: (data: Uint8Array) => T,
  ): Promise<(T | null)[]> {
    const accounts = await this.getMultipleAccounts(addresses);

    return accounts.map((account) => {
      if (!account) {
        return null;
      }

      try {
        // Account data is base64 encoded
        const [base64Data] = account.data;
        const buffer = Buffer.from(base64Data, 'base64');
        return decoder(new Uint8Array(buffer));
      } catch (error) {
        this.logger.warn('Failed to decode account data', error);
        return null;
      }
    });
  }

  /**
   * Batch get accounts with rate limiting
   *
   * Fetches accounts in batches to avoid hitting RPC rate limits.
   * Useful for fetching large numbers of accounts.
   *
   * @param addresses Array of account addresses
   * @param options Batch options
   * @returns Array of account info (null for missing accounts)
   *
   * @example
   * ```typescript
   * // Fetch 1000 accounts in batches of 100
   * const accounts = await accountService.batchGetAccounts(
   *   addresses,
   *   { batchSize: 100, delayMs: 100 }
   * );
   * ```
   */
  async batchGetAccounts(
    addresses: (string | Address)[],
    options: BatchGetAccountsOptions = {},
  ): Promise<(AccountInfo | null)[]> {
    const { batchSize = 100, delayMs = 50 } = options;

    const results: (AccountInfo | null)[] = [];
    const batches: (string | Address)[][] = [];

    // Split into batches
    for (let i = 0; i < addresses.length; i += batchSize) {
      batches.push(addresses.slice(i, i + batchSize));
    }

    this.logger.debug(
      `Fetching ${addresses.length} accounts in ${batches.length} batches`,
    );

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchResults = await this.getMultipleAccounts(batch);
      results.push(...batchResults);

      // Add delay between batches (except for last batch)
      if (i < batches.length - 1 && delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return results;
  }

  /**
   * Batch get accounts with typed decoding and rate limiting
   *
   * Combines batch fetching with typed decoding.
   *
   * @param addresses Array of account addresses
   * @param decoder Function to decode account data
   * @param options Batch options
   * @returns Array of decoded accounts (null for missing/failed accounts)
   *
   * @example
   * ```typescript
   * const nftMetadata = await accountService.batchGetAccountsTyped(
   *   metadataAddresses,
   *   (data) => decodeMetadata(data),
   *   { batchSize: 50, delayMs: 100 }
   * );
   * ```
   */
  async batchGetAccountsTyped<T>(
    addresses: (string | Address)[],
    decoder: (data: Uint8Array) => T,
    options: BatchGetAccountsOptions = {},
  ): Promise<(T | null)[]> {
    const accounts = await this.batchGetAccounts(addresses, options);

    return accounts.map((account) => {
      if (!account) {
        return null;
      }

      try {
        const [base64Data] = account.data;
        const buffer = Buffer.from(base64Data, 'base64');
        return decoder(new Uint8Array(buffer));
      } catch (error) {
        this.logger.warn('Failed to decode account data', error);
        return null;
      }
    });
  }
}

/**
 * Options for batch account fetching
 */
type BatchGetAccountsOptions = {
  /** Number of accounts to fetch per batch (default: 100) */
  readonly batchSize?: number;
  /** Delay in milliseconds between batches (default: 50) */
  readonly delayMs?: number;
};
