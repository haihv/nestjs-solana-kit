/**
 * Types for on-chain event processing
 *
 * These types support generic event listening, transaction confirmation,
 * and processing patterns that are common to all on-chain applications.
 */

/**
 * Context passed with on-chain events
 *
 * Contains blockchain-specific metadata about when/where the event occurred.
 * Decoupled from any database or application-specific concerns.
 */
export type OnChainEventContext = {
  readonly signature: string;
  readonly slot: bigint;
  readonly blockTime: number | null;
};

/**
 * Processing error with retry semantics
 *
 * Use this error class when processing on-chain events to indicate
 * whether the queue system should retry the failed job.
 *
 * @example
 * ```typescript
 * // Retryable error (network timeout, temporary unavailability)
 * throw new OnChainProcessingError('RPC timeout', true);
 *
 * // Non-retryable error (invalid data, business rule violation)
 * throw new OnChainProcessingError('Invalid instruction data', false);
 * ```
 */
export class OnChainProcessingError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean = true,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'OnChainProcessingError';
  }
}

/**
 * Result of transaction confirmation
 *
 * Returned by confirmation services to indicate whether the transaction
 * was newly processed or had already been confirmed.
 */
export type ConfirmationResult<T> = {
  readonly data: T;
  readonly status: 'already_processed' | 'processed';
  readonly message: string;
};

/**
 * Result of processing an event or transaction
 *
 * Indicates whether processing created a new record or found an existing one.
 */
export type ProcessingResult<T> = {
  readonly result: T;
  readonly isNew: boolean;
};
