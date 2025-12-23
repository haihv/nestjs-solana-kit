import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createSolanaRpcSubscriptions } from '@solana/kit';
import type { Address, Signature } from '@solana/kit';
import { SolanaConfigService } from './solana-config.service';
import { SolanaUtilsService } from './solana-utils.service';
import { CLUSTER_WS_URLS } from '../constants/solana.constants';
import type {
  SlotNotification,
  SolanaRpcSubscriptions,
} from '../types/rpc.types';
import type {
  AccountNotification,
  SignatureNotification,
  ProgramAccountNotification,
  LogsNotification,
} from '../types';

type SubscriptionCallback<T> = (data: T) => void | Promise<void>;

/**
 * Solana Subscription Service for real-time WebSocket updates
 *
 * Provides two API styles:
 * 1. Async generators (primary) - More testable and flexible
 * 2. Callback-based (convenience) - Simpler for basic use cases
 *
 * @example
 * ```typescript
 * // Async generator pattern (recommended)
 * const abortController = new AbortController();
 * for await (const notification of subscriptionService.accountStream(address, abortController.signal)) {
 *   console.log('Account changed:', notification);
 * }
 *
 * // Callback pattern (convenience)
 * const subId = subscriptionService.onAccountChange(address, (notification) => {
 *   console.log('Account changed:', notification);
 * });
 * subscriptionService.unsubscribe(subId);
 * ```
 */
@Injectable()
export class SolanaSubscriptionService implements OnModuleDestroy {
  private readonly logger = new Logger(SolanaSubscriptionService.name);
  private subscriptions: SolanaRpcSubscriptions | null = null;
  private activeSubscriptions: Map<number, AbortController> = new Map();
  private subscriptionCounter = 0;

  constructor(
    private readonly configService: SolanaConfigService,
    private readonly utilsService: SolanaUtilsService,
  ) {
    this.initializeSubscriptions();
  }

  private initializeSubscriptions(): void {
    try {
      const cluster = this.configService.clusterName;
      const wsUrl =
        this.configService.wsUrl ||
        CLUSTER_WS_URLS[cluster] ||
        CLUSTER_WS_URLS.devnet;

      this.subscriptions = createSolanaRpcSubscriptions(wsUrl);
      this.logger.log(`Initialized WebSocket subscriptions at ${wsUrl}`);
    } catch (error) {
      this.logger.error('Failed to initialize subscriptions', error);
    }
  }

  private ensureSubscriptionsAvailable(): void {
    if (!this.subscriptions) {
      throw new Error(
        'WebSocket subscriptions not available. Check if wsUrl is configured.',
      );
    }
  }

  // ============================================================================
  // Async Generator Methods (Primary API)
  // ============================================================================

  /**
   * Stream account change notifications
   *
   * @param accountAddress The account address to monitor
   * @param abortSignal Signal to abort the subscription
   * @yields Account notifications when the account changes
   *
   * @example
   * ```typescript
   * const controller = new AbortController();
   * for await (const notification of subscriptionService.accountStream(address, controller.signal)) {
   *   console.log('Balance:', notification.value.lamports);
   *   if (shouldStop) controller.abort();
   * }
   * ```
   */
  /* c8 ignore start */
  async *accountStream(
    accountAddress: string | Address,
    abortSignal: AbortSignal,
  ): AsyncGenerator<AccountNotification> {
    this.ensureSubscriptionsAvailable();

    const addr = this.utilsService.toAddress(accountAddress);
    this.logger.debug(`Starting account stream for ${addr}`);

    const iterable = await this.subscriptions!.accountNotifications(addr, {
      encoding: 'base64',
    }).subscribe({ abortSignal });

    for await (const notification of iterable) {
      this.logger.debug(`Account ${addr} changed`);
      yield notification;
    }
  }
  /* c8 ignore stop */

  /**
   * Stream slot change notifications
   *
   * @param abortSignal Signal to abort the subscription
   * @yields Slot notifications when the slot changes
   *
   * @example
   * ```typescript
   * const controller = new AbortController();
   * for await (const slot of subscriptionService.slotStream(controller.signal)) {
   *   console.log('Current slot:', slot.slot);
   * }
   * ```
   */
  /* c8 ignore start */
  async *slotStream(abortSignal: AbortSignal): AsyncGenerator<SlotNotification> {
    this.ensureSubscriptionsAvailable();

    this.logger.debug('Starting slot stream');

    const iterable = await this.subscriptions!.slotNotifications().subscribe({
      abortSignal,
    });

    for await (const slot of iterable) {
      this.logger.debug(`Slot changed to ${slot.slot}`);
      yield slot;
    }
  }
  /* c8 ignore stop */

  /**
   * Stream signature notifications (transaction confirmation)
   *
   * @param signature The transaction signature to monitor
   * @param abortSignal Signal to abort the subscription
   * @yields Signature notifications when confirmation status changes
   *
   * @example
   * ```typescript
   * const controller = new AbortController();
   * for await (const notification of subscriptionService.signatureStream(sig, controller.signal)) {
   *   console.log('Transaction confirmed');
   *   controller.abort(); // Usually only one notification
   * }
   * ```
   */
  /* c8 ignore start */
  async *signatureStream(
    signature: string | Signature,
    abortSignal: AbortSignal,
  ): AsyncGenerator<SignatureNotification> {
    this.ensureSubscriptionsAvailable();

    const sig = this.utilsService.toSignature(signature);
    this.logger.debug(`Starting signature stream for ${sig}`);

    const iterable = await this.subscriptions!.signatureNotifications(
      sig,
    ).subscribe({ abortSignal });

    for await (const notification of iterable) {
      this.logger.debug(`Signature ${sig} notification received`);
      yield notification;
    }
  }
  /* c8 ignore stop */

  /**
   * Stream program account change notifications
   *
   * @param programId The program ID to monitor
   * @param abortSignal Signal to abort the subscription
   * @yields Notifications when any account owned by the program changes
   *
   * @example
   * ```typescript
   * const controller = new AbortController();
   * for await (const notification of subscriptionService.programAccountStream(programId, controller.signal)) {
   *   console.log('Account:', notification.value.pubkey);
   * }
   * ```
   */
  /* c8 ignore start */
  async *programAccountStream(
    programId: string | Address,
    abortSignal: AbortSignal,
  ): AsyncGenerator<ProgramAccountNotification> {
    this.ensureSubscriptionsAvailable();

    const progId = this.utilsService.toAddress(programId);
    this.logger.debug(`Starting program account stream for ${progId}`);

    const iterable = await this.subscriptions!.programNotifications(progId, {
      encoding: 'base64',
    }).subscribe({ abortSignal });

    for await (const notification of iterable) {
      this.logger.debug(`Program ${progId} account changed`);
      yield notification;
    }
  }
  /* c8 ignore stop */

  /**
   * Stream logs notifications for an address
   *
   * @param accountAddress The account address to monitor logs for
   * @param abortSignal Signal to abort the subscription
   * @yields Log notifications when logs are emitted
   *
   * @example
   * ```typescript
   * const controller = new AbortController();
   * for await (const logs of subscriptionService.logsStream(address, controller.signal)) {
   *   console.log('Logs:', logs.value.logs);
   * }
   * ```
   */
  /* c8 ignore start */
  async *logsStream(
    accountAddress: string | Address,
    abortSignal: AbortSignal,
  ): AsyncGenerator<LogsNotification> {
    this.ensureSubscriptionsAvailable();

    const addr = this.utilsService.toAddress(accountAddress);
    this.logger.debug(`Starting logs stream for ${addr}`);

    const iterable = await this.subscriptions!.logsNotifications({
      mentions: [addr],
    }).subscribe({ abortSignal });

    for await (const logs of iterable) {
      this.logger.debug(`Logs for ${addr} received`);
      yield logs;
    }
  }
  /* c8 ignore stop */

  /**
   * Stream program logs with optional discriminator filtering
   *
   * @param programId The program ID to monitor
   * @param abortSignal Signal to abort the subscription
   * @param options Filtering options
   * @yields Filtered log notifications
   *
   * @example
   * ```typescript
   * const controller = new AbortController();
   * const discriminator = eventService.getEventDiscriminator('Transfer');
   *
   * for await (const logs of subscriptionService.programLogsStream(
   *   programId,
   *   controller.signal,
   *   { discriminators: [discriminator] }
   * )) {
   *   processTransferEvent(logs);
   * }
   * ```
   */
  /* c8 ignore start */
  async *programLogsStream(
    programId: string | Address,
    abortSignal: AbortSignal,
    options: ProgramLogsOptions = {},
  ): AsyncGenerator<LogsNotification> {
    this.ensureSubscriptionsAvailable();

    const { discriminators } = options;
    const progId = this.utilsService.toAddress(programId);
    this.logger.debug(`Starting program logs stream for ${progId}`);

    const iterable = await this.subscriptions!.logsNotifications({
      mentions: [progId],
    }).subscribe({ abortSignal });

    for await (const logs of iterable) {
      if (discriminators && discriminators.length > 0) {
        const hasMatch = this.logsContainDiscriminator(
          logs.value.logs,
          discriminators,
        );
        if (!hasMatch) {
          continue;
        }
      }

      this.logger.debug(`Program ${progId} logs received`);
      yield logs;
    }
  }
  /* c8 ignore stop */

  // ============================================================================
  // Callback Methods (Convenience API)
  // ============================================================================

  /**
   * Subscribe to account changes with callback
   *
   * Convenience wrapper around accountStream for simpler use cases.
   *
   * @param accountAddress The account address to monitor
   * @param callback Function to call when account changes
   * @returns Subscription ID for unsubscribing
   */
  onAccountChange(
    accountAddress: string | Address,
    callback: SubscriptionCallback<AccountNotification>,
  ): number {
    const abortController = new AbortController();
    const id = ++this.subscriptionCounter;
    this.activeSubscriptions.set(id, abortController);

    this.consumeStream(
      this.accountStream(accountAddress, abortController.signal),
      callback,
      id,
    );

    this.logger.log(`Subscribed to account changes (ID: ${id})`);
    return id;
  }

  /**
   * Subscribe to slot changes with callback
   */
  onSlotChange(callback: SubscriptionCallback<SlotNotification>): number {
    const abortController = new AbortController();
    const id = ++this.subscriptionCounter;
    this.activeSubscriptions.set(id, abortController);

    this.consumeStream(
      this.slotStream(abortController.signal),
      callback,
      id,
    );

    this.logger.log(`Subscribed to slot changes (ID: ${id})`);
    return id;
  }

  /**
   * Subscribe to signature notifications with callback
   */
  onSignature(
    signature: string | Signature,
    callback: SubscriptionCallback<SignatureNotification>,
  ): number {
    const abortController = new AbortController();
    const id = ++this.subscriptionCounter;
    this.activeSubscriptions.set(id, abortController);

    this.consumeStream(
      this.signatureStream(signature, abortController.signal),
      callback,
      id,
    );

    this.logger.log(`Subscribed to signature (ID: ${id})`);
    return id;
  }

  /**
   * Subscribe to program account changes with callback
   */
  onProgramAccountChange(
    programId: string | Address,
    callback: SubscriptionCallback<ProgramAccountNotification>,
  ): number {
    const abortController = new AbortController();
    const id = ++this.subscriptionCounter;
    this.activeSubscriptions.set(id, abortController);

    this.consumeStream(
      this.programAccountStream(programId, abortController.signal),
      callback,
      id,
    );

    this.logger.log(`Subscribed to program account changes (ID: ${id})`);
    return id;
  }

  /**
   * Subscribe to logs with callback
   */
  onLogs(
    accountAddress: string | Address,
    callback: SubscriptionCallback<LogsNotification>,
  ): number {
    const abortController = new AbortController();
    const id = ++this.subscriptionCounter;
    this.activeSubscriptions.set(id, abortController);

    this.consumeStream(
      this.logsStream(accountAddress, abortController.signal),
      callback,
      id,
    );

    this.logger.log(`Subscribed to logs (ID: ${id})`);
    return id;
  }

  /**
   * Subscribe to program logs with callback and optional filtering
   */
  onProgramLogs(
    programId: string | Address,
    callback: SubscriptionCallback<LogsNotification>,
    options: ProgramLogsOptions = {},
  ): number {
    const abortController = new AbortController();
    const id = ++this.subscriptionCounter;
    this.activeSubscriptions.set(id, abortController);

    this.consumeStream(
      this.programLogsStream(programId, abortController.signal, options),
      callback,
      id,
    );

    this.logger.log(`Subscribed to program logs (ID: ${id})`);
    return id;
  }

  /**
   * Consume an async generator and call callback for each value
   */
  private consumeStream<T>(
    stream: AsyncGenerator<T>,
    callback: SubscriptionCallback<T>,
    subscriptionId: number,
  ): void {
    (async () => {
      try {
        for await (const value of stream) {
          await callback(value);
        }
      } catch (error) {
        if (!this.utilsService.isAbortError(error)) {
          this.logger.error(`Subscription ${subscriptionId} error:`, error);
        }
      }
      // Defensive: catches errors if the catch block itself throws
      /* c8 ignore next 3 */
    })().catch((error) => {
      this.logger.error(`Subscription ${subscriptionId} setup error:`, error);
    });
  }

  // ============================================================================
  // Retry Helper
  // ============================================================================

  /**
   * Subscribe with automatic retry on failure
   */
  async subscribeWithRetry(
    subscribeFn: () => number,
    options: RetryOptions = {},
  ): Promise<number> {
    const {
      maxRetries = 5,
      initialDelayMs = 1000,
      maxDelayMs = 30000,
      onRetry,
    } = options;

    let delay = initialDelayMs;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return subscribeFn();
      } catch (error) {
        if (attempt === maxRetries) {
          this.logger.error(
            `Subscription failed after ${maxRetries} attempts`,
            error,
          );
          throw error;
        }

        this.logger.warn(
          `Subscription attempt ${attempt} failed, retrying in ${delay}ms`,
        );

        if (onRetry) {
          onRetry(attempt, error as Error);
        }

        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(delay * 2, maxDelayMs);
      }
    }

    throw new Error('Subscription failed: no attempts made');
  }

  // ============================================================================
  // Subscription Management
  // ============================================================================

  /**
   * Unsubscribe from a subscription
   */
  unsubscribe(subscriptionId: number): void {
    const abortController = this.activeSubscriptions.get(subscriptionId);

    if (abortController) {
      abortController.abort();
      this.activeSubscriptions.delete(subscriptionId);
      this.logger.log(`Unsubscribed from subscription ${subscriptionId}`);
    } else {
      this.logger.warn(`Subscription ${subscriptionId} not found`);
    }
  }

  /**
   * Unsubscribe from all active subscriptions
   */
  unsubscribeAll(): void {
    this.logger.log(
      `Unsubscribing from ${this.activeSubscriptions.size} subscriptions`,
    );

    for (const [, abortController] of this.activeSubscriptions.entries()) {
      abortController.abort();
    }

    this.activeSubscriptions.clear();
  }

  /**
   * Get the number of active subscriptions
   */
  getActiveSubscriptionCount(): number {
    return this.activeSubscriptions.size;
  }

  /**
   * Lifecycle hook for cleanup
   */
  onModuleDestroy(): void {
    this.logger.log('Cleaning up all subscriptions');
    this.unsubscribeAll();
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private logsContainDiscriminator(
    logs: readonly string[],
    discriminators: Uint8Array[],
  ): boolean {
    for (const log of logs) {
      if (!log.startsWith('Program data: ')) {
        continue;
      }

      try {
        const base64Data = log.slice('Program data: '.length);
        const data = Buffer.from(base64Data, 'base64');

        for (const discriminator of discriminators) {
          if (data.length >= discriminator.length) {
            const logDiscriminator = data.slice(0, discriminator.length);
            if (this.bytesEqual(logDiscriminator, discriminator)) {
              return true;
            }
          }
        }
        /* c8 ignore next 3 */
      } catch {
        // Defensive: Buffer.from with 'base64' is permissive and won't throw
      }
    }

    return false;
  }

  private bytesEqual(a: Uint8Array | Buffer, b: Uint8Array): boolean {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  }
}

/**
 * Options for program logs subscription
 */
type ProgramLogsOptions = {
  readonly discriminators?: Uint8Array[];
};

/**
 * Options for subscription retry
 */
type RetryOptions = {
  readonly maxRetries?: number;
  readonly initialDelayMs?: number;
  readonly maxDelayMs?: number;
  readonly onRetry?: (attempt: number, error: Error) => void;
};
