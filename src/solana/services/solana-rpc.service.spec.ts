import { Test, TestingModule } from '@nestjs/testing';
import { SolanaConfigService } from './solana-config.service';
import { SolanaRpcService } from './solana-rpc.service';
import { SOLANA_MODULE_OPTIONS } from '../constants/solana.constants';
import { TEST_RPC_OPTIONS } from '../__tests__/test-fixtures';

describe('SolanaRpcService', () => {
  let service: SolanaRpcService;
  let configService: SolanaConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Devnet cluster configuration', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: TEST_RPC_OPTIONS.DEVNET,
          },
          SolanaConfigService,
          SolanaRpcService,
        ],
      }).compile();

      service = module.get<SolanaRpcService>(SolanaRpcService);
      configService = module.get<SolanaConfigService>(SolanaConfigService);
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should return RPC instance via getter', () => {
      const rpc = service.rpc;
      expect(rpc).toBeDefined();
    });

    it('should have access to config via injected configService', () => {
      expect(configService.clusterName).toBe('devnet');
    });

    it('should be initialized with devnet RPC URL', () => {
      expect(configService.rpcUrl).toBe(TEST_RPC_OPTIONS.DEVNET.rpcUrl);
    });
  });

  describe('Mainnet-beta cluster configuration', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: TEST_RPC_OPTIONS.MAINNET,
          },
          SolanaConfigService,
          SolanaRpcService,
        ],
      }).compile();

      service = module.get<SolanaRpcService>(SolanaRpcService);
      configService = module.get<SolanaConfigService>(SolanaConfigService);
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have mainnet-beta cluster in config', () => {
      expect(configService.clusterName).toBe('mainnet-beta');
    });

    it('should return RPC instance for mainnet', () => {
      const rpc = service.rpc;
      expect(rpc).toBeDefined();
    });

    it('should have mainnet RPC URL', () => {
      expect(configService.rpcUrl).toBe(TEST_RPC_OPTIONS.MAINNET.rpcUrl);
    });
  });

  describe('Testnet cluster configuration', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: TEST_RPC_OPTIONS.TESTNET,
          },
          SolanaConfigService,
          SolanaRpcService,
        ],
      }).compile();

      service = module.get<SolanaRpcService>(SolanaRpcService);
      configService = module.get<SolanaConfigService>(SolanaConfigService);
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have testnet cluster in config', () => {
      expect(configService.clusterName).toBe('testnet');
    });

    it('should return RPC instance for testnet', () => {
      const rpc = service.rpc;
      expect(rpc).toBeDefined();
    });

    it('should have testnet RPC URL', () => {
      expect(configService.rpcUrl).toBe(TEST_RPC_OPTIONS.TESTNET.rpcUrl);
    });
  });

  describe('Localnet cluster configuration', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: TEST_RPC_OPTIONS.LOCALNET,
          },
          SolanaConfigService,
          SolanaRpcService,
        ],
      }).compile();

      service = module.get<SolanaRpcService>(SolanaRpcService);
      configService = module.get<SolanaConfigService>(SolanaConfigService);
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have localnet cluster in config', () => {
      expect(configService.clusterName).toBe('localnet');
    });

    it('should return RPC instance for localnet', () => {
      const rpc = service.rpc;
      expect(rpc).toBeDefined();
    });

    it('should have localnet RPC URL', () => {
      expect(configService.rpcUrl).toBe(TEST_RPC_OPTIONS.LOCALNET.rpcUrl);
    });
  });

  describe('Default cluster configuration (when cluster not specified)', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: {
              rpcUrl: 'https://api.mainnet-beta.solana.com',
              // cluster not specified - should default to mainnet-beta
            },
          },
          SolanaConfigService,
          SolanaRpcService,
        ],
      }).compile();

      service = module.get<SolanaRpcService>(SolanaRpcService);
      configService = module.get<SolanaConfigService>(SolanaConfigService);
    });

    it('should default to mainnet-beta cluster', () => {
      expect(configService.clusterName).toBe('mainnet-beta');
    });

    it('should return RPC instance with default configuration', () => {
      const rpc = service.rpc;
      expect(rpc).toBeDefined();
    });
  });

  describe('RPC getter', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: TEST_RPC_OPTIONS.DEVNET,
          },
          SolanaConfigService,
          SolanaRpcService,
        ],
      }).compile();

      service = module.get<SolanaRpcService>(SolanaRpcService);
    });

    it('should expose rpc getter', () => {
      expect(service.rpc).toBeDefined();
    });

    it('should return same RPC instance on multiple calls', () => {
      const rpc1 = service.rpc;
      const rpc2 = service.rpc;
      expect(rpc1).toBe(rpc2);
    });
  });

  describe('isHealthy', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: TEST_RPC_OPTIONS.DEVNET,
          },
          SolanaConfigService,
          SolanaRpcService,
        ],
      }).compile();

      service = module.get<SolanaRpcService>(SolanaRpcService);
    });

    it('should return boolean result', async () => {
      const result = await service.isHealthy();
      expect(typeof result).toBe('boolean');
    }, 30000);
  });

  describe('Health check with invalid RPC endpoint', () => {
    it('should return false for unhealthy RPC connection', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: {
              rpcUrl:
                'http://invalid-rpc-endpoint-that-does-not-exist.example.com:9999',
              cluster: 'localnet',
              commitment: 'confirmed',
            },
          },
          SolanaConfigService,
          SolanaRpcService,
        ],
      }).compile();

      const unhealthyService = module.get<SolanaRpcService>(SolanaRpcService);
      const result = await unhealthyService.isHealthy();

      expect(result).toBe(false);
    });
  });

  describe('onModuleDestroy', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: SOLANA_MODULE_OPTIONS,
            useValue: TEST_RPC_OPTIONS.DEVNET,
          },
          SolanaConfigService,
          SolanaRpcService,
        ],
      }).compile();

      service = module.get<SolanaRpcService>(SolanaRpcService);
    });

    it('should execute without errors', () => {
      expect(() => {
        service.onModuleDestroy();
      }).not.toThrow();
    });

    it('should be callable', () => {
      expect(typeof service.onModuleDestroy).toBe('function');
    });
  });
});
