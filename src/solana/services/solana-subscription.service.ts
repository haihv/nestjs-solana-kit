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
 * Note: This service uses the @solana/kit v4 subscription API which returns AsyncIterables.
 * The subscription methods create background async loops that consume the iterables.
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

      // Create subscriptions client with the WebSocket URL
      this.subscriptions = createSolanaRpcSubscriptions(wsUrl);

      this.logger.log(`Initialized WebSocket subscriptions at ${wsUrl}`);
    } catch (error) {
      this.logger.error('Failed to initialize subscriptions', error);
      // Non-fatal error - subscriptions are optional
    }
  }

  private ensureSubscriptionsAvailable(): void {
    if (!this.subscriptions) {
      throw new Error(
        'WebSocket subscriptions not available. Check if wsUrl is configured.',
      );
    }
  }

  /**
   * Subscribe to account changes
   * @param accountAddress The account address to monitor
   * @param callback Function to call when account changes
   * @returns Subscription ID that can be used to unsubscribe
   */
  onAccountChange(
    accountAddress: string | Address,
    callback: SubscriptionCallback<AccountNotification>,
  ): number {
    this.ensureSubscriptionsAvailable();

    try {
      const addr = this.utilsService.toAddress(accountAddress);

      const abortController = new AbortController();
      const id = ++this.subscriptionCounter;
      this.activeSubscriptions.set(id, abortController);

      // Create subscription and consume async iterable
      (async () => {
        try {
          const iterable = await this.subscriptions!.accountNotifications(
            addr,
            {
              encoding: 'base64',
            },
          ).subscribe({ abortSignal: abortController.signal });

          for await (const notification of iterable) {
            this.logger.debug(`Account ${addr} changed`);
            await callback(notification);
          }
        } catch (error) {
          if (!this.utilsService.isAbortError(error)) {
            this.logger.error(`Subscription ${id} error:`, error);
          }
        }
      })().catch((error) => {
        this.logger.error(`Subscription ${id} setup error:`, error);
      });

      this.logger.log(`Subscribed to account changes for ${addr} (ID: ${id})`);
      return id;
    } catch (error) {
      this.logger.error(
        `Failed to subscribe to account ${accountAddress}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Subscribe to slot changes
   * @param callback Function to call when slot changes
   * @returns Subscription ID
   */
  onSlotChange(callback: SubscriptionCallback<SlotNotification>): number {
    this.ensureSubscriptionsAvailable();

    try {
      const abortController = new AbortController();
      const id = ++this.subscriptionCounter;
      this.activeSubscriptions.set(id, abortController);

      // Create subscription and consume async iterable
      (async () => {
        try {
          const iterable =
            await this.subscriptions!.slotNotifications().subscribe({
              abortSignal: abortController.signal,
            });

          for await (const slot of iterable) {
            this.logger.debug(`Slot changed to ${slot.slot}`);
            await callback(slot);
          }
        } catch (error) {
          if (!this.utilsService.isAbortError(error)) {
            this.logger.error(`Subscription ${id} error:`, error);
          }
        }
      })().catch((error) => {
        this.logger.error(`Subscription ${id} setup error:`, error);
      });

      this.logger.log(`Subscribed to slot changes (ID: ${id})`);
      return id;
    } catch (error) {
      this.logger.error('Failed to subscribe to slot changes', error);
      throw error;
    }
  }

  /**
   * Subscribe to signature notifications (transaction confirmation)
   * @param signature The transaction signature to monitor
   * @param callback Function to call when signature status changes
   * @returns Subscription ID
   */
  onSignature(
    signature: string | Signature,
    callback: SubscriptionCallback<SignatureNotification>,
  ): number {
    this.ensureSubscriptionsAvailable();

    try {
      const sig = this.utilsService.toSignature(signature);
      const abortController = new AbortController();
      const id = ++this.subscriptionCounter;
      this.activeSubscriptions.set(id, abortController);

      // Create subscription and consume async iterable
      (async () => {
        try {
          const iterable = await this.subscriptions!.signatureNotifications(
            sig,
          ).subscribe({
            abortSignal: abortController.signal,
          });

          for await (const notification of iterable) {
            this.logger.debug(`Signature ${signature} notification received`);
            await callback(notification);
          }
        } catch (error) {
          if (!this.utilsService.isAbortError(error)) {
            this.logger.error(`Subscription ${id} error:`, error);
          }
        }
      })().catch((error) => {
        this.logger.error(`Subscription ${id} setup error:`, error);
      });

      this.logger.log(`Subscribed to signature ${signature} (ID: ${id})`);
      return id;
    } catch (error) {
      this.logger.error(`Failed to subscribe to signature ${signature}`, error);
      throw error;
    }
  }

  /**
   * Subscribe to program account changes
   * @param programId The program ID to monitor
   * @param callback Function to call when any account owned by the program changes
   * @returns Subscription ID
   */
  onProgramAccountChange(
    programId: string | Address,
    callback: SubscriptionCallback<ProgramAccountNotification>,
  ): number {
    this.ensureSubscriptionsAvailable();

    try {
      const progId = this.utilsService.toAddress(programId);

      const abortController = new AbortController();
      const id = ++this.subscriptionCounter;
      this.activeSubscriptions.set(id, abortController);

      // Create subscription and consume async iterable
      (async () => {
        try {
          const iterable = await this.subscriptions!.programNotifications(
            progId,
            {
              encoding: 'base64',
            },
          ).subscribe({ abortSignal: abortController.signal });

          for await (const notification of iterable) {
            this.logger.debug(`Program ${progId} account changed`);
            await callback(notification);
          }
        } catch (error) {
          if (!this.utilsService.isAbortError(error)) {
            this.logger.error(`Subscription ${id} error:`, error);
          }
        }
      })().catch((error) => {
        this.logger.error(`Subscription ${id} setup error:`, error);
      });

      this.logger.log(
        `Subscribed to program account changes for ${progId} (ID: ${id})`,
      );
      return id;
    } catch (error) {
      this.logger.error(`Failed to subscribe to program ${programId}`, error);
      throw error;
    }
  }

  /**
   * Subscribe to logs for a specific address
   * @param accountAddress The account address to monitor logs for
   * @param callback Function to call when logs are emitted
   * @returns Subscription ID
   */
  onLogs(
    accountAddress: string | Address,
    callback: SubscriptionCallback<LogsNotification>,
  ): number {
    this.ensureSubscriptionsAvailable();

    try {
      const addr = this.utilsService.toAddress(accountAddress);

      const abortController = new AbortController();
      const id = ++this.subscriptionCounter;
      this.activeSubscriptions.set(id, abortController);

      // Create subscription and consume async iterable
      (async () => {
        try {
          const iterable = await this.subscriptions!.logsNotifications({
            mentions: [addr],
          }).subscribe({ abortSignal: abortController.signal });

          for await (const logs of iterable) {
            this.logger.debug(`Logs for ${addr} received`);
            await callback(logs);
          }
        } catch (error) {
          if (!this.utilsService.isAbortError(error)) {
            this.logger.error(`Subscription ${id} error:`, error);
          }
        }
      })().catch((error) => {
        this.logger.error(`Subscription ${id} setup error:`, error);
      });

      this.logger.log(`Subscribed to logs for ${addr} (ID: ${id})`);
      return id;
    } catch (error) {
      this.logger.error(
        `Failed to subscribe to logs for ${accountAddress}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Unsubscribe from a subscription
   * @param subscriptionId The subscription ID returned from subscribe methods
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
   * @returns Number of active subscriptions
   */
  getActiveSubscriptionCount(): number {
    return this.activeSubscriptions.size;
  }

  /**
   * Lifecycle hook called when the module is being destroyed
   *
   * Automatically unsubscribes from all active WebSocket subscriptions
   * when the NestJS module is shutting down. This prevents memory leaks
   * and ensures all connections are properly closed.
   *
   * All active AbortControllers are triggered, which cancels their
   * associated subscription loops gracefully.
   *
   * @see https://docs.nestjs.com/fundamentals/lifecycle-events
   */
  onModuleDestroy(): void {
    this.logger.log('Cleaning up all subscriptions');
    this.unsubscribeAll();
  }
}
