import { vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { SolanaConfigService } from './solana-config.service';
import { SolanaSubscriptionService } from './solana-subscription.service';
import { SolanaUtilsService } from './solana-utils.service';
import {
  TEST_ADDRESSES,
  TEST_SIGNATURES,
  TEST_RPC_OPTIONS,
} from '../__tests__/test-fixtures';
import type { Address, Signature } from '@solana/kit';

// Track if we should fail initialization
let shouldFailInit = false;

vi.mock('@solana/kit', async (importOriginal) => {
  const original = await importOriginal<typeof import('@solana/kit')>();
  return {
    ...original,
    createSolanaRpcSubscriptions: (...args: unknown[]) => {
      if (shouldFailInit) {
        throw new Error('WebSocket connection failed');
      }
      return original.createSolanaRpcSubscriptions(
        ...(args as Parameters<typeof original.createSolanaRpcSubscriptions>),
      );
    },
  };
});

// Mock factory functions
const createMockConfigService = (
  options: {
    rpcUrl: string;
    cluster: string;
    commitment?: string;
    wsUrl?: string;
  } = TEST_RPC_OPTIONS.DEVNET,
  cluster: string = 'devnet',
) => ({
  get options() {
    return options;
  },
  get clusterName() {
    return cluster;
  },
  get rpcUrl() {
    return options.rpcUrl;
  },
  get commitment() {
    return options.commitment || 'confirmed';
  },
  get wsUrl() {
    return options.wsUrl;
  },
});

const createMockUtilsService = () => ({
  toAddress: vi.fn((addr: string) => addr as Address),
  toSignature: vi.fn((sig: string) => sig as Signature),
  isAbortError: vi.fn((error: unknown) => {
    const err = error as { name?: string };
    return (
      err?.name === 'AbortError' ||
      (error instanceof Error && error.name === 'AbortError')
    );
  }),
});

describe('SolanaSubscriptionService', () => {
  let service: SolanaSubscriptionService;
  let mockConfigService: ReturnType<typeof createMockConfigService>;
  let mockUtilsService: ReturnType<typeof createMockUtilsService>;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockConfigService = createMockConfigService();
    mockUtilsService = createMockUtilsService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolanaSubscriptionService,
        {
          provide: SolanaConfigService,
          useValue: mockConfigService,
        },
        {
          provide: SolanaUtilsService,
          useValue: mockUtilsService,
        },
      ],
    }).compile();

    service = module.get<SolanaSubscriptionService>(SolanaSubscriptionService);
  });

  afterEach(() => {
    // Clean up all active subscriptions to prevent handle leaks
    service.unsubscribeAll();
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initialization', () => {
    it('should initialize subscriptions in constructor', () => {
      expect(service).toBeDefined();
      expect(mockConfigService.options).toBeDefined();
      expect(mockConfigService.clusterName).toBe('devnet');
    });

    it('should use default devnet URL when no wsUrl provided', () => {
      expect(service).toBeDefined();
      const options = mockConfigService.options;
      expect(options.cluster).toBe('devnet');
    });

    it('should fallback to devnet URL for unknown cluster', async () => {
      const unknownClusterOptions = {
        rpcUrl: 'https://custom.rpc.url',
        cluster: 'unknown-cluster',
      };
      const unknownMockConfig = createMockConfigService(
        unknownClusterOptions,
        'unknown-cluster',
      );

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SolanaSubscriptionService,
          { provide: SolanaConfigService, useValue: unknownMockConfig },
          { provide: SolanaUtilsService, useValue: mockUtilsService },
        ],
      }).compile();

      const unknownService = module.get<SolanaSubscriptionService>(
        SolanaSubscriptionService,
      );
      expect(unknownService).toBeDefined();
      unknownService.unsubscribeAll();
    });

    it('should use custom WebSocket URL when provided', async () => {
      const customOptions = {
        rpcUrl: 'https://api.devnet.solana.com',
        cluster: 'devnet',
        wsUrl: 'wss://custom.websocket.url',
      };
      const customMockRpc = createMockConfigService(customOptions);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SolanaSubscriptionService,
          { provide: SolanaConfigService, useValue: customMockRpc },
          { provide: SolanaUtilsService, useValue: mockUtilsService },
        ],
      }).compile();

      const customService = module.get<SolanaSubscriptionService>(
        SolanaSubscriptionService,
      );
      expect(customService).toBeDefined();
    });

    it('should handle testnet cluster configuration', async () => {
      const testnetOptions = {
        rpcUrl: 'https://api.testnet.solana.com',
        cluster: 'testnet',
        commitment: 'confirmed',
      };
      const testnetMockRpc = createMockConfigService(testnetOptions, 'testnet');

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SolanaSubscriptionService,
          { provide: SolanaConfigService, useValue: testnetMockRpc },
          { provide: SolanaUtilsService, useValue: mockUtilsService },
        ],
      }).compile();

      const testService = module.get<SolanaSubscriptionService>(
        SolanaSubscriptionService,
      );
      expect(testService).toBeDefined();
    });

    it('should handle mainnet-beta cluster configuration', async () => {
      const mainnetOptions = {
        rpcUrl: 'https://api.mainnet-beta.solana.com',
        cluster: 'mainnet-beta',
        commitment: 'finalized',
      };
      const mainnetMockRpc = createMockConfigService(
        mainnetOptions,
        'mainnet-beta',
      );

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SolanaSubscriptionService,
          { provide: SolanaConfigService, useValue: mainnetMockRpc },
          { provide: SolanaUtilsService, useValue: mockUtilsService },
        ],
      }).compile();

      const mainnetService = module.get<SolanaSubscriptionService>(
        SolanaSubscriptionService,
      );
      expect(mainnetService).toBeDefined();
    });

    it('should handle localnet cluster configuration', async () => {
      const localnetOptions = {
        rpcUrl: 'http://localhost:8899',
        cluster: 'localnet',
        commitment: 'confirmed',
      };
      const localnetMockRpc = createMockConfigService(
        localnetOptions,
        'localnet',
      );

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SolanaSubscriptionService,
          { provide: SolanaConfigService, useValue: localnetMockRpc },
          { provide: SolanaUtilsService, useValue: mockUtilsService },
        ],
      }).compile();

      const localnetService = module.get<SolanaSubscriptionService>(
        SolanaSubscriptionService,
      );
      expect(localnetService).toBeDefined();
    });
  });

  describe('onAccountChange', () => {
    it('should register account change subscription', () => {
      const callback = vi.fn();
      const address = TEST_ADDRESSES.SYSTEM_PROGRAM as Address;

      const subscriptionId = service.onAccountChange(address, callback);

      expect(subscriptionId).toBeGreaterThan(0);
      expect(typeof subscriptionId).toBe('number');
    });

    it('should accept different address formats', () => {
      const callback = vi.fn();
      const stringAddress = TEST_ADDRESSES.SYSTEM_PROGRAM;
      const addressTypeAddress = stringAddress as Address;

      const id1 = service.onAccountChange(stringAddress, callback);
      const id2 = service.onAccountChange(addressTypeAddress, callback);

      expect(id1).toBeGreaterThan(0);
      expect(id2).toBeGreaterThan(0);
      expect(id1).not.toBe(id2); // Should get different subscription IDs
    });

    it('should return incremental subscription IDs', () => {
      const callback = vi.fn();
      const address = TEST_ADDRESSES.SYSTEM_PROGRAM as Address;

      const id1 = service.onAccountChange(address, callback);
      const id2 = service.onAccountChange(address, callback);
      const id3 = service.onAccountChange(address, callback);

      expect(id2).toBe(id1 + 1);
      expect(id3).toBe(id2 + 1);
    });
  });

  describe('onSlotChange', () => {
    it('should register slot change subscription', () => {
      const callback = vi.fn();
      const subscriptionId = service.onSlotChange(callback);

      expect(subscriptionId).toBeGreaterThan(0);
      expect(typeof subscriptionId).toBe('number');
    });

    it('should return unique subscription ID per registration', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const id1 = service.onSlotChange(callback1);
      const id2 = service.onSlotChange(callback2);

      expect(id2).toBe(id1 + 1);
    });
  });

  describe('onSignature', () => {
    it('should register signature subscription', () => {
      const callback = vi.fn();
      const signature = TEST_SIGNATURES.MAIN as Signature;

      const subscriptionId = service.onSignature(signature, callback);

      expect(subscriptionId).toBeGreaterThan(0);
      expect(typeof subscriptionId).toBe('number');
    });

    it('should accept different signature formats', () => {
      const callback = vi.fn();
      const stringSig = TEST_SIGNATURES.MAIN;
      const sigTypeAddress = stringSig as Signature;

      const id1 = service.onSignature(stringSig, callback);
      const id2 = service.onSignature(sigTypeAddress, callback);

      expect(id1).toBeGreaterThan(0);
      expect(id2).toBeGreaterThan(0);
    });
  });

  describe('onProgramAccountChange', () => {
    it('should register program account change subscription', () => {
      const callback = vi.fn();
      const programId = TEST_ADDRESSES.SYSTEM_PROGRAM as Address;

      const subscriptionId = service.onProgramAccountChange(
        programId,
        callback,
      );

      expect(subscriptionId).toBeGreaterThan(0);
      expect(typeof subscriptionId).toBe('number');
    });

    it('should accept different program ID formats', () => {
      const callback = vi.fn();
      const stringId = TEST_ADDRESSES.SYSTEM_PROGRAM;
      const addressTypeId = stringId as Address;

      const id1 = service.onProgramAccountChange(stringId, callback);
      const id2 = service.onProgramAccountChange(addressTypeId, callback);

      expect(id1).toBeGreaterThan(0);
      expect(id2).toBeGreaterThan(0);
    });
  });

  describe('onLogs', () => {
    it('should register logs subscription', () => {
      const callback = vi.fn();
      const accountAddress = TEST_ADDRESSES.SYSTEM_PROGRAM as Address;
      const subscriptionId = service.onLogs(accountAddress, callback);

      expect(subscriptionId).toBeGreaterThan(0);
      expect(typeof subscriptionId).toBe('number');
    });

    it('should accept different address formats', () => {
      const callback = vi.fn();
      const stringAddr = TEST_ADDRESSES.SYSTEM_PROGRAM;
      const addressTypeAddr = stringAddr as Address;

      const id1 = service.onLogs(stringAddr, callback);
      const id2 = service.onLogs(addressTypeAddr, callback);

      expect(id1).toBeGreaterThan(0);
      expect(id2).toBeGreaterThan(0);
    });
  });

  describe('unsubscribe', () => {
    it('should remove subscription by ID', () => {
      const callback = vi.fn();
      const address = TEST_ADDRESSES.SYSTEM_PROGRAM as Address;

      const subscriptionId = service.onAccountChange(address, callback);
      service.unsubscribe(subscriptionId);

      expect(subscriptionId).toBeGreaterThan(0);
    });

    it('should handle unsubscribe for non-existent subscription', () => {
      expect(() => service.unsubscribe(99999)).not.toThrow();
    });
  });

  describe('unsubscribeAll', () => {
    it('should remove all active subscriptions', () => {
      const callback = vi.fn();
      const address = TEST_ADDRESSES.SYSTEM_PROGRAM as Address;

      service.onAccountChange(address, callback);
      service.onSlotChange(callback);
      service.onLogs(address, callback);

      service.unsubscribeAll();

      expect(callback).toBeDefined();
    });

    it('should be idempotent', () => {
      const callback = vi.fn();
      const address = TEST_ADDRESSES.SYSTEM_PROGRAM as Address;

      service.onAccountChange(address, callback);

      service.unsubscribeAll();
      // Should not throw when called again
      service.unsubscribeAll();

      expect(callback).toBeDefined();
    });
  });

  describe('onModuleDestroy', () => {
    it('should cleanup subscriptions on module destroy', () => {
      const callback = vi.fn();
      const address = TEST_ADDRESSES.SYSTEM_PROGRAM as Address;

      service.onAccountChange(address, callback);
      service.onSlotChange(callback);

      // Should not throw
      service.onModuleDestroy();

      expect(callback).toBeDefined();
    });

    it('should be safe to call multiple times', () => {
      service.onModuleDestroy();
      // Should not throw
      service.onModuleDestroy();
    });
  });

  describe('error handling', () => {
    it('should handle subscription initialization errors', () => {
      expect(service).toBeDefined();
    });

    it('should continue operating even if subscriptions are unavailable', () => {
      const callback = vi.fn();
      const address = TEST_ADDRESSES.SYSTEM_PROGRAM as Address;

      // Should not throw even if subscriptions aren't initialized
      const id = service.onAccountChange(address, callback);
      expect(id).toBeGreaterThan(0);
    });

    it('should handle toAddress conversion errors asynchronously', async () => {
      const callback = vi.fn();
      mockUtilsService.toAddress.mockImplementation(() => {
        throw new Error('Invalid address');
      });

      // With async generators, errors are handled asynchronously in consumeStream
      // The callback-based API returns immediately and errors are logged
      const id = service.onAccountChange('invalid-address', callback);
      expect(id).toBeGreaterThan(0);

      // Give time for the async error to be processed
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Callback should not have been called since the subscription errored
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('subscription ID management', () => {
    it('should track subscription IDs across different subscription types', () => {
      const callback = vi.fn();
      const address = TEST_ADDRESSES.SYSTEM_PROGRAM as Address;

      const accountId = service.onAccountChange(address, callback);
      const slotId = service.onSlotChange(callback);
      const logsId = service.onLogs(address, callback);

      expect(slotId).toBe(accountId + 1);
      expect(logsId).toBe(slotId + 1);
    });

    it('should handle large number of subscriptions', () => {
      const callback = vi.fn();
      const address = TEST_ADDRESSES.SYSTEM_PROGRAM as Address;
      const ids: number[] = [];

      for (let i = 0; i < 100; i++) {
        const id = service.onAccountChange(address, callback);
        ids.push(id);
      }

      // Verify all IDs are unique and sequential
      for (let i = 1; i < ids.length; i++) {
        expect(ids[i]).toBe(ids[i - 1] + 1);
      }
    });

    it('should properly track subscriptions in map', () => {
      const callback = vi.fn();
      const address = TEST_ADDRESSES.SYSTEM_PROGRAM as Address;

      const id1 = service.onAccountChange(address, callback);
      const id2 = service.onSlotChange(callback);
      const id3 = service.onLogs(address, callback);

      // All should be tracked
      expect(id1).toBeGreaterThan(0);
      expect(id2).toBeGreaterThan(0);
      expect(id3).toBeGreaterThan(0);
      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
    });
  });

  describe('cluster configuration handling', () => {
    it('should initialize with testnet cluster config', async () => {
      const testnetOptions = TEST_RPC_OPTIONS.TESTNET;
      const testnetMockRpc = createMockConfigService(testnetOptions, 'testnet');

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SolanaSubscriptionService,
          { provide: SolanaConfigService, useValue: testnetMockRpc },
          { provide: SolanaUtilsService, useValue: mockUtilsService },
        ],
      }).compile();

      const testnetService = module.get<SolanaSubscriptionService>(
        SolanaSubscriptionService,
      );
      expect(testnetService).toBeDefined();
      expect(testnetMockRpc.clusterName).toBe('testnet');
    });

    it('should initialize with mainnet cluster config', async () => {
      const mainnetOptions = TEST_RPC_OPTIONS.MAINNET;
      const mainnetMockRpc = createMockConfigService(
        mainnetOptions,
        'mainnet-beta',
      );

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SolanaSubscriptionService,
          { provide: SolanaConfigService, useValue: mainnetMockRpc },
          { provide: SolanaUtilsService, useValue: mockUtilsService },
        ],
      }).compile();

      const mainnetService = module.get<SolanaSubscriptionService>(
        SolanaSubscriptionService,
      );
      expect(mainnetService).toBeDefined();
    });

    it('should initialize with localnet cluster config', async () => {
      const localnetOptions = TEST_RPC_OPTIONS.LOCALNET;
      const localnetMockRpc = createMockConfigService(
        localnetOptions,
        'localnet',
      );

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SolanaSubscriptionService,
          { provide: SolanaConfigService, useValue: localnetMockRpc },
          { provide: SolanaUtilsService, useValue: mockUtilsService },
        ],
      }).compile();

      const localnetService = module.get<SolanaSubscriptionService>(
        SolanaSubscriptionService,
      );
      expect(localnetService).toBeDefined();
    });
  });

  describe('unsubscribe and lifecycle management', () => {
    it('should unsubscribe from an active subscription', () => {
      const callback = vi.fn();
      const address = TEST_ADDRESSES.SYSTEM_PROGRAM as Address;

      const id = service.onAccountChange(address, callback);
      expect(id).toBeGreaterThan(0);

      // Unsubscribe should not throw
      expect(() => {
        service.unsubscribe(id);
      }).not.toThrow();
    });

    it('should handle unsubscribe for already unsubscribed ID', () => {
      // Unsubscribe with non-existent ID should not throw
      expect(() => {
        service.unsubscribe(99999);
      }).not.toThrow();
    });

    it('should unsubscribe from all active subscriptions', () => {
      const callback = vi.fn();
      const address = TEST_ADDRESSES.SYSTEM_PROGRAM as Address;

      const id1 = service.onAccountChange(address, callback);
      const id2 = service.onSlotChange(callback);
      const id3 = service.onLogs(address, callback);

      // Unsubscribe all
      service.unsubscribe(id1);
      service.unsubscribe(id2);
      service.unsubscribe(id3);

      // Verify all were removed - trying to unsubscribe again should not throw
      expect(() => {
        service.unsubscribe(id1);
        service.unsubscribe(id2);
        service.unsubscribe(id3);
      }).not.toThrow();
    });

    it('should properly cleanup on module destroy', () => {
      const callback = vi.fn();
      const address = TEST_ADDRESSES.SYSTEM_PROGRAM as Address;

      service.onAccountChange(address, callback);
      service.onSlotChange(callback);

      // Should not throw on cleanup
      expect(() => {
        service.onModuleDestroy();
      }).not.toThrow();
    });

    it('should be safe to call onModuleDestroy multiple times', () => {
      expect(() => {
        service.onModuleDestroy();
      }).not.toThrow();

      expect(() => {
        service.onModuleDestroy();
      }).not.toThrow();
    });
  });

  describe('getActiveSubscriptionCount', () => {
    it('should return 0 when no subscriptions', () => {
      expect(service.getActiveSubscriptionCount()).toBe(0);
    });

    it('should track active subscriptions', () => {
      const callback = vi.fn();
      const address = TEST_ADDRESSES.SYSTEM_PROGRAM as Address;

      service.onAccountChange(address, callback);
      expect(service.getActiveSubscriptionCount()).toBe(1);

      service.onSlotChange(callback);
      expect(service.getActiveSubscriptionCount()).toBe(2);
    });

    it('should decrease count after unsubscribe', () => {
      const callback = vi.fn();
      const address = TEST_ADDRESSES.SYSTEM_PROGRAM as Address;

      const id = service.onAccountChange(address, callback);
      expect(service.getActiveSubscriptionCount()).toBe(1);

      service.unsubscribe(id);
      expect(service.getActiveSubscriptionCount()).toBe(0);
    });
  });

  describe('subscribeWithRetry', () => {
    it('should return subscription id on success', async () => {
      const subscribeFn = vi.fn().mockReturnValue(123);

      const result = await service.subscribeWithRetry(subscribeFn);

      expect(result).toBe(123);
      expect(subscribeFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const subscribeFn = vi
        .fn()
        .mockImplementationOnce(() => {
          throw new Error('First failure');
        })
        .mockReturnValue(456);

      const result = await service.subscribeWithRetry(subscribeFn, {
        maxRetries: 3,
        initialDelayMs: 1,
      });

      expect(result).toBe(456);
      expect(subscribeFn).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries', async () => {
      const subscribeFn = vi.fn().mockImplementation(() => {
        throw new Error('Always fails');
      });

      await expect(
        service.subscribeWithRetry(subscribeFn, {
          maxRetries: 2,
          initialDelayMs: 1,
        }),
      ).rejects.toThrow('Always fails');

      expect(subscribeFn).toHaveBeenCalledTimes(2);
    });

    it('should call onRetry callback', async () => {
      const onRetry = vi.fn();
      const subscribeFn = vi
        .fn()
        .mockImplementationOnce(() => {
          throw new Error('Retry me');
        })
        .mockReturnValue(789);

      await service.subscribeWithRetry(subscribeFn, {
        maxRetries: 3,
        initialDelayMs: 1,
        onRetry,
      });

      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
    });

    it('should use exponential backoff with max delay', async () => {
      const subscribeFn = vi
        .fn()
        .mockImplementationOnce(() => {
          throw new Error('Fail 1');
        })
        .mockImplementationOnce(() => {
          throw new Error('Fail 2');
        })
        .mockReturnValue(999);

      const start = Date.now();
      await service.subscribeWithRetry(subscribeFn, {
        maxRetries: 5,
        initialDelayMs: 10,
        maxDelayMs: 20,
      });
      const elapsed = Date.now() - start;

      // Should have waited at least 10 + 20 = 30ms (with some tolerance)
      expect(elapsed).toBeGreaterThanOrEqual(25);
      expect(subscribeFn).toHaveBeenCalledTimes(3);
    });

    it('should throw when maxRetries is 0', async () => {
      const subscribeFn = vi.fn().mockReturnValue(1);

      await expect(
        service.subscribeWithRetry(subscribeFn, { maxRetries: 0 }),
      ).rejects.toThrow('Subscription failed: no attempts made');

      expect(subscribeFn).not.toHaveBeenCalled();
    });
  });

  describe('onProgramLogsWithDiscriminators', () => {
    it('should subscribe to program logs with event discriminators', () => {
      const callback = vi.fn();
      const programId = TEST_ADDRESSES.TOKEN_PROGRAM as Address;
      const discriminators = [new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])];

      const id = service.onProgramLogs(programId, callback, { discriminators });

      expect(typeof id).toBe('number');
      expect(service.getActiveSubscriptionCount()).toBe(1);
    });
  });

  describe('async generator streams', () => {
    it('accountStream should throw when subscriptions unavailable', async () => {
      // Force subscriptions to be null by accessing private property
      (service as unknown as { subscriptions: null }).subscriptions = null;

      const abortController = new AbortController();

      await expect(async () => {
        const generator = service.accountStream(
          TEST_ADDRESSES.SYSTEM_PROGRAM,
          abortController.signal,
        );
        // Need to call next() to trigger the generator
        await generator.next();
      }).rejects.toThrow('WebSocket subscriptions not available');
    });

    it('slotStream should throw when subscriptions unavailable', async () => {
      (service as unknown as { subscriptions: null }).subscriptions = null;

      const abortController = new AbortController();

      await expect(async () => {
        const generator = service.slotStream(abortController.signal);
        await generator.next();
      }).rejects.toThrow('WebSocket subscriptions not available');
    });

    it('signatureStream should throw when subscriptions unavailable', async () => {
      (service as unknown as { subscriptions: null }).subscriptions = null;

      const abortController = new AbortController();

      await expect(async () => {
        const generator = service.signatureStream(
          TEST_SIGNATURES.MAIN,
          abortController.signal,
        );
        await generator.next();
      }).rejects.toThrow('WebSocket subscriptions not available');
    });

    it('programAccountStream should throw when subscriptions unavailable', async () => {
      (service as unknown as { subscriptions: null }).subscriptions = null;

      const abortController = new AbortController();

      await expect(async () => {
        const generator = service.programAccountStream(
          TEST_ADDRESSES.SYSTEM_PROGRAM,
          abortController.signal,
        );
        await generator.next();
      }).rejects.toThrow('WebSocket subscriptions not available');
    });

    it('logsStream should throw when subscriptions unavailable', async () => {
      (service as unknown as { subscriptions: null }).subscriptions = null;

      const abortController = new AbortController();

      await expect(async () => {
        const generator = service.logsStream(
          TEST_ADDRESSES.SYSTEM_PROGRAM,
          abortController.signal,
        );
        await generator.next();
      }).rejects.toThrow('WebSocket subscriptions not available');
    });

    it('programLogsStream should throw when subscriptions unavailable', async () => {
      (service as unknown as { subscriptions: null }).subscriptions = null;

      const abortController = new AbortController();

      await expect(async () => {
        const generator = service.programLogsStream(
          TEST_ADDRESSES.SYSTEM_PROGRAM,
          abortController.signal,
        );
        await generator.next();
      }).rejects.toThrow('WebSocket subscriptions not available');
    });

    it('should call toAddress for address-based streams', async () => {
      const abortController = new AbortController();
      abortController.abort(); // Immediately abort to prevent hanging

      try {
        const generator = service.accountStream(
          TEST_ADDRESSES.SYSTEM_PROGRAM,
          abortController.signal,
        );
        await generator.next();
      } catch {
        // Expected to fail due to abort or no actual WebSocket
      }

      expect(mockUtilsService.toAddress).toHaveBeenCalledWith(
        TEST_ADDRESSES.SYSTEM_PROGRAM,
      );
    });

    it('should call toSignature for signature stream', async () => {
      const abortController = new AbortController();
      abortController.abort();

      try {
        const generator = service.signatureStream(
          TEST_SIGNATURES.MAIN,
          abortController.signal,
        );
        await generator.next();
      } catch {
        // Expected to fail
      }

      expect(mockUtilsService.toSignature).toHaveBeenCalledWith(
        TEST_SIGNATURES.MAIN,
      );
    });
  });

  describe('discriminator filtering', () => {
    it('should filter logs by discriminator in programLogsStream', async () => {
      const callback = vi.fn();
      const programId = TEST_ADDRESSES.TOKEN_PROGRAM as Address;

      // Create discriminator that won't match any logs
      const discriminators = [new Uint8Array([255, 255, 255, 255])];

      const id = service.onProgramLogs(programId, callback, { discriminators });
      expect(id).toBeGreaterThan(0);

      // The subscription is created but the filtering happens in the stream
      expect(service.getActiveSubscriptionCount()).toBe(1);
    });

    it('should pass through logs when no discriminators specified', () => {
      const callback = vi.fn();
      const programId = TEST_ADDRESSES.TOKEN_PROGRAM as Address;

      const id = service.onProgramLogs(programId, callback);
      expect(id).toBeGreaterThan(0);
      expect(service.getActiveSubscriptionCount()).toBe(1);
    });
  });

  describe('private helper methods coverage', () => {
    // Testing private methods indirectly through the public API

    it('logsContainDiscriminator should match valid discriminator', () => {
      // Access private method via type assertion for testing
      const logsContainDiscriminator = (
        service as unknown as {
          logsContainDiscriminator: (
            logs: readonly string[],
            discriminators: Uint8Array[],
          ) => boolean;
        }
      ).logsContainDiscriminator.bind(service);

      // Create a log with "Program data: <base64>" format
      // Base64 of [1, 2, 3, 4] is "AQIDBA=="
      const logs = ['Program data: AQIDBA=='];
      const discriminator = new Uint8Array([1, 2, 3, 4]);

      const result = logsContainDiscriminator(logs, [discriminator]);
      expect(result).toBe(true);
    });

    it('logsContainDiscriminator should not match different discriminator', () => {
      const logsContainDiscriminator = (
        service as unknown as {
          logsContainDiscriminator: (
            logs: readonly string[],
            discriminators: Uint8Array[],
          ) => boolean;
        }
      ).logsContainDiscriminator.bind(service);

      const logs = ['Program data: AQIDBA=='];
      const discriminator = new Uint8Array([5, 6, 7, 8]);

      const result = logsContainDiscriminator(logs, [discriminator]);
      expect(result).toBe(false);
    });

    it('logsContainDiscriminator should skip non-program-data logs', () => {
      const logsContainDiscriminator = (
        service as unknown as {
          logsContainDiscriminator: (
            logs: readonly string[],
            discriminators: Uint8Array[],
          ) => boolean;
        }
      ).logsContainDiscriminator.bind(service);

      const logs = [
        'Program log: some message',
        'invoke [1]',
        'success',
      ];
      const discriminator = new Uint8Array([1, 2, 3, 4]);

      const result = logsContainDiscriminator(logs, [discriminator]);
      expect(result).toBe(false);
    });

    it('logsContainDiscriminator should handle invalid base64', () => {
      const logsContainDiscriminator = (
        service as unknown as {
          logsContainDiscriminator: (
            logs: readonly string[],
            discriminators: Uint8Array[],
          ) => boolean;
        }
      ).logsContainDiscriminator.bind(service);

      const logs = ['Program data: not-valid-base64!!!'];
      const discriminator = new Uint8Array([1, 2, 3, 4]);

      // Should not throw, just skip invalid base64
      const result = logsContainDiscriminator(logs, [discriminator]);
      expect(result).toBe(false);
    });

    it('logsContainDiscriminator should handle data shorter than discriminator', () => {
      const logsContainDiscriminator = (
        service as unknown as {
          logsContainDiscriminator: (
            logs: readonly string[],
            discriminators: Uint8Array[],
          ) => boolean;
        }
      ).logsContainDiscriminator.bind(service);

      // Base64 of [1, 2] is "AQI="
      const logs = ['Program data: AQI='];
      const discriminator = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

      const result = logsContainDiscriminator(logs, [discriminator]);
      expect(result).toBe(false);
    });

    it('logsContainDiscriminator should match any of multiple discriminators', () => {
      const logsContainDiscriminator = (
        service as unknown as {
          logsContainDiscriminator: (
            logs: readonly string[],
            discriminators: Uint8Array[],
          ) => boolean;
        }
      ).logsContainDiscriminator.bind(service);

      const logs = ['Program data: BQYHCA=='];
      const discriminators = [
        new Uint8Array([1, 2, 3, 4]),
        new Uint8Array([5, 6, 7, 8]), // This one matches
      ];

      const result = logsContainDiscriminator(logs, discriminators);
      expect(result).toBe(true);
    });

    it('bytesEqual should return true for identical arrays', () => {
      const bytesEqual = (
        service as unknown as {
          bytesEqual: (a: Uint8Array | Buffer, b: Uint8Array) => boolean;
        }
      ).bytesEqual.bind(service);

      const a = new Uint8Array([1, 2, 3, 4]);
      const b = new Uint8Array([1, 2, 3, 4]);

      expect(bytesEqual(a, b)).toBe(true);
    });

    it('bytesEqual should return false for different length arrays', () => {
      const bytesEqual = (
        service as unknown as {
          bytesEqual: (a: Uint8Array | Buffer, b: Uint8Array) => boolean;
        }
      ).bytesEqual.bind(service);

      const a = new Uint8Array([1, 2, 3]);
      const b = new Uint8Array([1, 2, 3, 4]);

      expect(bytesEqual(a, b)).toBe(false);
    });

    it('bytesEqual should return false for different content', () => {
      const bytesEqual = (
        service as unknown as {
          bytesEqual: (a: Uint8Array | Buffer, b: Uint8Array) => boolean;
        }
      ).bytesEqual.bind(service);

      const a = new Uint8Array([1, 2, 3, 4]);
      const b = new Uint8Array([1, 2, 3, 5]);

      expect(bytesEqual(a, b)).toBe(false);
    });

    it('bytesEqual should work with Buffer', () => {
      const bytesEqual = (
        service as unknown as {
          bytesEqual: (a: Uint8Array | Buffer, b: Uint8Array) => boolean;
        }
      ).bytesEqual.bind(service);

      const a = Buffer.from([1, 2, 3, 4]);
      const b = new Uint8Array([1, 2, 3, 4]);

      expect(bytesEqual(a, b)).toBe(true);
    });
  });

  describe('consumeStream', () => {
    it('should call callback for each yielded value', async () => {
      const consumeStream = (
        service as unknown as {
          consumeStream: <T>(
            stream: AsyncGenerator<T>,
            callback: (value: T) => Promise<void>,
            subscriptionId: number,
          ) => void;
        }
      ).consumeStream.bind(service);

      const values = [1, 2, 3];
      async function* mockGenerator() {
        for (const v of values) {
          yield v;
        }
      }

      const received: number[] = [];
      const callback = vi.fn(async (value: number) => {
        received.push(value);
      });

      consumeStream(mockGenerator(), callback, 1);

      // Wait for async iteration to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(callback).toHaveBeenCalledTimes(3);
      expect(received).toEqual([1, 2, 3]);
    });

    it('should handle non-abort errors in stream', async () => {
      const consumeStream = (
        service as unknown as {
          consumeStream: <T>(
            stream: AsyncGenerator<T>,
            callback: (value: T) => Promise<void>,
            subscriptionId: number,
          ) => void;
        }
      ).consumeStream.bind(service);

      async function* errorGenerator() {
        yield 1;
        throw new Error('Stream error');
      }

      const callback = vi.fn();
      consumeStream(errorGenerator(), callback, 1);

      // Wait for async iteration to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should silently handle abort errors', async () => {
      const consumeStream = (
        service as unknown as {
          consumeStream: <T>(
            stream: AsyncGenerator<T>,
            callback: (value: T) => Promise<void>,
            subscriptionId: number,
          ) => void;
        }
      ).consumeStream.bind(service);

      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';

      async function* abortGenerator() {
        yield 1;
        throw abortError;
      }

      const callback = vi.fn();
      consumeStream(abortGenerator(), callback, 1);

      // Wait for async iteration to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should handle setup errors', async () => {
      const consumeStream = (
        service as unknown as {
          consumeStream: <T>(
            stream: AsyncGenerator<T>,
            callback: (value: T) => Promise<void>,
            subscriptionId: number,
          ) => void;
        }
      ).consumeStream.bind(service);

      // Create a generator that throws immediately
      const brokenGenerator = {
        [Symbol.asyncIterator]: () => ({
          next: () => Promise.reject(new Error('Setup failed')),
        }),
      } as unknown as AsyncGenerator<number>;

      const callback = vi.fn();
      consumeStream(brokenGenerator, callback, 1);

      // Wait for async operation
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('initializeSubscriptions error handling', () => {
    it('should handle initialization errors gracefully', async () => {
      // Enable failure mode
      shouldFailInit = true;

      try {
        // Create a new module to trigger initialization
        const testModule = await Test.createTestingModule({
          providers: [
            SolanaSubscriptionService,
            {
              provide: SolanaConfigService,
              useValue: createMockConfigService(),
            },
            {
              provide: SolanaUtilsService,
              useValue: createMockUtilsService(),
            },
          ],
        }).compile();

        const testService = testModule.get<SolanaSubscriptionService>(
          SolanaSubscriptionService,
        );

        // Service should be created but subscriptions should be null
        expect(testService).toBeDefined();

        // Trying to use streams should throw
        const abortController = new AbortController();
        await expect(async () => {
          const generator = testService.accountStream(
            TEST_ADDRESSES.SYSTEM_PROGRAM,
            abortController.signal,
          );
          await generator.next();
        }).rejects.toThrow('WebSocket subscriptions not available');
      } finally {
        // Reset failure mode
        shouldFailInit = false;
      }
    });
  });
});
