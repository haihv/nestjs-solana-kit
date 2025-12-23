import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { SolanaConfigService } from './solana-config.service';
import { SOLANA_MODULE_OPTIONS } from '../constants/solana.constants';
import { TEST_RPC_OPTIONS } from '../__tests__/test-fixtures';
import type { SolanaModuleOptions } from '../interfaces/solana-module-options.interface';

// Mock for RPC-based cluster detection tests
const mockGetGenesisHash = vi.fn();
vi.mock('@solana/kit', () => ({
  createSolanaRpc: vi.fn(() => ({
    getGenesisHash: () => ({
      send: mockGetGenesisHash,
    }),
  })),
}));

describe('SolanaConfigService', () => {
  let service: SolanaConfigService;

  describe('Initialization with different cluster configurations', () => {
    it('should initialize with mainnet-beta cluster', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: TEST_RPC_OPTIONS.MAINNET,
          },
          SolanaConfigService,
        ],
      }).compile();

      service = module.get<SolanaConfigService>(SolanaConfigService);

      expect(service).toBeDefined();
      expect(service.clusterName).toBe('mainnet-beta');
      expect(service.rpcUrl).toBe('https://api.mainnet-beta.solana.com');
      expect(service.commitment).toBe('finalized');
    });

    it('should initialize with devnet cluster', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: TEST_RPC_OPTIONS.DEVNET,
          },
          SolanaConfigService,
        ],
      }).compile();

      service = module.get<SolanaConfigService>(SolanaConfigService);

      expect(service.clusterName).toBe('devnet');
      expect(service.rpcUrl).toBe('https://api.devnet.solana.com');
      expect(service.commitment).toBe('confirmed');
    });

    it('should initialize with testnet cluster', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: TEST_RPC_OPTIONS.TESTNET,
          },
          SolanaConfigService,
        ],
      }).compile();

      service = module.get<SolanaConfigService>(SolanaConfigService);

      expect(service.clusterName).toBe('testnet');
      expect(service.rpcUrl).toBe('https://api.testnet.solana.com');
    });

    it('should initialize with localnet cluster', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: TEST_RPC_OPTIONS.LOCALNET,
          },
          SolanaConfigService,
        ],
      }).compile();

      service = module.get<SolanaConfigService>(SolanaConfigService);

      expect(service.clusterName).toBe('localnet');
      expect(service.rpcUrl).toBe('http://localhost:8899');
    });
  });

  describe('Cluster name getter', () => {
    it('should return the configured cluster name', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: TEST_RPC_OPTIONS.DEVNET,
          },
          SolanaConfigService,
        ],
      }).compile();

      service = module.get<SolanaConfigService>(SolanaConfigService);

      expect(service.clusterName).toBe('devnet');
    });

    it('should default to mainnet-beta when cluster is not specified', async () => {
      const options: SolanaModuleOptions = {
        rpcUrl: 'https://api.mainnet-beta.solana.com',
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: options,
          },
          SolanaConfigService,
        ],
      }).compile();

      service = module.get<SolanaConfigService>(SolanaConfigService);

      expect(service.clusterName).toBe('mainnet-beta');
    });

    it('should return a readonly cluster name', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: TEST_RPC_OPTIONS.DEVNET,
          },
          SolanaConfigService,
        ],
      }).compile();

      service = module.get<SolanaConfigService>(SolanaConfigService);

      const clusterName = service.clusterName;
      expect(clusterName).toBe('devnet');
      // Getter returns the same value on multiple calls
      expect(service.clusterName).toBe(clusterName);
    });
  });

  describe('RPC URL getter', () => {
    it('should return the configured RPC URL', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: TEST_RPC_OPTIONS.MAINNET,
          },
          SolanaConfigService,
        ],
      }).compile();

      service = module.get<SolanaConfigService>(SolanaConfigService);

      expect(service.rpcUrl).toBe('https://api.mainnet-beta.solana.com');
    });

    it('should handle custom RPC URLs', async () => {
      const customUrl = 'https://custom-rpc.example.com';
      const options: SolanaModuleOptions = {
        rpcUrl: customUrl,
        cluster: 'devnet',
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: options,
          },
          SolanaConfigService,
        ],
      }).compile();

      service = module.get<SolanaConfigService>(SolanaConfigService);

      expect(service.rpcUrl).toBe(customUrl);
    });

    it('should return a readonly RPC URL', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: TEST_RPC_OPTIONS.DEVNET,
          },
          SolanaConfigService,
        ],
      }).compile();

      service = module.get<SolanaConfigService>(SolanaConfigService);

      const rpcUrl = service.rpcUrl;
      expect(rpcUrl).toBe('https://api.devnet.solana.com');
      // Getter returns the same value on multiple calls
      expect(service.rpcUrl).toBe(rpcUrl);
    });
  });

  describe('Commitment level getter', () => {
    it('should return the configured commitment level', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: TEST_RPC_OPTIONS.MAINNET,
          },
          SolanaConfigService,
        ],
      }).compile();

      service = module.get<SolanaConfigService>(SolanaConfigService);

      expect(service.commitment).toBe('finalized');
    });

    it('should default to confirmed when commitment is not specified', async () => {
      const options: SolanaModuleOptions = {
        rpcUrl: 'https://api.devnet.solana.com',
        cluster: 'devnet',
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: options,
          },
          SolanaConfigService,
        ],
      }).compile();

      service = module.get<SolanaConfigService>(SolanaConfigService);

      expect(service.commitment).toBe('confirmed');
    });

    it('should handle different commitment levels', async () => {
      const commitmentLevels: Array<'processed' | 'confirmed' | 'finalized'> = [
        'processed',
        'confirmed',
        'finalized',
      ];

      for (const commitment of commitmentLevels) {
        const options: SolanaModuleOptions = {
          rpcUrl: 'https://api.devnet.solana.com',
          cluster: 'devnet',
          commitment,
        };

        const module: TestingModule = await Test.createTestingModule({
          providers: [
            {
              provide: SOLANA_MODULE_OPTIONS,
              useValue: options,
            },
            SolanaConfigService,
          ],
        }).compile();

        service = module.get<SolanaConfigService>(SolanaConfigService);

        expect(service.commitment).toBe(commitment);
      }
    });
  });

  describe('WebSocket URL getter', () => {
    it('should return the configured WebSocket URL when provided', async () => {
      const options: SolanaModuleOptions = {
        rpcUrl: 'https://api.devnet.solana.com',
        cluster: 'devnet',
        wsUrl: 'wss://api.devnet.solana.com',
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: options,
          },
          SolanaConfigService,
        ],
      }).compile();

      service = module.get<SolanaConfigService>(SolanaConfigService);

      expect(service.wsUrl).toBe('wss://api.devnet.solana.com');
    });

    it('should return undefined when WebSocket URL is not configured', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: TEST_RPC_OPTIONS.DEVNET,
          },
          SolanaConfigService,
        ],
      }).compile();

      service = module.get<SolanaConfigService>(SolanaConfigService);

      expect(service.wsUrl).toBeUndefined();
    });

    it('should handle custom WebSocket URLs', async () => {
      const customWsUrl = 'wss://custom-ws.example.com';
      const options: SolanaModuleOptions = {
        rpcUrl: 'https://custom-rpc.example.com',
        cluster: 'devnet',
        wsUrl: customWsUrl,
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: options,
          },
          SolanaConfigService,
        ],
      }).compile();

      service = module.get<SolanaConfigService>(SolanaConfigService);

      expect(service.wsUrl).toBe(customWsUrl);
    });
  });

  describe('Module options getter', () => {
    it('should return the complete module options', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: TEST_RPC_OPTIONS.MAINNET,
          },
          SolanaConfigService,
        ],
      }).compile();

      service = module.get<SolanaConfigService>(SolanaConfigService);

      const options = service.options;
      expect(options).toEqual(TEST_RPC_OPTIONS.MAINNET);
      expect(options.rpcUrl).toBe('https://api.mainnet-beta.solana.com');
      expect(options.cluster).toBe('mainnet-beta');
      expect(options.commitment).toBe('finalized');
    });

    it('should return options with all properties', async () => {
      const customOptions: SolanaModuleOptions = {
        rpcUrl: 'https://custom.example.com',
        cluster: 'devnet',
        commitment: 'processed',
        wsUrl: 'wss://custom-ws.example.com',
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: customOptions,
          },
          SolanaConfigService,
        ],
      }).compile();

      service = module.get<SolanaConfigService>(SolanaConfigService);

      const options = service.options;
      expect(options.rpcUrl).toBe('https://custom.example.com');
      expect(options.cluster).toBe('devnet');
      expect(options.commitment).toBe('processed');
      expect(options.wsUrl).toBe('wss://custom-ws.example.com');
    });
  });

  describe('Configuration consistency', () => {
    it('should maintain consistency between individual getters and options getter', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: TEST_RPC_OPTIONS.TESTNET,
          },
          SolanaConfigService,
        ],
      }).compile();

      service = module.get<SolanaConfigService>(SolanaConfigService);

      const options = service.options;
      expect(service.rpcUrl).toBe(options.rpcUrl);
      expect(service.clusterName).toBe(options.cluster);
    });

    it('should provide consistent values across multiple getter calls', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: TEST_RPC_OPTIONS.DEVNET,
          },
          SolanaConfigService,
        ],
      }).compile();

      service = module.get<SolanaConfigService>(SolanaConfigService);

      // Call getters multiple times
      expect(service.clusterName).toBe(service.clusterName);
      expect(service.rpcUrl).toBe(service.rpcUrl);
      expect(service.commitment).toBe(service.commitment);
      expect(service.wsUrl).toBe(service.wsUrl);
      expect(service.options).toEqual(service.options);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle empty wsUrl string gracefully', async () => {
      const options: SolanaModuleOptions = {
        rpcUrl: 'https://api.devnet.solana.com',
        cluster: 'devnet',
        wsUrl: '', // Empty string
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: options,
          },
          SolanaConfigService,
        ],
      }).compile();

      service = module.get<SolanaConfigService>(SolanaConfigService);

      // Empty string is a valid value (not undefined)
      expect(service.wsUrl).toBe('');
    });

    it('should initialize successfully with minimal configuration', async () => {
      const minimalOptions: SolanaModuleOptions = {
        rpcUrl: 'https://api.devnet.solana.com',
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: minimalOptions,
          },
          SolanaConfigService,
        ],
      }).compile();

      service = module.get<SolanaConfigService>(SolanaConfigService);

      expect(service).toBeDefined();
      expect(service.rpcUrl).toBe('https://api.devnet.solana.com');
      expect(service.clusterName).toBe('mainnet-beta'); // Default
      expect(service.commitment).toBe('confirmed'); // Default
      expect(service.wsUrl).toBeUndefined();
    });

    it('should handle all cluster types supported by Solana', async () => {
      const clusters = [
        'mainnet-beta',
        'testnet',
        'devnet',
        'localnet',
      ] as const;

      for (const cluster of clusters) {
        const options: SolanaModuleOptions = {
          rpcUrl: `https://api.${cluster}.solana.com`,
          cluster,
        };

        const module: TestingModule = await Test.createTestingModule({
          providers: [
            {
              provide: SOLANA_MODULE_OPTIONS,
              useValue: options,
            },
            SolanaConfigService,
          ],
        }).compile();

        service = module.get<SolanaConfigService>(SolanaConfigService);

        expect(service.clusterName).toBe(cluster);
      }
    });
  });

  describe('Service consistency and getter behavior', () => {
    it('should return the same options reference on multiple calls', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: TEST_RPC_OPTIONS.DEVNET,
          },
          SolanaConfigService,
        ],
      }).compile();

      service = module.get<SolanaConfigService>(SolanaConfigService);

      const options1 = service.options;
      const options2 = service.options;

      // Should return the same reference
      expect(options1).toBe(options2);
      expect(options1.rpcUrl).toBe(options2.rpcUrl);
    });

    it('should provide independent getter values without side effects', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: TEST_RPC_OPTIONS.MAINNET,
          },
          SolanaConfigService,
        ],
      }).compile();

      service = module.get<SolanaConfigService>(SolanaConfigService);

      const commitment1 = service.commitment;
      const rpcUrl = service.rpcUrl;
      const commitment2 = service.commitment;

      expect(commitment1).toBe(commitment2);
      expect(service.rpcUrl).toBe(rpcUrl);
    });

    it('should maintain internal state isolation', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: TEST_RPC_OPTIONS.DEVNET,
          },
          SolanaConfigService,
        ],
      }).compile();

      service = module.get<SolanaConfigService>(SolanaConfigService);

      // Getters should return consistent values regardless of external access
      expect(service.rpcUrl).toBe('https://api.devnet.solana.com');
      expect(service.clusterName).toBe('devnet');
      expect(service.rpcUrl).toBe('https://api.devnet.solana.com');
    });
  });

  describe('Logging behavior', () => {
    it('should be defined and operational', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: TEST_RPC_OPTIONS.DEVNET,
          },
          SolanaConfigService,
        ],
      }).compile();

      service = module.get<SolanaConfigService>(SolanaConfigService);

      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(SolanaConfigService);
    });
  });

  describe('Cluster auto-detection', () => {
    it('should skip auto-detection when cluster is explicitly provided', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: TEST_RPC_OPTIONS.DEVNET,
          },
          SolanaConfigService,
        ],
      }).compile();

      service = module.get<SolanaConfigService>(SolanaConfigService);
      await service.onModuleInit();

      expect(service.clusterName).toBe('devnet');
    });

    it('should detect localnet from localhost URL without RPC call', async () => {
      const options: SolanaModuleOptions = {
        rpcUrl: 'http://localhost:8899',
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: options,
          },
          SolanaConfigService,
        ],
      }).compile();

      service = module.get<SolanaConfigService>(SolanaConfigService);
      await service.onModuleInit();

      expect(service.clusterName).toBe('localnet');
    });

    it('should detect localnet from 127.0.0.1 URL without RPC call', async () => {
      const options: SolanaModuleOptions = {
        rpcUrl: 'http://127.0.0.1:8899',
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: options,
          },
          SolanaConfigService,
        ],
      }).compile();

      service = module.get<SolanaConfigService>(SolanaConfigService);
      await service.onModuleInit();

      expect(service.clusterName).toBe('localnet');
    });

    it('should default to mainnet-beta before auto-detection completes', async () => {
      const options: SolanaModuleOptions = {
        rpcUrl: 'https://custom-rpc.example.com',
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: options,
          },
          SolanaConfigService,
        ],
      }).compile();

      service = module.get<SolanaConfigService>(SolanaConfigService);

      // Before onModuleInit, should return default
      expect(service.clusterName).toBe('mainnet-beta');
    });

    it('should prioritize explicit cluster over auto-detection', async () => {
      const options: SolanaModuleOptions = {
        rpcUrl: 'http://localhost:8899',
        cluster: 'devnet', // Explicit override
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: options,
          },
          SolanaConfigService,
        ],
      }).compile();

      service = module.get<SolanaConfigService>(SolanaConfigService);
      await service.onModuleInit();

      // Explicit cluster takes precedence over URL-based detection
      expect(service.clusterName).toBe('devnet');
    });

    it('should cache detected cluster and return it on subsequent calls', async () => {
      const options: SolanaModuleOptions = {
        rpcUrl: 'http://localhost:8899',
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: options,
          },
          SolanaConfigService,
        ],
      }).compile();

      service = module.get<SolanaConfigService>(SolanaConfigService);

      // First call detects localnet
      await service.onModuleInit();
      expect(service.clusterName).toBe('localnet');

      // Second call should use cached value
      await service.onModuleInit();
      expect(service.clusterName).toBe('localnet');
    });

    it('should handle concurrent detection calls by returning the same promise', async () => {
      // Use non-localhost URL to trigger RPC-based detection
      mockGetGenesisHash.mockResolvedValue(
        'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG',
      );

      const options: SolanaModuleOptions = {
        rpcUrl: 'https://custom-rpc.example.com',
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: options,
          },
          SolanaConfigService,
        ],
      }).compile();

      service = module.get<SolanaConfigService>(SolanaConfigService);

      // Call onModuleInit concurrently - both should use the same promise
      const [result1, result2] = await Promise.all([
        service.onModuleInit(),
        service.onModuleInit(),
      ]);

      // Both should complete successfully
      expect(result1).toBeUndefined();
      expect(result2).toBeUndefined();
      expect(service.clusterName).toBe('devnet');

      // RPC should only be called once due to promise caching
      expect(mockGetGenesisHash).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cluster auto-detection with RPC', () => {
    beforeEach(() => {
      mockGetGenesisHash.mockReset();
    });

    it('should detect devnet cluster from genesis hash', async () => {
      mockGetGenesisHash.mockResolvedValue(
        'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG',
      );

      const options: SolanaModuleOptions = {
        rpcUrl: 'https://custom-devnet-rpc.example.com',
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: options,
          },
          SolanaConfigService,
        ],
      }).compile();

      service = module.get<SolanaConfigService>(SolanaConfigService);
      await service.onModuleInit();

      expect(service.clusterName).toBe('devnet');
    });

    it('should detect mainnet-beta cluster from genesis hash', async () => {
      mockGetGenesisHash.mockResolvedValue(
        '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d',
      );

      const options: SolanaModuleOptions = {
        rpcUrl: 'https://custom-mainnet-rpc.example.com',
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: options,
          },
          SolanaConfigService,
        ],
      }).compile();

      service = module.get<SolanaConfigService>(SolanaConfigService);
      await service.onModuleInit();

      expect(service.clusterName).toBe('mainnet-beta');
    });

    it('should detect testnet cluster from genesis hash', async () => {
      mockGetGenesisHash.mockResolvedValue(
        '4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY',
      );

      const options: SolanaModuleOptions = {
        rpcUrl: 'https://custom-testnet-rpc.example.com',
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: options,
          },
          SolanaConfigService,
        ],
      }).compile();

      service = module.get<SolanaConfigService>(SolanaConfigService);
      await service.onModuleInit();

      expect(service.clusterName).toBe('testnet');
    });

    it('should default to mainnet-beta for unknown genesis hash', async () => {
      mockGetGenesisHash.mockResolvedValue('UnknownGenesisHash123456789');

      const options: SolanaModuleOptions = {
        rpcUrl: 'https://unknown-network-rpc.example.com',
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: options,
          },
          SolanaConfigService,
        ],
      }).compile();

      service = module.get<SolanaConfigService>(SolanaConfigService);
      await service.onModuleInit();

      expect(service.clusterName).toBe('mainnet-beta');
    });

    it('should fallback to mainnet-beta when RPC call fails', async () => {
      mockGetGenesisHash.mockRejectedValue(new Error('RPC connection failed'));

      const options: SolanaModuleOptions = {
        rpcUrl: 'https://failing-rpc.example.com',
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: options,
          },
          SolanaConfigService,
        ],
      }).compile();

      service = module.get<SolanaConfigService>(SolanaConfigService);
      await service.onModuleInit();

      expect(service.clusterName).toBe('mainnet-beta');
    });
  });
});
