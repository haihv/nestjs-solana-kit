import { Logger } from '@nestjs/common';

import { TransactionRecordStore } from '../interfaces/persistence.interfaces';
import { ConfirmationResult } from '../types/event.types';

/**
 * Abstract base class for transaction confirmation
 *
 * Orchestrates the 5-step confirmation flow used by ALL sync sources:
 * 1. Extract data from transaction
 * 2. Find or create record
 * 3. Check idempotency
 * 4. Verify transaction
 * 5. Process confirmation
 *
 * Decoupled from:
 * - Database (uses TransactionRecordStore interface)
 * - Specific Solana services (inject in concrete class)
 * - Entity types (generic TRecord, TExtractedData, TResult)
 *
 * @example
 * ```typescript
 * @Injectable()
 * class CardPurchaseConfirmation extends BaseTransactionConfirmationService<
 *   CardPurchaseExtractedData,
 *   PurchasedCard,
 *   CardPurchaseResult
 * > {
 *   constructor(
 *     @Inject('CARD_STORE') store: TransactionRecordStore<PurchasedCard, CardPurchaseExtractedData>,
 *     private readonly transactionService: SolanaTransactionService,
 *     private readonly programService: ZomboxProgramService,
 *   ) {
 *     super(store);
 *   }
 *
 *   protected async extractData(signature: string): Promise<CardPurchaseExtractedData> {
 *     const tx = await this.transactionService.getTransaction(signature);
 *     return this.programService.parseCardPurchase(tx);
 *   }
 *
 *   protected async verify(signature: string, data: CardPurchaseExtractedData): Promise<void> {
 *     await this.programService.verifyCardPurchase(signature, data);
 *   }
 *
 *   protected toResult(record: PurchasedCard): CardPurchaseResult {
 *     return { cardId: record.id, status: record.status };
 *   }
 * }
 * ```
 */
export abstract class BaseTransactionConfirmationService<
  TExtractedData extends Record<string, unknown>,
  TRecord,
  TResult,
> {
  protected readonly logger = new Logger(this.constructor.name);

  constructor(
    protected readonly recordStore: TransactionRecordStore<
      TRecord,
      TExtractedData
    >,
  ) {}

  /**
   * Main entry point - orchestrates 5-step confirmation flow
   *
   * @param signature Transaction signature to confirm
   * @param userId User ID who initiated the transaction
   * @returns Confirmation result with data and status
   */
  async confirmTransaction(
    signature: string,
    userId: string,
  ): Promise<ConfirmationResult<TResult>> {
    const logCtx = { signature: this.truncateSignature(signature) };

    try {
      // Step 1: Extract data from transaction
      this.logger.debug('Step 1: Extracting data', logCtx);
      const extractedData = await this.extractData(signature);

      // Step 2: Find or create record
      this.logger.debug('Step 2: Finding or creating record', logCtx);
      let record = await this.recordStore.findRecord(extractedData);
      if (!record) {
        record = await this.recordStore.createRecord(extractedData, userId);
      }

      // Step 3: Check idempotency
      if (this.recordStore.isConfirmed(record)) {
        this.logger.debug('Already confirmed, returning cached result', logCtx);
        return {
          data: this.toResult(record),
          status: 'already_processed',
          message: 'Transaction was already confirmed',
        };
      }

      // Step 4: Verify transaction
      this.logger.debug('Step 4: Verifying transaction', logCtx);
      await this.verify(signature, extractedData);

      // Step 5: Process confirmation
      this.logger.debug('Step 5: Processing confirmation', logCtx);
      const confirmedRecord = await this.recordStore.confirmRecord(
        record,
        extractedData,
      );

      this.logger.log('Transaction confirmed successfully', logCtx);

      return {
        data: this.toResult(confirmedRecord),
        status: 'processed',
        message: 'Transaction confirmed successfully',
      };
    } catch (error) {
      this.logger.error('Confirmation failed', {
        ...logCtx,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Extract data from on-chain transaction
   *
   * Parse the transaction and extract relevant data.
   * Don't verify here - just extract.
   */
  protected abstract extractData(signature: string): Promise<TExtractedData>;

  /**
   * Verify transaction is valid on-chain
   *
   * Check that the transaction:
   * - Is confirmed on-chain
   * - Contains expected instructions
   * - Has valid signatures
   *
   * Throw if verification fails.
   */
  protected abstract verify(
    signature: string,
    data: TExtractedData,
  ): Promise<void>;

  /**
   * Convert record to result DTO
   *
   * Transform the database record into the response format.
   */
  protected abstract toResult(record: TRecord): TResult;

  private truncateSignature(signature: string, length = 8): string {
    return signature.length > length
      ? `${signature.substring(0, length)}...`
      : signature;
  }
}
