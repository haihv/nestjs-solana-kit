import { vi, type Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { SolanaAccountService } from './solana-account.service';
import { SolanaRpcService } from './solana-rpc.service';
import { SolanaUtilsService } from './solana-utils.service';
import type { Address } from '@solana/kit';
import { createPendingResponse } from '../__tests__/test-fixtures';

interface MockRpc {
  getBalance: Mock;
  getAccountInfo: Mock;
  getMultipleAccounts: Mock;
  getTokenAccountsByOwner: Mock;
  getMinimumBalanceForRentExemption: Mock;
}

describe('SolanaAccountService', () => {
  let service: SolanaAccountService;
  let mockRpcService: { rpc: MockRpc; clusterName: string; options: any };
  let mockRpc: MockRpc;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create a fully mocked RPC object
    mockRpc = {
      getBalance: vi
        .fn()
        .mockReturnValue(createPendingResponse({ value: BigInt(1000000000) })),
      getAccountInfo: vi.fn().mockReturnValue(
        createPendingResponse({
          value: {
            address: '11111111111111111111111111111111' as Address,
            lamports: BigInt(1000000000),
            owner: '11111111111111111111111111111111' as Address,
            executable: false,
            data: 'dGVzdGRhdGE=',
          },
        }),
      ),
      getMultipleAccounts: vi.fn().mockReturnValue(
        createPendingResponse({
          value: [
            {
              address: '11111111111111111111111111111111' as Address,
              lamports: BigInt(1000000000),
              owner: '11111111111111111111111111111111' as Address,
              executable: false,
              data: 'dGVzdGRhdGEx',
            },
            {
              address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address,
              lamports: BigInt(2000000000),
              owner: '11111111111111111111111111111111' as Address,
              executable: false,
              data: 'dGVzdGRhdGEy',
            },
          ],
        }),
      ),
      getTokenAccountsByOwner: vi.fn().mockReturnValue(
        createPendingResponse({
          value: [
            {
              address:
                'EPjFWdd4ReWfJY3LAX1dGjTvJ4p6X2L7tkjcBCUYfX1e' as Address,
              lamports: BigInt(2039280),
              owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address,
              executable: false,
              data: 'parsed_data',
            },
          ],
        }),
      ),
      getMinimumBalanceForRentExemption: vi
        .fn()
        .mockReturnValue(createPendingResponse(BigInt(890880))),
    };

    // Create a mock RPC service that returns our mock RPC
    mockRpcService = {
      get rpc() {
        return mockRpc;
      },
      get clusterName() {
        return 'devnet';
      },
      get options() {
        return {
          rpcUrl: 'https://api.devnet.solana.com',
          cluster: 'devnet',
          commitment: 'confirmed',
        };
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolanaAccountService,
        SolanaUtilsService,
        {
          provide: SolanaRpcService,
          useValue: mockRpcService,
        },
      ],
    }).compile();

    service = module.get<SolanaAccountService>(SolanaAccountService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getBalance', () => {
    it('should return balance in lamports', async () => {
      mockRpc.getBalance.mockReturnValue(
        createPendingResponse({ value: BigInt(5000000000) }),
      );

      const balance = await service.getBalance(
        '11111111111111111111111111111111',
      );
      expect(balance).toBe(BigInt(5000000000));
    });

    it('should accept Address type parameter', async () => {
      const addr = '11111111111111111111111111111111' as Address;
      mockRpc.getBalance.mockReturnValue(
        createPendingResponse({ value: BigInt(1000000000) }),
      );

      const balance = await service.getBalance(addr);
      expect(balance).toBe(BigInt(1000000000));
    });

    it('should handle RPC errors', async () => {
      mockRpc.getBalance.mockReturnValue({
        send: vi.fn().mockRejectedValue(new Error('RPC error')),
      });

      await expect(
        service.getBalance('11111111111111111111111111111111'),
      ).rejects.toThrow('RPC error');
    });
  });

  describe('getBalanceInSol', () => {
    it('should return balance in SOL', async () => {
      mockRpc.getBalance.mockReturnValue(
        createPendingResponse({ value: BigInt(2000000000) }),
      );

      const balance = await service.getBalanceInSol(
        '11111111111111111111111111111111',
      );
      expect(balance).toBe(2);
    });

    it('should convert lamports to SOL correctly', async () => {
      mockRpc.getBalance.mockReturnValue(
        createPendingResponse({ value: BigInt(500000000) }),
      );

      const balance = await service.getBalanceInSol(
        '11111111111111111111111111111111',
      );
      expect(balance).toBe(0.5);
    });

    it('should handle zero balance', async () => {
      mockRpc.getBalance.mockReturnValue(
        createPendingResponse({ value: BigInt(0) }),
      );

      const balance = await service.getBalanceInSol(
        '11111111111111111111111111111111',
      );
      expect(balance).toBe(0);
    });
  });

  describe('getAccountInfo', () => {
    it('should return account info', async () => {
      const accountInfo = {
        value: {
          address: '11111111111111111111111111111111' as Address,
          lamports: BigInt(1000000000),
          owner: '11111111111111111111111111111111' as Address,
          executable: false,
          data: 'dGVzdGRhdGE=',
        },
      };

      mockRpc.getAccountInfo.mockReturnValue(
        createPendingResponse(accountInfo),
      );

      const result = await service.getAccountInfo(
        '11111111111111111111111111111111',
      );
      expect(result).toBeDefined();
      expect(result?.lamports).toBe(BigInt(1000000000));
      expect(result?.executable).toBe(false);
    });

    it('should return null for non-existent account', async () => {
      mockRpc.getAccountInfo.mockReturnValue(
        createPendingResponse({ value: null }),
      );

      const result = await service.getAccountInfo(
        '11111111111111111111111111111112',
      );
      expect(result).toBeNull();
    });

    it('should handle RPC errors', async () => {
      mockRpc.getAccountInfo.mockReturnValue({
        send: vi.fn().mockRejectedValue(new Error('RPC error')),
      });

      await expect(
        service.getAccountInfo('11111111111111111111111111111111'),
      ).rejects.toThrow('RPC error');
    });
  });

  describe('getMultipleAccounts', () => {
    it('should return multiple accounts info', async () => {
      const accounts = [
        {
          address: '11111111111111111111111111111111' as Address,
          lamports: BigInt(1000000000),
          owner: '11111111111111111111111111111111' as Address,
          executable: false,
          data: 'dGVzdGRhdGEx',
        },
        {
          address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address,
          lamports: BigInt(2000000000),
          owner: '11111111111111111111111111111111' as Address,
          executable: false,
          data: 'dGVzdGRhdGEy',
        },
      ];

      mockRpc.getMultipleAccounts.mockReturnValue(
        createPendingResponse({ value: accounts }),
      );

      const result = await service.getMultipleAccounts([
        '11111111111111111111111111111111',
        'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
      ]);
      expect(result).toHaveLength(2);
      expect(result[0]?.lamports).toBe(BigInt(1000000000));
      expect(result[1]?.lamports).toBe(BigInt(2000000000));
    });

    it('should handle mixed existing and non-existing accounts', async () => {
      const accounts = [
        {
          address: '11111111111111111111111111111111' as Address,
          lamports: BigInt(1000000000),
          owner: '11111111111111111111111111111111' as Address,
          executable: false,
          data: 'dGVzdGRhdGE=',
        },
        null,
      ];

      mockRpc.getMultipleAccounts.mockReturnValue(
        createPendingResponse({ value: accounts }),
      );

      const result = await service.getMultipleAccounts([
        '11111111111111111111111111111111',
        '11111111111111111111111111111112',
      ]);
      expect(result).toHaveLength(2);
      expect(result[0]).toBeDefined();
      expect(result[1]).toBeNull();
    });

    it('should handle RPC errors', async () => {
      mockRpc.getMultipleAccounts.mockReturnValue({
        send: vi.fn().mockRejectedValue(new Error('RPC error')),
      });

      await expect(
        service.getMultipleAccounts(['11111111111111111111111111111111']),
      ).rejects.toThrow('RPC error');
    });
  });

  describe('getTokenAccounts', () => {
    it('should return token accounts', async () => {
      const tokenAccounts = [
        {
          address: 'EPjFWdd4ReWfJY3LAX1dGjTvJ4p6X2L7tkjcBCUYfX1e' as Address,
          lamports: BigInt(2039280),
          owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address,
          executable: false,
          data: 'parsed_data',
        },
      ];

      mockRpc.getTokenAccountsByOwner.mockReturnValue(
        createPendingResponse({ value: tokenAccounts }),
      );

      const result = await service.getTokenAccounts(
        '11111111111111111111111111111111',
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toBeDefined();
    });

    it('should filter by token mint when provided', async () => {
      const tokenAccounts = [
        {
          address: '44444444444444444444444444444444' as Address,
          lamports: BigInt(2039280),
          owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address,
          executable: false,
          data: 'parsed_data',
        },
      ];

      mockRpc.getTokenAccountsByOwner.mockReturnValue(
        createPendingResponse({ value: tokenAccounts }),
      );

      const result = await service.getTokenAccounts(
        '11111111111111111111111111111111',
        'EPjFWaJsv6DjsSuaT4jXfVfuE3axYR4MdNKWcqTPqe8t',
      );
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no token accounts found', async () => {
      mockRpc.getTokenAccountsByOwner.mockReturnValue(
        createPendingResponse({ value: [] }),
      );

      const result = await service.getTokenAccounts(
        '11111111111111111111111111111111',
      );
      expect(result).toHaveLength(0);
    });

    it('should handle RPC errors', async () => {
      mockRpc.getTokenAccountsByOwner.mockReturnValue({
        send: vi.fn().mockRejectedValue(new Error('RPC error')),
      });

      await expect(
        service.getTokenAccounts('11111111111111111111111111111111'),
      ).rejects.toThrow('RPC error');
    });
  });

  describe('accountExists', () => {
    it('should return true for existing account', async () => {
      const accountInfo = {
        value: {
          address: '11111111111111111111111111111111' as Address,
          lamports: BigInt(1000000000),
          owner: '11111111111111111111111111111111' as Address,
          executable: false,
          data: 'dGVzdGRhdGE=',
        },
      };

      mockRpc.getAccountInfo.mockReturnValue(
        createPendingResponse(accountInfo),
      );

      const exists = await service.accountExists(
        '11111111111111111111111111111111',
      );
      expect(exists).toBe(true);
    });

    it('should return false for non-existent account', async () => {
      mockRpc.getAccountInfo.mockReturnValue(
        createPendingResponse({ value: null }),
      );

      const exists = await service.accountExists(
        '11111111111111111111111111111112',
      );
      expect(exists).toBe(false);
    });

    it('should return false on RPC error', async () => {
      mockRpc.getAccountInfo.mockReturnValue({
        send: vi.fn().mockRejectedValue(new Error('RPC error')),
      });

      const exists = await service.accountExists(
        '11111111111111111111111111111111',
      );
      expect(exists).toBe(false);
    });
  });

  describe('getMinimumBalanceForRentExemption', () => {
    it('should return minimum balance for rent exemption', async () => {
      mockRpc.getMinimumBalanceForRentExemption.mockReturnValue(
        createPendingResponse(BigInt(890880)),
      );

      const balance = await service.getMinimumBalanceForRentExemption(
        BigInt(128),
      );
      expect(balance).toBe(BigInt(890880));
    });

    it('should calculate for different data lengths', async () => {
      mockRpc.getMinimumBalanceForRentExemption.mockReturnValue(
        createPendingResponse(BigInt(2853600)),
      );

      const balance = await service.getMinimumBalanceForRentExemption(
        BigInt(10000),
      );
      expect(balance).toBe(BigInt(2853600));
    });

    it('should handle zero data length', async () => {
      mockRpc.getMinimumBalanceForRentExemption.mockReturnValue(
        createPendingResponse(BigInt(890880)),
      );

      const balance = await service.getMinimumBalanceForRentExemption(
        BigInt(0),
      );
      expect(balance).toBe(BigInt(890880));
    });

    it('should handle RPC errors', async () => {
      mockRpc.getMinimumBalanceForRentExemption.mockReturnValue({
        send: vi.fn().mockRejectedValue(new Error('RPC error')),
      });

      await expect(
        service.getMinimumBalanceForRentExemption(BigInt(128)),
      ).rejects.toThrow('RPC error');
    });
  });

  describe('Branch coverage - Address type parameters', () => {
    it('getBalance should handle Address type input', async () => {
      const addr = '11111111111111111111111111111111' as Address;
      mockRpc.getBalance.mockReturnValue(
        createPendingResponse({ value: BigInt(1000000000) }),
      );

      const balance = await service.getBalance(addr);
      expect(balance).toBe(BigInt(1000000000));
      expect(mockRpc.getBalance).toHaveBeenCalled();
    });

    it('getAccountInfo should handle Address type input', async () => {
      const addr = '11111111111111111111111111111111' as Address;
      mockRpc.getAccountInfo.mockReturnValue(
        createPendingResponse({
          value: {
            address: addr,
            lamports: BigInt(1000000000),
            owner: addr,
            executable: false,
            data: 'dGVzdGRhdGE=',
          },
        }),
      );

      const result = await service.getAccountInfo(addr);
      expect(result).toBeDefined();
      expect(mockRpc.getAccountInfo).toHaveBeenCalled();
    });

    it('getMultipleAccounts should handle mixed Address and string types', async () => {
      const addr1 = '11111111111111111111111111111111' as Address;
      const addr2 = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

      mockRpc.getMultipleAccounts.mockReturnValue(
        createPendingResponse({
          value: [
            {
              address: addr1,
              lamports: BigInt(1000000000),
              owner: addr1,
              executable: false,
              data: 'dGVzdGRhdGEx',
            },
            {
              address: addr2 as Address,
              lamports: BigInt(2000000000),
              owner: addr1,
              executable: false,
              data: 'dGVzdGRhdGEy',
            },
          ],
        }),
      );

      const result = await service.getMultipleAccounts([addr1, addr2]);
      expect(result).toHaveLength(2);
      expect(mockRpc.getMultipleAccounts).toHaveBeenCalled();
    });

    it('getTokenAccounts with Address ownerAddress', async () => {
      const ownerAddr = '11111111111111111111111111111111' as Address;

      mockRpc.getTokenAccountsByOwner.mockReturnValue(
        createPendingResponse({
          value: [
            {
              address:
                'EPjFWdd4ReWfJY3LAX1dGjTvJ4p6X2L7tkjcBCUYfX1e' as Address,
              lamports: BigInt(2039280),
              owner: ownerAddr,
              executable: false,
              data: 'parsed_data',
            },
          ],
        }),
      );

      const result = await service.getTokenAccounts(ownerAddr);
      expect(result).toHaveLength(1);
      expect(mockRpc.getTokenAccountsByOwner).toHaveBeenCalled();
    });

    it('getTokenAccounts with Address tokenMintAddress', async () => {
      const ownerAddr = '11111111111111111111111111111111' as Address;
      const mintAddr =
        'EPjFWaJsv6DjsSuaT4jXfVfuE3axYR4MdNKWcqTPqe8t' as Address;

      mockRpc.getTokenAccountsByOwner.mockReturnValue(
        createPendingResponse({
          value: [
            {
              address: '44444444444444444444444444444444' as Address,
              lamports: BigInt(2039280),
              owner: ownerAddr,
              executable: false,
              data: 'parsed_data',
            },
          ],
        }),
      );

      const result = await service.getTokenAccounts(ownerAddr, mintAddr);
      expect(result).toHaveLength(1);
      expect(mockRpc.getTokenAccountsByOwner).toHaveBeenCalled();
      // Verify the filters were created with mint filter
      const callArgs = mockRpc.getTokenAccountsByOwner.mock
        .calls[0] as unknown[];
      expect(callArgs[1]).toHaveProperty('mint');
    });

    it('getTokenAccounts without tokenMintAddress should use programId filter', async () => {
      const ownerAddr = '11111111111111111111111111111111' as Address;

      mockRpc.getTokenAccountsByOwner.mockReturnValue(
        createPendingResponse({
          value: [
            {
              address:
                'EPjFWdd4ReWfJY3LAX1dGjTvJ4p6X2L7tkjcBCUYfX1e' as Address,
              lamports: BigInt(2039280),
              owner: ownerAddr,
              executable: false,
              data: 'parsed_data',
            },
          ],
        }),
      );

      const result = await service.getTokenAccounts(ownerAddr);
      expect(result).toHaveLength(1);
      // Verify the filters were created with programId filter
      const callArgs = mockRpc.getTokenAccountsByOwner.mock
        .calls[0] as unknown[];
      expect(callArgs[1]).toHaveProperty('programId');
    });

    it('accountExists with Address type', async () => {
      const addr = '11111111111111111111111111111111' as Address;
      mockRpc.getAccountInfo.mockReturnValue(
        createPendingResponse({
          value: {
            address: addr,
            lamports: BigInt(1000000000),
            owner: addr,
            executable: false,
            data: 'dGVzdGRhdGE=',
          },
        }),
      );

      const exists = await service.accountExists(addr);
      expect(exists).toBe(true);
    });
  });

  describe('getTokenDecimals', () => {
    const createMintAccountData = (decimals: number): string => {
      // SPL Token mint layout: 82 bytes total
      // mint_authority: 36 bytes (COption<Pubkey>)
      // supply: 8 bytes (u64)
      // decimals: 1 byte (u8)
      // is_initialized: 1 byte (bool)
      // freeze_authority: 36 bytes (COption<Pubkey>)
      const buffer = Buffer.alloc(82);
      buffer[44] = decimals;
      buffer[45] = 1; // is_initialized
      return buffer.toString('base64');
    };

    it('should return decimals for valid mint account', async () => {
      const mintData = createMintAccountData(6);
      mockRpc.getAccountInfo.mockReturnValue(
        createPendingResponse({
          value: {
            lamports: BigInt(1461600),
            owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address,
            executable: false,
            data: [mintData, 'base64'],
          },
        }),
      );

      const decimals = await service.getTokenDecimals(
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      );
      expect(decimals).toBe(6);
    });

    it('should return 9 decimals for SOL-like tokens', async () => {
      const mintData = createMintAccountData(9);
      mockRpc.getAccountInfo.mockReturnValue(
        createPendingResponse({
          value: {
            lamports: BigInt(1461600),
            owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address,
            executable: false,
            data: [mintData, 'base64'],
          },
        }),
      );

      const decimals = await service.getTokenDecimals(
        'So11111111111111111111111111111111111111112',
      );
      expect(decimals).toBe(9);
    });

    it('should throw error for non-existent mint', async () => {
      mockRpc.getAccountInfo.mockReturnValue(
        createPendingResponse({ value: null }),
      );

      await expect(
        service.getTokenDecimals('11111111111111111111111111111111'),
      ).rejects.toThrow('Mint account not found');
    });

    it('should throw error for invalid mint data (too short)', async () => {
      const shortData = Buffer.alloc(40).toString('base64');
      mockRpc.getAccountInfo.mockReturnValue(
        createPendingResponse({
          value: {
            lamports: BigInt(1461600),
            owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address,
            executable: false,
            data: [shortData, 'base64'],
          },
        }),
      );

      await expect(
        service.getTokenDecimals('11111111111111111111111111111111'),
      ).rejects.toThrow('Invalid mint account data');
    });

    it('should handle RPC errors', async () => {
      mockRpc.getAccountInfo.mockReturnValue({
        send: vi.fn().mockRejectedValue(new Error('RPC error')),
      });

      await expect(
        service.getTokenDecimals('11111111111111111111111111111111'),
      ).rejects.toThrow('RPC error');
    });
  });

  describe('getMultipleAccountsTyped', () => {
    it('should decode accounts with provided decoder', async () => {
      mockRpc.getMultipleAccounts.mockReturnValue(
        createPendingResponse({
          value: [
            {
              lamports: BigInt(1000),
              owner: '11111111111111111111111111111111' as Address,
              executable: false,
              data: ['dGVzdA==', 'base64'] as [string, string],
            },
            null,
          ],
        }),
      );

      const decoder = (data: Uint8Array) => ({ length: data.length });
      const result = await service.getMultipleAccountsTyped(
        ['11111111111111111111111111111111', '11111111111111111111111111111112'],
        decoder,
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ length: 4 });
      expect(result[1]).toBeNull();
    });

    it('should return null for failed decoding', async () => {
      mockRpc.getMultipleAccounts.mockReturnValue(
        createPendingResponse({
          value: [
            {
              lamports: BigInt(1000),
              owner: '11111111111111111111111111111111' as Address,
              executable: false,
              data: ['dGVzdA==', 'base64'] as [string, string],
            },
          ],
        }),
      );

      const decoder = () => {
        throw new Error('Decode error');
      };
      const result = await service.getMultipleAccountsTyped(
        ['11111111111111111111111111111111'],
        decoder,
      );

      expect(result[0]).toBeNull();
    });
  });

  describe('batchGetAccounts', () => {
    it('should fetch accounts in batches', async () => {
      const addresses = [
        '11111111111111111111111111111111',
        'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
      ];

      mockRpc.getMultipleAccounts.mockReturnValue(
        createPendingResponse({
          value: [
            {
              lamports: BigInt(1000),
              owner: '11111111111111111111111111111111' as Address,
              executable: false,
              data: ['dGVzdA==', 'base64'] as [string, string],
            },
            {
              lamports: BigInt(2000),
              owner: '11111111111111111111111111111111' as Address,
              executable: false,
              data: ['dGVzdDI=', 'base64'] as [string, string],
            },
          ],
        }),
      );

      const result = await service.batchGetAccounts(addresses);

      expect(result).toHaveLength(2);
      expect(mockRpc.getMultipleAccounts).toHaveBeenCalledTimes(1);
    });

    it('should split large arrays into batches', async () => {
      const addresses = Array(150)
        .fill(null)
        .map((_, i) => `11111111111111111111111111111111` as Address);

      mockRpc.getMultipleAccounts.mockReturnValue(
        createPendingResponse({
          value: Array(100).fill({
            lamports: BigInt(1000),
            owner: '11111111111111111111111111111111' as Address,
            executable: false,
            data: ['dGVzdA==', 'base64'] as [string, string],
          }),
        }),
      );

      await service.batchGetAccounts(addresses, { batchSize: 100, delayMs: 0 });

      expect(mockRpc.getMultipleAccounts).toHaveBeenCalledTimes(2);
    });

    it('should use custom batch options', async () => {
      const addresses = [
        '11111111111111111111111111111111',
        '11111111111111111111111111111112',
        '11111111111111111111111111111113',
      ] as Address[];

      mockRpc.getMultipleAccounts.mockReturnValue(
        createPendingResponse({
          value: [
            {
              lamports: BigInt(1000),
              owner: '11111111111111111111111111111111' as Address,
              executable: false,
              data: ['dGVzdA==', 'base64'] as [string, string],
            },
          ],
        }),
      );

      await service.batchGetAccounts(addresses, { batchSize: 1, delayMs: 0 });

      expect(mockRpc.getMultipleAccounts).toHaveBeenCalledTimes(3);
    });

    it('should delay between batches when delayMs is set', async () => {
      const addresses = [
        '11111111111111111111111111111111',
        '11111111111111111111111111111112',
      ] as Address[];

      mockRpc.getMultipleAccounts.mockReturnValue(
        createPendingResponse({
          value: [
            {
              lamports: BigInt(1000),
              owner: '11111111111111111111111111111111' as Address,
              executable: false,
              data: ['dGVzdA==', 'base64'] as [string, string],
            },
          ],
        }),
      );

      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

      await service.batchGetAccounts(addresses, { batchSize: 1, delayMs: 10 });

      expect(mockRpc.getMultipleAccounts).toHaveBeenCalledTimes(2);
      expect(setTimeoutSpy).toHaveBeenCalled();

      setTimeoutSpy.mockRestore();
    });
  });

  describe('batchGetAccountsTyped', () => {
    it('should decode accounts with provided decoder', async () => {
      mockRpc.getMultipleAccounts.mockReturnValue(
        createPendingResponse({
          value: [
            {
              lamports: BigInt(1000),
              owner: '11111111111111111111111111111111' as Address,
              executable: false,
              data: ['dGVzdA==', 'base64'] as [string, string],
            },
            null,
          ],
        }),
      );

      const decoder = (data: Uint8Array) => ({ length: data.length });
      const result = await service.batchGetAccountsTyped(
        ['11111111111111111111111111111111', '11111111111111111111111111111112'] as Address[],
        decoder,
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ length: 4 });
      expect(result[1]).toBeNull();
    });

    it('should return null for failed decoding', async () => {
      mockRpc.getMultipleAccounts.mockReturnValue(
        createPendingResponse({
          value: [
            {
              lamports: BigInt(1000),
              owner: '11111111111111111111111111111111' as Address,
              executable: false,
              data: ['dGVzdA==', 'base64'] as [string, string],
            },
          ],
        }),
      );

      const decoder = () => {
        throw new Error('Decode error');
      };
      const result = await service.batchGetAccountsTyped(
        ['11111111111111111111111111111111'] as Address[],
        decoder,
      );

      expect(result[0]).toBeNull();
    });
  });
});
