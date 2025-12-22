import { Logger } from '@nestjs/common';
import { vi } from 'vitest';

import { EventIdempotencyStore } from '../interfaces/persistence.interfaces';
import {
  OnChainEventContext,
  OnChainProcessingError,
} from '../types/event.types';
import { BaseOnChainEventListener } from './base-event-listener';

type TestEvent = {
  id: string;
  amount: bigint;
};

class TestEventListener extends BaseOnChainEventListener<TestEvent> {
  protected readonly logger = new Logger(TestEventListener.name);
  readonly eventName = 'TestEvent';

  public handleEventMock = vi.fn<
    [TestEvent, OnChainEventContext],
    Promise<void>
  >();

  protected async handleEvent(
    event: TestEvent,
    context: OnChainEventContext,
  ): Promise<void> {
    return this.handleEventMock(event, context);
  }
}

class CustomIdempotencyListener extends BaseOnChainEventListener<TestEvent> {
  protected readonly logger = new Logger(CustomIdempotencyListener.name);
  readonly eventName = 'CustomIdempotencyEvent';

  public handleEventMock = vi.fn<
    [TestEvent, OnChainEventContext],
    Promise<void>
  >();

  protected async handleEvent(
    event: TestEvent,
    context: OnChainEventContext,
  ): Promise<void> {
    return this.handleEventMock(event, context);
  }

  protected getIdempotencyKey(event: TestEvent): string {
    return event.id;
  }
}

describe('BaseOnChainEventListener', () => {
  let listener: TestEventListener;
  let mockStore: EventIdempotencyStore;

  const testEvent: TestEvent = {
    id: 'event-123',
    amount: BigInt(1000),
  };

  const testContext: OnChainEventContext = {
    signature: 'abc123def456ghi789',
    slot: BigInt(12345),
    blockTime: 1700000000,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockStore = {
      isProcessed: vi.fn().mockResolvedValue(false),
      markProcessed: vi.fn().mockResolvedValue(undefined),
    };

    listener = new TestEventListener(mockStore);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(listener).toBeDefined();
    expect(listener.eventName).toBe('TestEvent');
  });

  describe('processEvent', () => {
    it('should process event successfully', async () => {
      listener.handleEventMock.mockResolvedValue(undefined);

      await listener.processEvent(testEvent, testContext);

      expect(mockStore.isProcessed).toHaveBeenCalledWith(testContext.signature);
      expect(listener.handleEventMock).toHaveBeenCalledWith(
        testEvent,
        testContext,
      );
      expect(mockStore.markProcessed).toHaveBeenCalledWith(
        testContext.signature,
        expect.objectContaining({
          eventName: 'TestEvent',
          processedAt: expect.any(Number),
        }),
      );
    });

    it('should skip already processed events', async () => {
      (mockStore.isProcessed as ReturnType<typeof vi.fn>).mockResolvedValue(
        true,
      );

      await listener.processEvent(testEvent, testContext);

      expect(mockStore.isProcessed).toHaveBeenCalledWith(testContext.signature);
      expect(listener.handleEventMock).not.toHaveBeenCalled();
      expect(mockStore.markProcessed).not.toHaveBeenCalled();
    });

    it('should work without idempotency store', async () => {
      const listenerWithoutStore = new TestEventListener();
      listenerWithoutStore.handleEventMock.mockResolvedValue(undefined);

      await listenerWithoutStore.processEvent(testEvent, testContext);

      expect(listenerWithoutStore.handleEventMock).toHaveBeenCalledWith(
        testEvent,
        testContext,
      );
    });

    it('should wrap unknown errors in OnChainProcessingError', async () => {
      listener.handleEventMock.mockRejectedValue(new Error('Something failed'));

      await expect(
        listener.processEvent(testEvent, testContext),
      ).rejects.toThrow(OnChainProcessingError);

      try {
        await listener.processEvent(testEvent, testContext);
      } catch (error) {
        expect(error).toBeInstanceOf(OnChainProcessingError);
        expect((error as OnChainProcessingError).retryable).toBe(true);
        expect((error as OnChainProcessingError).message).toContain(
          'Failed to process TestEvent',
        );
      }
    });

    it('should rethrow OnChainProcessingError as-is', async () => {
      const originalError = new OnChainProcessingError(
        'Custom error',
        false,
        new Error('cause'),
      );
      listener.handleEventMock.mockRejectedValue(originalError);

      await expect(
        listener.processEvent(testEvent, testContext),
      ).rejects.toThrow(originalError);
    });
  });

  describe('custom idempotency key', () => {
    it('should use custom idempotency key when overridden', async () => {
      const customListener = new CustomIdempotencyListener(mockStore);
      customListener.handleEventMock.mockResolvedValue(undefined);

      await customListener.processEvent(testEvent, testContext);

      expect(mockStore.isProcessed).toHaveBeenCalledWith(testEvent.id);
      expect(mockStore.markProcessed).toHaveBeenCalledWith(
        testEvent.id,
        expect.any(Object),
      );
    });
  });

  describe('error helpers', () => {
    class ErrorTestListener extends BaseOnChainEventListener<TestEvent> {
      protected readonly logger = new Logger(ErrorTestListener.name);
      readonly eventName = 'ErrorTestEvent';

      public throwNonRetryable = false;
      public throwRetryable = false;

      protected async handleEvent(): Promise<void> {
        if (this.throwNonRetryable) {
          this.nonRetryableError('Non-retryable failure');
        }
        if (this.throwRetryable) {
          this.retryableError('Retryable failure');
        }
      }
    }

    it('should throw non-retryable error', async () => {
      const errorListener = new ErrorTestListener();
      errorListener.throwNonRetryable = true;

      try {
        await errorListener.processEvent(testEvent, testContext);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(OnChainProcessingError);
        expect((error as OnChainProcessingError).retryable).toBe(false);
        expect((error as OnChainProcessingError).message).toBe(
          'Non-retryable failure',
        );
      }
    });

    it('should throw retryable error', async () => {
      const errorListener = new ErrorTestListener();
      errorListener.throwRetryable = true;

      try {
        await errorListener.processEvent(testEvent, testContext);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(OnChainProcessingError);
        expect((error as OnChainProcessingError).retryable).toBe(true);
        expect((error as OnChainProcessingError).message).toBe(
          'Retryable failure',
        );
      }
    });
  });

  describe('OnChainEventListener interface', () => {
    it('should implement OnChainEventListener interface', () => {
      expect(listener.eventName).toBeDefined();
      expect(typeof listener.processEvent).toBe('function');
    });
  });
});
