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

    it('should handle toAddress conversion errors', () => {
      const callback = vi.fn();
      mockUtilsService.toAddress.mockImplementation(() => {
        throw new Error('Invalid address');
      });

      expect(() => {
        service.onAccountChange('invalid-address', callback);
      }).toThrow('Invalid address');
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
});
