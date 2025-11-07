import { Injectable, Logger } from '@nestjs/common';
import type {
  AccountInfoWithPubkey,
  Address,
  GetProgramAccountsApi,
} from '@solana/kit';
import { SolanaAccountService } from './solana-account.service';
import { SolanaRpcService } from './solana-rpc.service';
import { SolanaUtilsService } from './solana-utils.service';
import { AccountInfo } from '../types';

type GetProgramAccountOptions = Omit<
  NonNullable<Parameters<GetProgramAccountsApi['getProgramAccounts']>[1]>,
  'encoding'
>;

/**
 * Service for interacting with Solana programs
 */
@Injectable()
export class SolanaProgramService {
  private readonly logger = new Logger(SolanaProgramService.name);

  constructor(
    private readonly accountService: SolanaAccountService,
    private readonly rpcService: SolanaRpcService,
    private readonly utilsService: SolanaUtilsService,
  ) {}

  /**
   * Get program account information
   * @param programId The program's address
   * @returns Program account info or null if not found
   * @example
   * ```typescript
   * const programInfo = await programService.getProgramInfo('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
   * ```
   */
  async getProgramInfo(
    programId: string | Address,
  ): Promise<AccountInfo | null> {
    try {
      const progId = this.utilsService.toAddress(programId);
      const value = await this.accountService.getAccountInfo(progId);

      if (!value) {
        this.logger.warn(`No program found at ${progId}`);
        return null;
      }

      this.logger.debug(`Retrieved program info for ${progId}`);
      return value;
    } catch (error) {
      this.logger.error(`Failed to get program info for ${programId}`, error);
      throw error;
    }
  }

  /**
   * Check if a program exists and is executable
   * @param programId The program's address
   * @returns True if program exists and is executable
   * @example
   * ```typescript
   * const exists = await programService.isProgramDeployed('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
   * ```
   */
  async isProgramDeployed(programId: string | Address): Promise<boolean> {
    try {
      const info = await this.getProgramInfo(programId);
      return info !== null && info.executable === true;
    } catch {
      return false;
    }
  }

  /**
   * Get all accounts owned by a program
   * @param programId The program's address
   * @param filters Optional data filters
   * @returns Array of program accounts
   * @example
   * ```typescript
   * const accounts = await programService.getProgramAccounts('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
   * ```
   */
  async getProgramAccounts(
    programId: string | Address,
    options?: GetProgramAccountOptions,
  ): Promise<AccountInfoWithPubkey<AccountInfo>[]> {
    try {
      const progId = this.utilsService.toAddress(programId);
      const rpc = this.rpcService.rpc;

      const result = await rpc
        .getProgramAccounts(progId, {
          ...(options || {}),
          encoding: 'base64',
        })
        .send();

      this.logger.debug(
        `Retrieved ${result.length} accounts for program ${progId}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to get program accounts for ${programId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get the data size of a program account
   * @param programId The program's address
   * @returns The data size in bytes
   * @example
   * ```typescript
   * const size = await programService.getProgramDataSize('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
   * ```
   */
  async getProgramDataSize(programId: string | Address): Promise<bigint> {
    try {
      const info = await this.getProgramInfo(programId);

      if (!info) {
        throw new Error(`Program ${programId} not found`);
      }

      this.logger.debug(`Program ${programId} data size: ${info.space} bytes`);
      return info.space;
    } catch (error) {
      this.logger.error(
        `Failed to get program data size for ${programId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get the owner of a program (upgrade authority for upgradeable programs)
   * @param programId The program's address
   * @returns The owner address
   * @example
   * ```typescript
   * const owner = await programService.getProgramOwner('YourProgramId...');
   * ```
   */
  async getProgramOwner(programId: string | Address): Promise<Address> {
    try {
      const info = await this.getProgramInfo(programId);

      if (!info) {
        throw new Error(`Program ${programId} not found`);
      }

      this.logger.debug(`Program ${programId} owner: ${info.owner}`);
      return info.owner;
    } catch (error) {
      this.logger.error(`Failed to get program owner for ${programId}`, error);
      throw error;
    }
  }
}
