import { Test, TestingModule } from '@nestjs/testing';
import { SolanaModule } from './solana.module';
import {
  SolanaRpcService,
  SolanaAccountService,
  SolanaBlockService,
  SolanaTransactionService,
  SolanaSubscriptionService,
  SolanaUtilsService,
  SolanaProgramService,
} from './services';
import { SolanaModuleOptionsFactory } from './interfaces/solana-module-options.interface';
import { SOLANA_MODULE_OPTIONS } from './constants/solana.constants';
import type { SolanaModuleOptions } from './interfaces/solana-module-options.interface';

describe('SolanaModule', () => {
  const testOptions = {
    rpcUrl: 'https://api.devnet.solana.com',
    cluster: 'devnet' as const,
    commitment: 'confirmed' as const,
  };

  describe('register', () => {
    let module: TestingModule;

    beforeEach(async () => {
      module = await Test.createTestingModule({
        imports: [SolanaModule.register(testOptions)],
      }).compile();
    });

    it('should provide SOLANA_MODULE_OPTIONS', () => {
      const options = module.get<SolanaModuleOptions>(SOLANA_MODULE_OPTIONS);
      expect(options).toBeDefined();
      expect(options.rpcUrl).toBe(testOptions.rpcUrl);
      expect(options.cluster).toBe(testOptions.cluster);
      expect(options.commitment).toBe(testOptions.commitment);
    });

    it('should provide SolanaRpcService', () => {
      const service = module.get(SolanaRpcService);
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(SolanaRpcService);
    });

    it('should provide SolanaAccountService', () => {
      const service = module.get(SolanaAccountService);
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(SolanaAccountService);
    });

    it('should provide SolanaBlockService', () => {
      const service = module.get(SolanaBlockService);
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(SolanaBlockService);
    });

    it('should provide SolanaTransactionService', () => {
      const service = module.get(SolanaTransactionService);
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(SolanaTransactionService);
    });

    it('should provide SolanaSubscriptionService', () => {
      const service = module.get(SolanaSubscriptionService);
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(SolanaSubscriptionService);
    });

    it('should provide SolanaUtilsService', () => {
      const service = module.get(SolanaUtilsService);
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(SolanaUtilsService);
    });

    it('should provide SolanaProgramService', () => {
      const service = module.get(SolanaProgramService);
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(SolanaProgramService);
    });

    it('should export all services', () => {
      const dynamicModule = SolanaModule.register(testOptions);
      expect(dynamicModule.exports).toContain(SolanaRpcService);
      expect(dynamicModule.exports).toContain(SolanaAccountService);
      expect(dynamicModule.exports).toContain(SolanaBlockService);
      expect(dynamicModule.exports).toContain(SolanaTransactionService);
      expect(dynamicModule.exports).toContain(SolanaSubscriptionService);
      expect(dynamicModule.exports).toContain(SolanaUtilsService);
      expect(dynamicModule.exports).toContain(SolanaProgramService);
    });

    it('should allow different RPC URLs', async () => {
      const customOptions = {
        rpcUrl: 'https://api.mainnet-beta.solana.com',
        cluster: 'mainnet-beta' as const,
        commitment: 'finalized' as const,
      };

      const customModule = await Test.createTestingModule({
        imports: [SolanaModule.register(customOptions)],
      }).compile();

      const options = customModule.get<SolanaModuleOptions>(
        SOLANA_MODULE_OPTIONS,
      );
      expect(options.rpcUrl).toBe('https://api.mainnet-beta.solana.com');
      expect(options.cluster).toBe('mainnet-beta');
      expect(options.commitment).toBe('finalized');
    });
  });

  describe('registerAsync', () => {
    describe('with useFactory', () => {
      let module: TestingModule;

      beforeEach(async () => {
        module = await Test.createTestingModule({
          imports: [
            SolanaModule.registerAsync({
              useFactory: () => testOptions,
            }),
          ],
        }).compile();
      });

      it('should provide SOLANA_MODULE_OPTIONS from factory', () => {
        const options = module.get<SolanaModuleOptions>(SOLANA_MODULE_OPTIONS);
        expect(options).toBeDefined();
        expect(options.rpcUrl).toBe(testOptions.rpcUrl);
      });

      it('should provide all services', () => {
        expect(module.get(SolanaRpcService)).toBeDefined();
        expect(module.get(SolanaAccountService)).toBeDefined();
        expect(module.get(SolanaBlockService)).toBeDefined();
        expect(module.get(SolanaTransactionService)).toBeDefined();
        expect(module.get(SolanaSubscriptionService)).toBeDefined();
        expect(module.get(SolanaUtilsService)).toBeDefined();
        expect(module.get(SolanaProgramService)).toBeDefined();
      });

      it('should support async factory functions', async () => {
        const asyncModule = await Test.createTestingModule({
          imports: [
            SolanaModule.registerAsync({
              useFactory: async () => {
                // Simulate async operation like reading config
                return new Promise((resolve) =>
                  setTimeout(() => resolve(testOptions), 10),
                );
              },
            }),
          ],
        }).compile();

        const options = asyncModule.get<SolanaModuleOptions>(
          SOLANA_MODULE_OPTIONS,
        );
        expect(options).toBeDefined();
        expect(options.rpcUrl).toBe(testOptions.rpcUrl);
      });

      it('should return consistent dynamic module', () => {
        const dynamicModule = SolanaModule.registerAsync({
          useFactory: () => testOptions,
        });

        expect(dynamicModule.module).toBe(SolanaModule);
        expect(dynamicModule.providers).toBeDefined();
        expect(dynamicModule.exports).toBeDefined();
      });
    });

    describe('with useClass', () => {
      let module: TestingModule;

      class TestOptionsFactory implements SolanaModuleOptionsFactory {
        createSolanaModuleOptions() {
          return testOptions;
        }
      }

      beforeEach(async () => {
        module = await Test.createTestingModule({
          imports: [
            SolanaModule.registerAsync({
              useClass: TestOptionsFactory,
            }),
          ],
        }).compile();
      });

      it('should provide SOLANA_MODULE_OPTIONS from class factory', () => {
        const options = module.get<SolanaModuleOptions>(SOLANA_MODULE_OPTIONS);
        expect(options).toBeDefined();
        expect(options.rpcUrl).toBe(testOptions.rpcUrl);
      });

      it('should provide all services', () => {
        expect(module.get(SolanaRpcService)).toBeDefined();
        expect(module.get(SolanaAccountService)).toBeDefined();
        expect(module.get(SolanaBlockService)).toBeDefined();
        expect(module.get(SolanaTransactionService)).toBeDefined();
        expect(module.get(SolanaSubscriptionService)).toBeDefined();
        expect(module.get(SolanaUtilsService)).toBeDefined();
        expect(module.get(SolanaProgramService)).toBeDefined();
      });

      it('should instantiate and register the factory class', async () => {
        const classModule = await Test.createTestingModule({
          imports: [
            SolanaModule.registerAsync({
              useClass: TestOptionsFactory,
            }),
          ],
        }).compile();

        const factory = classModule.get(TestOptionsFactory);
        expect(factory).toBeInstanceOf(TestOptionsFactory);
      });
    });

    describe('with useExisting', () => {
      class ExistingFactory implements SolanaModuleOptionsFactory {
        createSolanaModuleOptions() {
          return testOptions;
        }
      }

      it('should create dynamic module with useExisting', () => {
        const dynamicModule = SolanaModule.registerAsync({
          useExisting: ExistingFactory,
        });

        expect(dynamicModule.module).toBe(SolanaModule);
        expect(dynamicModule.providers).toBeDefined();
        expect(Array.isArray(dynamicModule.providers)).toBe(true);
      });
    });

    it('should handle missing optional imports', async () => {
      const module = await Test.createTestingModule({
        imports: [
          SolanaModule.registerAsync({
            useFactory: () => testOptions,
          }),
        ],
      }).compile();

      const options = module.get<SolanaModuleOptions>(SOLANA_MODULE_OPTIONS);
      expect(options).toBeDefined();
    });

    it('should handle missing optional injection array', async () => {
      const module = await Test.createTestingModule({
        imports: [
          SolanaModule.registerAsync({
            useFactory: () => testOptions,
            // No inject array provided
          }),
        ],
      }).compile();

      const options = module.get<SolanaModuleOptions>(SOLANA_MODULE_OPTIONS);
      expect(options).toBeDefined();
    });
  });

  describe('module structure', () => {
    it('should be a valid NestJS module', () => {
      const dynamicModule = SolanaModule.register(testOptions);
      expect(dynamicModule.module).toBe(SolanaModule);
      expect(dynamicModule.providers).toBeDefined();
      expect(Array.isArray(dynamicModule.providers)).toBe(true);
      expect(dynamicModule.exports).toBeDefined();
      expect(Array.isArray(dynamicModule.exports)).toBe(true);
    });

    it('should return consistent module structure', () => {
      const module1 = SolanaModule.register(testOptions);
      const module2 = SolanaModule.register(testOptions);

      expect(module1.module).toBe(module2.module);
      expect(module1.providers?.length).toBe(module2.providers?.length);
      expect(module1.exports?.length).toBe(module2.exports?.length);
    });
  });
});
