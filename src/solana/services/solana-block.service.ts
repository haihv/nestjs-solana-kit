import { Injectable, Logger } from '@nestjs/common';
import type { Slot, Blockhash } from '@solana/kit';
import { SolanaRpcService } from './solana-rpc.service';
import type {
  BlockhashInfo,
  BlockInfoWithSignatures,
  BlockInfoWithTransactions,
  EpochInfo,
} from '../types';

@Injectable()
export class SolanaBlockService {
  private readonly logger = new Logger(SolanaBlockService.name);

  constructor(private readonly rpcService: SolanaRpcService) {}

  /**
   * Get the current slot
   * @returns The current slot number
   */
  async getCurrentSlot(): Promise<Slot> {
    try {
      const rpc = this.rpcService.rpc;
      const slot = await rpc.getSlot().send();

      this.logger.debug(`Current slot: ${slot}`);
      return slot;
    } catch (error) {
      this.logger.error('Failed to get current slot', error);
      throw error;
    }
  }

  /**
   * Get the current block height
   * @returns The current block height
   */
  async getBlockHeight(): Promise<bigint> {
    try {
      const rpc = this.rpcService.rpc;
      const height = await rpc.getBlockHeight().send();

      this.logger.debug(`Current block height: ${height}`);
      return height;
    } catch (error) {
      this.logger.error('Failed to get block height', error);
      throw error;
    }
  }

  /**
   * Get a block by slot number
   * @param slot The slot number
   * @param includeTransactions Whether to include transaction details
   * @returns Block information with signatures or full transactions
   */
  async getBlock<T extends boolean>(
    slot: Slot,
    includeTransactions = true as T,
  ): Promise<
    | (T extends true ? BlockInfoWithTransactions : BlockInfoWithSignatures)
    | null
  > {
    try {
      const rpc = this.rpcService.rpc;

      const block = includeTransactions
        ? await rpc
            .getBlock(slot, {
              maxSupportedTransactionVersion: 0,
              transactionDetails: 'full',
            })
            .send()
        : await rpc
            .getBlock(slot, {
              maxSupportedTransactionVersion: 0,
              transactionDetails: 'signatures',
            })
            .send();

      if (!block) {
        this.logger.warn(`No block found for slot ${slot}`);
        return null;
      }

      this.logger.debug(`Retrieved block at slot ${slot}`);
      return block as T extends true
        ? BlockInfoWithTransactions
        : BlockInfoWithSignatures;
    } catch (error) {
      this.logger.error(`Failed to get block at slot ${slot}`, error);
      throw error;
    }
  }

  /**
   * Get the latest blockhash
   * @returns Latest blockhash information including blockhash and last valid block height
   */
  async getLatestBlockhash(): Promise<BlockhashInfo> {
    try {
      const rpc = this.rpcService.rpc;
      const { value } = await rpc.getLatestBlockhash().send();

      this.logger.debug(`Latest blockhash: ${value.blockhash}`);
      return value;
    } catch (error) {
      this.logger.error('Failed to get latest blockhash', error);
      throw error;
    }
  }

  /**
   * Check if a blockhash is still valid
   * @param blockhash The blockhash to check
   * @returns True if the blockhash is valid
   */
  async isBlockhashValid(blockhash: string | Blockhash): Promise<boolean> {
    try {
      const rpc = this.rpcService.rpc;
      const { value } = await rpc
        .isBlockhashValid(blockhash as Blockhash)
        .send();

      this.logger.debug(`Blockhash ${blockhash} valid: ${value}`);
      return value;
    } catch (error) {
      this.logger.error(`Failed to check blockhash validity`, error);
      throw error;
    }
  }

  /**
   * Get the estimated production time of a block
   * @param slot The slot number
   * @returns Unix timestamp (seconds since epoch) or null
   */
  async getBlockTime(slot: Slot): Promise<bigint | null> {
    try {
      const rpc = this.rpcService.rpc;
      const time = await rpc.getBlockTime(slot).send();

      this.logger.debug(`Block time for slot ${slot}: ${time}`);
      return time;
    } catch (error) {
      this.logger.error(`Failed to get block time for slot ${slot}`, error);
      throw error;
    }
  }

  /**
   * Get a range of confirmed blocks
   * @param startSlot The starting slot (inclusive)
   * @param endSlot The ending slot (inclusive, optional)
   * @returns Array of confirmed block slot numbers
   */
  async getBlocks(startSlot: Slot, endSlot?: Slot): Promise<Slot[]> {
    try {
      const rpc = this.rpcService.rpc;
      const blocks = endSlot
        ? await rpc.getBlocks(startSlot, endSlot).send()
        : await rpc.getBlocks(startSlot).send();

      this.logger.debug(
        `Retrieved ${blocks.length} blocks from ${startSlot}${endSlot ? ` to ${endSlot}` : ''}`,
      );
      return blocks;
    } catch (error) {
      this.logger.error('Failed to get blocks', error);
      throw error;
    }
  }

  /**
   * Get blocks with a limit
   * @param startSlot The starting slot
   * @param limit Maximum number of blocks to return
   * @returns Array of confirmed block slot numbers
   */
  async getBlocksWithLimit(startSlot: Slot, limit: number): Promise<Slot[]> {
    try {
      const rpc = this.rpcService.rpc;
      const blocks = await rpc.getBlocksWithLimit(startSlot, limit).send();

      this.logger.debug(
        `Retrieved ${blocks.length} blocks starting from ${startSlot}`,
      );
      return blocks;
    } catch (error) {
      this.logger.error('Failed to get blocks with limit', error);
      throw error;
    }
  }

  /**
   * Get the slot leader
   * @returns The current slot leader's public key
   */
  async getSlotLeader(): Promise<string> {
    try {
      const rpc = this.rpcService.rpc;
      const leader = await rpc.getSlotLeader().send();

      this.logger.debug(`Current slot leader: ${leader}`);
      return leader;
    } catch (error) {
      this.logger.error('Failed to get slot leader', error);
      throw error;
    }
  }

  /**
   * Get the epoch info
   * @returns Information about the current epoch
   */
  async getEpochInfo(): Promise<EpochInfo> {
    try {
      const rpc = this.rpcService.rpc;
      const epochInfo = await rpc.getEpochInfo().send();

      this.logger.debug(
        `Epoch: ${epochInfo.epoch}, Slot: ${epochInfo.slotIndex}`,
      );
      return epochInfo;
    } catch (error) {
      this.logger.error('Failed to get epoch info', error);
      throw error;
    }
  }
}
