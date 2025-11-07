import { Test, TestingModule } from '@nestjs/testing';
import { SolanaConfigService } from './solana-config.service';
import { SOLANA_MODULE_OPTIONS } from '../constants/solana.constants';
import { TEST_RPC_OPTIONS } from '../__tests__/test-fixtures';
import type { SolanaModuleOptions } from '../interfaces/solana-module-options.interface';

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
});
