import { Test, TestingModule } from '@nestjs/testing';
import { SolanaBlockService } from './solana-block.service';
import { SolanaRpcService } from './solana-rpc.service';
import type { Blockhash } from '@solana/kit';

const createPendingResponse = <T>(value: T) => ({
  send: jest.fn().mockResolvedValue(value),
});

interface MockRpc {
  getSlot: jest.Mock;
  getBlockHeight: jest.Mock;
  getLatestBlockhash: jest.Mock;
  getSlotLeader: jest.Mock;
  getEpochInfo: jest.Mock;
  isBlockhashValid: jest.Mock;
  getBlockTime: jest.Mock;
  getBlocks: jest.Mock;
  getBlocksWithLimit: jest.Mock;
  getBlock: jest.Mock;
}

describe('SolanaBlockService', () => {
  let service: SolanaBlockService;
  let mockRpcService: { rpc: MockRpc; clusterName: string; options: any };
  let mockRpc: MockRpc;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Create a fully mocked RPC object
    mockRpc = {
      getSlot: jest.fn().mockReturnValue(createPendingResponse(BigInt(123456))),
      getBlockHeight: jest
        .fn()
        .mockReturnValue(createPendingResponse(BigInt(250000000))),
      getLatestBlockhash: jest.fn().mockReturnValue(
        createPendingResponse({
          value: {
            blockhash: 'test_blockhash',
            lastValidBlockHeight: BigInt(250000000),
          },
        }),
      ),
      getSlotLeader: jest
        .fn()
        .mockReturnValue(
          createPendingResponse('11111111111111111111111111111111'),
        ),
      getEpochInfo: jest.fn().mockReturnValue(
        createPendingResponse({
          epoch: BigInt(500),
          slotIndex: BigInt(1000),
          slotsInEpoch: BigInt(432000),
          absoluteSlot: BigInt(250000000),
          blockHeight: BigInt(250000000),
          transactionCount: BigInt(1000000),
        }),
      ),
      isBlockhashValid: jest
        .fn()
        .mockReturnValue(createPendingResponse({ value: true })),
      getBlockTime: jest
        .fn()
        .mockReturnValue(createPendingResponse(BigInt(1700000000))),
      getBlocks: jest
        .fn()
        .mockReturnValue(
          createPendingResponse([
            BigInt(100000),
            BigInt(100001),
            BigInt(100002),
          ]),
        ),
      getBlocksWithLimit: jest
        .fn()
        .mockReturnValue(
          createPendingResponse([BigInt(100000), BigInt(100001)]),
        ),
      getBlock: jest.fn().mockReturnValue(
        createPendingResponse({
          blockHeight: BigInt(250000000),
          blockhash: 'test_blockhash',
          previousBlockhash: 'prev_blockhash',
          transactions: [{ transaction: 'mock_tx' }],
        }),
      ),
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
        SolanaBlockService,
        {
          provide: SolanaRpcService,
          useValue: mockRpcService,
        },
      ],
    }).compile();

    service = module.get<SolanaBlockService>(SolanaBlockService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCurrentSlot', () => {
    it('should return current slot', async () => {
      mockRpc.getSlot.mockReturnValue(createPendingResponse(BigInt(123456)));

      const slot = await service.getCurrentSlot();
      expect(slot).toBe(BigInt(123456));
    });

    it('should handle RPC errors', async () => {
      mockRpc.getSlot.mockReturnValue({
        send: jest.fn().mockRejectedValue(new Error('RPC error')),
      });

      await expect(service.getCurrentSlot()).rejects.toThrow('RPC error');
    });
  });

  describe('getBlockHeight', () => {
    it('should return current block height', async () => {
      mockRpc.getBlockHeight.mockReturnValue(
        createPendingResponse(BigInt(250000000)),
      );

      const height = await service.getBlockHeight();
      expect(height).toBe(BigInt(250000000));
    });

    it('should handle RPC errors', async () => {
      mockRpc.getBlockHeight.mockReturnValue({
        send: jest.fn().mockRejectedValue(new Error('RPC error')),
      });

      await expect(service.getBlockHeight()).rejects.toThrow('RPC error');
    });
  });

  describe('getLatestBlockhash', () => {
    it('should return latest blockhash info with both properties', async () => {
      const blockhashInfo = {
        value: {
          blockhash: 'test_blockhash' as Blockhash,
          lastValidBlockHeight: BigInt(250000000),
        },
      };

      mockRpc.getLatestBlockhash.mockReturnValue(
        createPendingResponse(blockhashInfo),
      );

      const result = await service.getLatestBlockhash();
      expect(result).toBeDefined();
      expect(result.blockhash).toBe('test_blockhash');
      expect(typeof result.blockhash).toBe('string');
      expect(result.lastValidBlockHeight).toBe(BigInt(250000000));
      expect(typeof result.lastValidBlockHeight).toBe('bigint');
    });

    it('should handle RPC errors', async () => {
      mockRpc.getLatestBlockhash.mockReturnValue({
        send: jest.fn().mockRejectedValue(new Error('RPC error')),
      });

      await expect(service.getLatestBlockhash()).rejects.toThrow('RPC error');
    });
  });

  describe('getSlotLeader', () => {
    it('should return slot leader address', async () => {
      const leaderAddress = '11111111111111111111111111111111';
      mockRpc.getSlotLeader.mockReturnValue(
        createPendingResponse(leaderAddress),
      );

      const leader = await service.getSlotLeader();
      expect(leader).toBe(leaderAddress);
    });

    it('should handle RPC errors', async () => {
      mockRpc.getSlotLeader.mockReturnValue({
        send: jest.fn().mockRejectedValue(new Error('RPC error')),
      });

      await expect(service.getSlotLeader()).rejects.toThrow('RPC error');
    });
  });

  describe('getEpochInfo', () => {
    it('should return epoch information with all properties', async () => {
      const epochInfo = {
        epoch: BigInt(500),
        slotIndex: BigInt(1000),
        slotsInEpoch: BigInt(432000),
        absoluteSlot: BigInt(250000000),
        blockHeight: BigInt(250000000),
        transactionCount: BigInt(1000000),
      };

      mockRpc.getEpochInfo.mockReturnValue(createPendingResponse(epochInfo));

      const result = await service.getEpochInfo();
      expect(result.epoch).toBe(BigInt(500));
      expect(result.slotIndex).toBe(BigInt(1000));
      expect(result.slotsInEpoch).toBe(BigInt(432000));
      expect(result.absoluteSlot).toBe(BigInt(250000000));
      expect(result.blockHeight).toBe(BigInt(250000000));
      expect(result.transactionCount).toBe(BigInt(1000000));
    });

    it('should handle RPC errors', async () => {
      mockRpc.getEpochInfo.mockReturnValue({
        send: jest.fn().mockRejectedValue(new Error('RPC error')),
      });

      await expect(service.getEpochInfo()).rejects.toThrow('RPC error');
    });
  });

  describe('isBlockhashValid', () => {
    it('should return true when blockhash is valid', async () => {
      const blockHashInfo = {
        value: true,
      };

      mockRpc.isBlockhashValid.mockReturnValue(
        createPendingResponse(blockHashInfo),
      );

      const result = await service.isBlockhashValid(
        'test_blockhash' as Blockhash,
      );
      expect(result).toBe(true);
    });

    it('should return false when blockhash is invalid', async () => {
      const blockHashInfo = {
        value: false,
      };

      mockRpc.isBlockhashValid.mockReturnValue(
        createPendingResponse(blockHashInfo),
      );

      const result = await service.isBlockhashValid(
        'test_blockhash' as Blockhash,
      );
      expect(result).toBe(false);
    });

    it('should handle RPC errors', async () => {
      mockRpc.isBlockhashValid.mockReturnValue({
        send: jest.fn().mockRejectedValue(new Error('RPC error')),
      });

      await expect(
        service.isBlockhashValid('test_blockhash' as Blockhash),
      ).rejects.toThrow('RPC error');
    });
  });

  describe('getBlockTime', () => {
    it('should return block time', async () => {
      mockRpc.getBlockTime.mockReturnValue(
        createPendingResponse(BigInt(1700000000)),
      );

      const blockTime = await service.getBlockTime(BigInt(123456));
      expect(blockTime).toBe(BigInt(1700000000));
    });

    it('should handle null block time', async () => {
      mockRpc.getBlockTime.mockReturnValue(createPendingResponse(null));

      const blockTime = await service.getBlockTime(BigInt(123456));
      expect(blockTime).toBeNull();
    });

    it('should handle RPC errors', async () => {
      mockRpc.getBlockTime.mockReturnValue({
        send: jest.fn().mockRejectedValue(new Error('RPC error')),
      });

      await expect(service.getBlockTime(BigInt(123456))).rejects.toThrow(
        'RPC error',
      );
    });
  });

  describe('getBlocks', () => {
    it('should return array of block slots', async () => {
      const blocks = [BigInt(100000), BigInt(100001), BigInt(100002)];

      mockRpc.getBlocks.mockReturnValue(createPendingResponse(blocks));

      const result = await service.getBlocks(BigInt(100000));
      expect(result).toEqual(blocks);
    });

    it('should handle optional endSlot parameter', async () => {
      const blocks = [BigInt(100000), BigInt(100001)];

      mockRpc.getBlocks.mockReturnValue(createPendingResponse(blocks));

      const result = await service.getBlocks(BigInt(100000), BigInt(100001));
      expect(result).toEqual(blocks);
    });

    it('should handle RPC errors', async () => {
      mockRpc.getBlocks.mockReturnValue({
        send: jest.fn().mockRejectedValue(new Error('RPC error')),
      });

      await expect(service.getBlocks(BigInt(100000))).rejects.toThrow(
        'RPC error',
      );
    });
  });

  describe('getBlocksWithLimit', () => {
    it('should return blocks with limit', async () => {
      const blocks = [BigInt(100000), BigInt(100001)];

      mockRpc.getBlocksWithLimit.mockReturnValue(createPendingResponse(blocks));

      const result = await service.getBlocksWithLimit(BigInt(100000), 2);
      expect(result).toEqual(blocks);
    });

    it('should handle RPC errors', async () => {
      mockRpc.getBlocksWithLimit.mockReturnValue({
        send: jest.fn().mockRejectedValue(new Error('RPC error')),
      });

      await expect(
        service.getBlocksWithLimit(BigInt(100000), 10),
      ).rejects.toThrow('RPC error');
    });
  });

  describe('getBlock', () => {
    it('should return block info with transactions when includeTransactions is true', async () => {
      const blockInfo = {
        blockHeight: BigInt(250000000),
        blockhash: 'test_blockhash',
        previousBlockhash: 'prev_blockhash',
        transactions: [{ transaction: 'mock_tx' }],
      };

      mockRpc.getBlock.mockReturnValue(createPendingResponse(blockInfo));

      const result = await service.getBlock(BigInt(123456), true);
      expect(result).toBeDefined();
      expect(result?.blockHeight).toBe(BigInt(250000000));
      expect(result?.blockhash).toBe('test_blockhash');
      expect(result?.previousBlockhash).toBe('prev_blockhash');
      expect(result?.transactions).toBeDefined();
      expect(Array.isArray(result?.transactions)).toBe(true);
    });

    it('should return block info without transactions when includeTransactions is false', async () => {
      const blockInfo = {
        blockHeight: BigInt(250000000),
        blockhash: 'test_blockhash',
        previousBlockhash: 'prev_blockhash',
        signatures: ['sig1', 'sig2'],
      };

      mockRpc.getBlock.mockReturnValue(createPendingResponse(blockInfo));

      const result = await service.getBlock(BigInt(123456), false);
      expect(result).toBeDefined();
      expect(result?.blockHeight).toBe(BigInt(250000000));
      expect(result?.blockhash).toBe('test_blockhash');
      expect(result?.previousBlockhash).toBe('prev_blockhash');
      expect(result?.signatures).toBeDefined();
      expect(Array.isArray(result?.signatures)).toBe(true);
      expect(result?.signatures?.length).toBe(2);
    });

    it('should handle null block', async () => {
      mockRpc.getBlock.mockReturnValue(createPendingResponse(null));

      const result = await service.getBlock(BigInt(999999));
      expect(result).toBeNull();
    });

    it('should handle RPC errors', async () => {
      mockRpc.getBlock.mockReturnValue({
        send: jest.fn().mockRejectedValue(new Error('RPC error')),
      });

      await expect(service.getBlock(BigInt(123456))).rejects.toThrow(
        'RPC error',
      );
    });
  });
});
