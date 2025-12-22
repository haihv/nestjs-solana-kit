/**
 * Persistence interfaces for on-chain event processing
 *
 * These interfaces decouple base classes from specific database implementations.
 * Users implement these with their database of choice (Prisma, Mongoose, TypeORM, etc.).
 *
 * @example
 * ```typescript
 * // Prisma implementation
 * @Injectable()
 * class PrismaEventStore implements EventIdempotencyStore {
 *   constructor(private readonly prisma: PrismaService) {}
 *
 *   async isProcessed(key: string): Promise<boolean> {
 *     const existing = await this.prisma.processedEvent.findUnique({ where: { key } });
 *     return !!existing;
 *   }
 *
 *   async markProcessed(key: string, metadata?: Record<string, unknown>): Promise<void> {
 *     await this.prisma.processedEvent.create({ data: { key, metadata: metadata ?? {} } });
 *   }
 * }
 * ```
 */

/**
 * Store for checking and marking events as processed (idempotency)
 *
 * Implement this interface to provide idempotency checking for event listeners.
 * The key can be a transaction signature or any unique identifier.
 */
export type EventIdempotencyStore = {
  /**
   * Check if an event has already been processed
   * @param key Unique identifier (typically transaction signature)
   */
  isProcessed(key: string): Promise<boolean>;

  /**
   * Mark an event as processed
   * @param key Unique identifier
   * @param metadata Optional metadata to store alongside the key
   */
  markProcessed(key: string, metadata?: Record<string, unknown>): Promise<void>;
};

/**
 * Store for transaction record management during confirmation
 *
 * Implement this interface to manage records through the 5-step confirmation flow.
 * Supports finding existing records, creating new ones, and confirming transactions.
 */
export type TransactionRecordStore<TRecord, TExtractedData> = {
  /**
   * Find existing record by extracted transaction data
   */
  findRecord(data: TExtractedData): Promise<TRecord | null>;

  /**
   * Create new record from extracted data
   * Called when no existing record is found
   */
  createRecord(data: TExtractedData, userId: string): Promise<TRecord>;

  /**
   * Check if record has already been confirmed
   * Used for idempotency in the confirmation flow
   */
  isConfirmed(record: TRecord): boolean;

  /**
   * Update record with confirmation data
   * Called after transaction verification succeeds
   */
  confirmRecord(record: TRecord, data: TExtractedData): Promise<TRecord>;
};

/**
 * Store for race-condition-safe transactional processing
 *
 * Implement this interface to provide database transaction support.
 * The pattern: quick check outside transaction, then re-check inside for race safety.
 *
 * @example
 * ```typescript
 * // Prisma implementation
 * @Injectable()
 * class PrismaProcessingStore implements TransactionalProcessingStore<Input, Record> {
 *   constructor(private readonly prisma: PrismaService) {}
 *
 *   async executeInTransaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
 *     return this.prisma.$transaction(fn);
 *   }
 *
 *   async findRecordInTransaction(tx: any, input: Input): Promise<Record | null> {
 *     return tx.record.findFirst({ where: { id: input.id } });
 *   }
 *
 *   // ... other methods
 * }
 * ```
 */
export type TransactionalProcessingStore<TInput, TRecord> = {
  /**
   * Find record outside transaction (quick optimization check)
   */
  findRecord(input: TInput): Promise<TRecord | null>;

  /**
   * Execute processing inside a database transaction
   * @param fn Callback that receives transaction context
   */
  executeInTransaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T>;

  /**
   * Find record inside transaction (race-condition safe)
   * @param tx Transaction context from executeInTransaction
   */
  findRecordInTransaction(tx: unknown, input: TInput): Promise<TRecord | null>;

  /**
   * Save record inside transaction
   * @param tx Transaction context
   * @param input Processing input data
   * @param existing Existing record found in transaction (may be null)
   */
  saveRecordInTransaction(
    tx: unknown,
    input: TInput,
    existing: TRecord | null,
  ): Promise<TRecord>;

  /**
   * Check if record is fully processed (no more work needed)
   */
  isFullyProcessed(record: TRecord): boolean;
};
