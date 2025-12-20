import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { type Address, getAddressEncoder, getAddressDecoder } from '@solana/kit';

import { SolanaAltService } from './solana-alt.service';
import { SolanaRpcService } from './solana-rpc.service';

describe('SolanaAltService', () => {
  let service: SolanaAltService;
  let mockRpcService: {
    rpc: {
      getAccountInfo: ReturnType<typeof vi.fn>;
    };
  };

  // Use real valid Solana addresses for testing
  const testAltAddress = '11111111111111111111111111111111' as Address;
  const testAddress1 =
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address;
  const testAddress2 =
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' as Address;

  // Create mock ALT account data
  const addressEncoder = getAddressEncoder();
  const addressDecoder = getAddressDecoder();

  type MockAltOptions = {
    addresses?: string[];
    deactivationSlot?: bigint | null;
    authority?: Uint8Array | null;
  };

  const createMockAltData = (options: MockAltOptions = {}) => {
    const { addresses = [], deactivationSlot = null, authority = null } = options;

    // Header: 56 bytes
    // Addresses: 32 bytes each
    const data = Buffer.alloc(56 + addresses.length * 32);

    // Type discriminator (4 bytes) = 1
    data.writeUint32LE(1, 0);

    // Deactivation slot = max u64 (active) or actual slot if deactivated
    if (deactivationSlot !== null) {
      data.writeBigUint64LE(deactivationSlot, 4);
    } else {
      data.writeBigUint64LE(BigInt('18446744073709551615'), 4);
    }

    // Last extended slot
    data.writeBigUint64LE(BigInt(100), 12);

    // Last extended slot start index
    data[20] = 0;

    // Authority (32 bytes at offset 22)
    if (authority && authority.length === 32) {
      Buffer.from(authority).copy(data, 22);
    }
    // If null, bytes 22-54 remain 0

    // Write addresses starting at byte 56
    addresses.forEach((addr, index) => {
      try {
        const bytes = addressEncoder.encode(addr as Address);
        if (bytes.length === 32) {
          Buffer.from(bytes).copy(data, 56 + index * 32);
        }
      } catch {
        // Skip invalid addresses in tests
      }
    });

    return data.toString('base64');
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockRpcService = {
      rpc: {
        getAccountInfo: vi.fn().mockReturnValue({
          send: vi.fn().mockResolvedValue({
            value: {
              data: [createMockAltData({}), 'base64'],
              owner: 'AddressLookupTab1e1111111111111111111111111',
              lamports: 1000000,
              executable: false,
              rentEpoch: 0,
            },
          }),
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolanaAltService,
        { provide: SolanaRpcService, useValue: mockRpcService },
      ],
    }).compile();

    service = module.get<SolanaAltService>(SolanaAltService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('fetchAlt', () => {
    it('should fetch ALT from chain', async () => {
      const alt = await service.fetchAlt(testAltAddress);

      expect(alt).toBeDefined();
      expect(alt.address).toBe(testAltAddress);
      expect(mockRpcService.rpc.getAccountInfo).toHaveBeenCalledWith(
        testAltAddress,
        { encoding: 'base64' },
      );
    });

    it('should throw if ALT not found', async () => {
      mockRpcService.rpc.getAccountInfo = vi.fn().mockReturnValue({
        send: vi.fn().mockResolvedValue({ value: null }),
      });

      await expect(service.fetchAlt(testAltAddress)).rejects.toThrow(
        `Address Lookup Table not found: ${testAltAddress}`,
      );
    });

    it('should accept string address', async () => {
      const alt = await service.fetchAlt(testAltAddress.toString());

      expect(alt).toBeDefined();
    });
  });

  describe('getAlt', () => {
    it('should cache ALT on first fetch', async () => {
      await service.getAlt(testAltAddress);
      await service.getAlt(testAltAddress);

      // Should only call RPC once due to caching
      expect(mockRpcService.rpc.getAccountInfo).toHaveBeenCalledTimes(1);
    });

    it('should respect TTL', async () => {
      // Get with very short TTL
      await service.getAlt(testAltAddress, 1);

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should fetch again after TTL
      await service.getAlt(testAltAddress, 1);

      expect(mockRpcService.rpc.getAccountInfo).toHaveBeenCalledTimes(2);
    });
  });

  describe('cache management', () => {
    it('should invalidate specific ALT cache', async () => {
      await service.getAlt(testAltAddress);

      service.invalidateCache(testAltAddress);

      await service.getAlt(testAltAddress);

      expect(mockRpcService.rpc.getAccountInfo).toHaveBeenCalledTimes(2);
    });

    it('should invalidate all caches', async () => {
      await service.getAlt(testAltAddress);

      service.invalidateCache();

      await service.getAlt(testAltAddress);

      expect(mockRpcService.rpc.getAccountInfo).toHaveBeenCalledTimes(2);
    });

    it('should return cache stats', async () => {
      await service.getAlt(testAltAddress);

      const stats = service.getCacheStats();

      expect(stats.size).toBe(1);
      expect(stats.entries.length).toBe(1);
      expect(stats.entries[0].address).toBe(testAltAddress);
    });

    it('should clean expired entries', async () => {
      // Add entry with immediate expiration
      await service.getAlt(testAltAddress, 1);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 10));

      const removed = service.cleanExpiredCache();

      expect(removed).toBe(1);
      expect(service.getCacheStats().size).toBe(0);
    });
  });

  describe('hasAddress', () => {
    it('should return true if address exists', async () => {
      // Need a valid base58 address for the mock
      const validAddr = addressDecoder.decode(new Uint8Array(32).fill(1));

      mockRpcService.rpc.getAccountInfo = vi.fn().mockReturnValue({
        send: vi.fn().mockResolvedValue({
          value: {
            data: [createMockAltData({ addresses: [validAddr] }), 'base64'],
            owner: 'AddressLookupTab1e1111111111111111111111111',
            lamports: 1000000,
            executable: false,
            rentEpoch: 0,
          },
        }),
      });

      const exists = await service.hasAddress(testAltAddress, validAddr);

      expect(exists).toBe(true);
    });

    it('should return false if address does not exist', async () => {
      const exists = await service.hasAddress(testAltAddress, testAddress1);

      expect(exists).toBe(false);
    });
  });

  describe('getAddressIndex', () => {
    it('should return index if found', async () => {
      const validAddr = addressDecoder.decode(new Uint8Array(32).fill(1));

      mockRpcService.rpc.getAccountInfo = vi.fn().mockReturnValue({
        send: vi.fn().mockResolvedValue({
          value: {
            data: [createMockAltData({ addresses: [validAddr] }), 'base64'],
            owner: 'AddressLookupTab1e1111111111111111111111111',
            lamports: 1000000,
            executable: false,
            rentEpoch: 0,
          },
        }),
      });

      const index = await service.getAddressIndex(testAltAddress, validAddr);

      expect(index).toBe(0);
    });

    it('should return -1 if not found', async () => {
      const index = await service.getAddressIndex(testAltAddress, testAddress1);

      expect(index).toBe(-1);
    });
  });

  describe('buildExtendInstruction', () => {
    it('should build extend instruction', () => {
      // Use valid Solana addresses
      const authority = testAddress1;
      const payer = testAddress2;

      const instruction = service.buildExtendInstruction(
        testAltAddress,
        authority,
        payer,
        [testAddress1, testAddress2],
      );

      expect(instruction).toBeDefined();
      expect(instruction.programAddress).toBe(
        'AddressLookupTab1e1111111111111111111111111',
      );
      expect(instruction.accounts).toHaveLength(3);
      expect(instruction.data).toBeInstanceOf(Uint8Array);
    });

    it('should accept string addresses', () => {
      const instruction = service.buildExtendInstruction(
        testAltAddress.toString(),
        testAddress1.toString(),
        testAddress2.toString(),
        [testAddress1.toString()],
      );

      expect(instruction).toBeDefined();
    });
  });

  describe('parseAltData edge cases', () => {
    it('should parse deactivated ALT (non-max deactivation slot)', async () => {
      // Create ALT with a specific deactivation slot (deactivated)
      mockRpcService.rpc.getAccountInfo = vi.fn().mockReturnValue({
        send: vi.fn().mockResolvedValue({
          value: {
            data: [createMockAltData({ deactivationSlot: BigInt(12345) }), 'base64'],
            owner: 'AddressLookupTab1e1111111111111111111111111',
            lamports: 1000000,
            executable: false,
            rentEpoch: 0,
          },
        }),
      });

      const alt = await service.fetchAlt(testAltAddress);

      expect(alt.deactivationSlot).toBe(BigInt(12345));
    });

    it('should parse ALT with authority', async () => {
      // Create authority bytes (non-zero)
      const authorityBytes = new Uint8Array(32).fill(1);

      mockRpcService.rpc.getAccountInfo = vi.fn().mockReturnValue({
        send: vi.fn().mockResolvedValue({
          value: {
            data: [createMockAltData({ authority: authorityBytes }), 'base64'],
            owner: 'AddressLookupTab1e1111111111111111111111111',
            lamports: 1000000,
            executable: false,
            rentEpoch: 0,
          },
        }),
      });

      const alt = await service.fetchAlt(testAltAddress);

      expect(alt.authority).not.toBeNull();
    });

    it('should parse ALT with no authority (all zeros)', async () => {
      mockRpcService.rpc.getAccountInfo = vi.fn().mockReturnValue({
        send: vi.fn().mockResolvedValue({
          value: {
            data: [createMockAltData({}), 'base64'],
            owner: 'AddressLookupTab1e1111111111111111111111111',
            lamports: 1000000,
            executable: false,
            rentEpoch: 0,
          },
        }),
      });

      const alt = await service.fetchAlt(testAltAddress);

      expect(alt.authority).toBeNull();
    });

    it('should handle ALT with multiple addresses', async () => {
      const addr1 = addressDecoder.decode(new Uint8Array(32).fill(1));
      const addr2 = addressDecoder.decode(new Uint8Array(32).fill(2));

      mockRpcService.rpc.getAccountInfo = vi.fn().mockReturnValue({
        send: vi.fn().mockResolvedValue({
          value: {
            data: [createMockAltData({ addresses: [addr1, addr2] }), 'base64'],
            owner: 'AddressLookupTab1e1111111111111111111111111',
            lamports: 1000000,
            executable: false,
            rentEpoch: 0,
          },
        }),
      });

      const alt = await service.fetchAlt(testAltAddress);

      expect(alt.addresses).toHaveLength(2);
    });
  });
});
