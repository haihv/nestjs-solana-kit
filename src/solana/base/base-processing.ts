import { Logger } from '@nestjs/common';

import { TransactionalProcessingStore } from '../interfaces/persistence.interfaces';
import { ProcessingResult } from '../types/event.types';

/**
 * Abstract base class for race-condition-safe processing
 *
 * Provides a consistent pattern for processing events or transactions
 * where multiple sources (event listeners, confirmation endpoints,
 * reconciliation jobs) may try to process the same item concurrently.
 *
 * Flow:
 * 1. Quick check outside transaction (optimization)
 * 2. Start database transaction
 * 3. Re-check inside transaction (race-condition safe)
 * 4. Process if needed
 * 5. Return result with isNew flag
 *
 * Decoupled from:
 * - Database (uses TransactionalProcessingStore interface)
 * - Prisma specifics (generic transaction context)
 * - Entity types (generic TInput, TRecord, TResult)
 *
 * @example
 * ```typescript
 * @Injectable()
 * class CardPurchaseProcessing extends BaseProcessingService<
 *   CardPurchaseInput,
 *   PurchasedCard,
 *   CardPurchaseResult
 * > {
 *   protected readonly logger = new Logger(CardPurchaseProcessing.name);
 *
 *   constructor(
 *     @Inject('CARD_PROCESSING_STORE')
 *     store: TransactionalProcessingStore<CardPurchaseInput, PurchasedCard>,
 *   ) {
 *     super(store);
 *   }
 *
 *   protected toResult(record: PurchasedCard): CardPurchaseResult {
 *     return {
 *       id: record.id,
 *       status: record.status,
 *       createdAt: record.createdAt.toISOString(),
 *     };
 *   }
 * }
 * ```
 */
export abstract class BaseProcessingService<TInput, TRecord, TResult> {
  protected abstract readonly logger: Logger;

  constructor(
    protected readonly store: TransactionalProcessingStore<TInput, TRecord>,
  ) {}

  /**
   * Main entry point - handles idempotency and transactional processing
   *
   * @param input Processing input data
   * @returns Result with isNew flag indicating if this was a new processing
   */
  async process(input: TInput): Promise<ProcessingResult<TResult>> {
    // Quick check outside transaction (optimization to avoid transaction overhead)
    const existing = await this.store.findRecord(input);
    if (existing && this.store.isFullyProcessed(existing)) {
      this.logger.debug('Already processed, returning cached result');
      return { result: this.toResult(existing), isNew: false };
    }

    // Process in transaction with race-condition-safe check
    const record = await this.store.executeInTransaction(async (tx) => {
      const existingInTx = await this.store.findRecordInTransaction(tx, input);

      // Race condition check: another process may have completed while waiting
      if (existingInTx && this.store.isFullyProcessed(existingInTx)) {
        this.logger.debug('Processed by concurrent operation');
        return existingInTx;
      }

      return this.store.saveRecordInTransaction(tx, input, existingInTx);
    });

    // Determine if this was a new processing or hit race condition
    const wasAlreadyProcessed =
      existing && this.store.isFullyProcessed(existing);

    return {
      result: this.toResult(record),
      isNew: !wasAlreadyProcessed,
    };
  }

  /**
   * Convert record to result DTO
   *
   * Transform the database record into the response format.
   * Handle type conversions (e.g., Decimal to number, Date to string).
   */
  protected abstract toResult(record: TRecord): TResult;
}
