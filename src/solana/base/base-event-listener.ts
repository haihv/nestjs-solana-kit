import { Logger } from '@nestjs/common';

import { EventIdempotencyStore } from '../interfaces/persistence.interfaces';
import {
  OnChainEventContext,
  OnChainProcessingError,
} from '../types/event.types';

/**
 * Interface for on-chain event listeners
 *
 * Defines the contract for processing blockchain events.
 */
export type OnChainEventListener<TEvent = unknown> = {
  readonly eventName: string;
  processEvent(event: TEvent, context: OnChainEventContext): Promise<void>;
};

/**
 * Abstract base class for on-chain event listeners
 *
 * Provides common functionality for processing blockchain events:
 * - Error handling with retryable/non-retryable classification
 * - Idempotency checking via pluggable store
 * - Standardized logging
 *
 * Decoupled from:
 * - Database (uses EventIdempotencyStore interface)
 * - Queue system (just throws errors with retryable flag)
 * - User model (no user lookup - override handleEvent if needed)
 *
 * @example
 * ```typescript
 * @Injectable()
 * class CardPurchasedListener extends BaseOnChainEventListener<CardPurchasedEvent> {
 *   protected readonly logger = new Logger(CardPurchasedListener.name);
 *   readonly eventName = 'CardPurchased';
 *
 *   constructor(
 *     @Inject('EVENT_STORE') store: EventIdempotencyStore,
 *     private readonly processingService: CardProcessingService,
 *   ) {
 *     super(store);
 *   }
 *
 *   protected async handleEvent(
 *     event: CardPurchasedEvent,
 *     context: OnChainEventContext,
 *   ): Promise<void> {
 *     await this.processingService.process(event);
 *   }
 *
 *   // Optional: custom idempotency key (default is signature)
 *   protected getIdempotencyKey(event: CardPurchasedEvent): string {
 *     return event.vrfAccount; // use VRF account instead of signature
 *   }
 * }
 * ```
 */
export abstract class BaseOnChainEventListener<TEvent>
  implements OnChainEventListener<TEvent>
{
  protected abstract readonly logger: Logger;
  abstract readonly eventName: string;

  constructor(protected readonly idempotencyStore?: EventIdempotencyStore) {}

  /**
   * Main entry point for event processing
   *
   * Wraps handleEvent with error handling and idempotency checking.
   * Called by queue workers or event subscribers.
   */
  async processEvent(
    event: TEvent,
    context: OnChainEventContext,
  ): Promise<void> {
    const logContext = { signature: this.truncateSignature(context.signature) };

    try {
      this.logger.log(`${this.eventName} received`, logContext);

      const idempotencyKey = this.getIdempotencyKey(event, context);
      if (
        this.idempotencyStore &&
        (await this.idempotencyStore.isProcessed(idempotencyKey))
      ) {
        this.logger.debug(`${this.eventName} already processed`, logContext);
        return;
      }

      await this.handleEvent(event, context);

      if (this.idempotencyStore) {
        await this.idempotencyStore.markProcessed(idempotencyKey, {
          eventName: this.eventName,
          processedAt: Date.now(),
        });
      }

      this.logger.log(`${this.eventName} processed successfully`, logContext);
    } catch (error) {
      this.logError(error, context);

      if (error instanceof OnChainProcessingError) {
        throw error;
      }

      throw new OnChainProcessingError(
        `Failed to process ${this.eventName}`,
        true,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Domain-specific event handling logic
   *
   * Implement this method in concrete classes to process the event.
   * Throw OnChainProcessingError for controlled error handling.
   */
  protected abstract handleEvent(
    event: TEvent,
    context: OnChainEventContext,
  ): Promise<void>;

  /**
   * Get unique key for idempotency checking
   *
   * Default: transaction signature
   * Override for custom strategies (e.g., by VRF account, by seed)
   */
  protected getIdempotencyKey(
    _event: TEvent,
    context: OnChainEventContext,
  ): string {
    return context.signature;
  }

  /**
   * Throw non-retryable error
   *
   * Use for permanent failures: invalid data, business rule violations.
   * Queue system will NOT retry the job.
   */
  protected nonRetryableError(message: string, cause?: Error): never {
    throw new OnChainProcessingError(message, false, cause);
  }

  /**
   * Throw retryable error
   *
   * Use for transient failures: network timeouts, temporary unavailability.
   * Queue system will retry with backoff.
   */
  protected retryableError(message: string, cause?: Error): never {
    throw new OnChainProcessingError(message, true, cause);
  }

  /**
   * Log error with context
   */
  protected logError(error: unknown, context: OnChainEventContext): void {
    this.logger.error(`Failed to process ${this.eventName}`, {
      signature: context.signature,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  private truncateSignature(signature: string, length = 8): string {
    return signature.length > length
      ? `${signature.substring(0, length)}...`
      : signature;
  }
}
