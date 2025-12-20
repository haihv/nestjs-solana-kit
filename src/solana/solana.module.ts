import { DynamicModule, Module, Provider } from '@nestjs/common';
import {
  SolanaModuleOptions,
  SolanaModuleAsyncOptions,
  SolanaModuleOptionsFactory,
} from './interfaces/solana-module-options.interface';
import { SOLANA_MODULE_OPTIONS } from './constants/solana.constants';
import {
  SolanaAccountService,
  SolanaAddressService,
  SolanaAuthorityService,
  SolanaBlockService,
  SolanaConfigService,
  SolanaProgramService,
  SolanaRpcService,
  SolanaSubscriptionService,
  SolanaTransactionService,
  SolanaUtilsService,
} from './services';

@Module({})
export class SolanaModule {
  /**
   * Register the Solana module synchronously with static options
   * @param options Solana module configuration options
   * @returns Dynamic module
   *
   * @example
   * ```typescript
   * SolanaModule.register({
   *   rpcUrl: 'https://api.devnet.solana.com',
   *   cluster: 'devnet',
   *   commitment: 'confirmed',
   * })
   * ```
   */
  static register(options: SolanaModuleOptions): DynamicModule {
    return {
      module: SolanaModule,
      providers: [
        {
          provide: SOLANA_MODULE_OPTIONS,
          useValue: options,
        },
        SolanaAccountService,
        SolanaAddressService,
        SolanaAuthorityService,
        SolanaBlockService,
        SolanaConfigService,
        SolanaProgramService,
        SolanaRpcService,
        SolanaSubscriptionService,
        SolanaTransactionService,
        SolanaUtilsService,
      ],
      exports: [
        SolanaAccountService,
        SolanaAddressService,
        SolanaAuthorityService,
        SolanaBlockService,
        SolanaConfigService,
        SolanaProgramService,
        SolanaRpcService,
        SolanaSubscriptionService,
        SolanaTransactionService,
        SolanaUtilsService,
      ],
    };
  }

  /**
   * Register the Solana module asynchronously with dynamic options
   * @param options Async configuration options
   * @returns Dynamic module
   *
   * @example
   * ```typescript
   * SolanaModule.registerAsync({
   *   imports: [ConfigModule],
   *   useFactory: (configService: ConfigService) => ({
   *     rpcUrl: configService.get('SOLANA_RPC_URL'),
   *     cluster: configService.get('SOLANA_CLUSTER'),
   *     commitment: 'confirmed',
   *   }),
   *   inject: [ConfigService],
   * })
   * ```
   */
  static registerAsync(options: SolanaModuleAsyncOptions): DynamicModule {
    return {
      module: SolanaModule,
      imports: options.imports || [],
      providers: [
        ...this.createAsyncProviders(options),
        SolanaAccountService,
        SolanaAddressService,
        SolanaAuthorityService,
        SolanaBlockService,
        SolanaConfigService,
        SolanaProgramService,
        SolanaRpcService,
        SolanaSubscriptionService,
        SolanaTransactionService,
        SolanaUtilsService,
      ],
      exports: [
        SolanaAccountService,
        SolanaAddressService,
        SolanaAuthorityService,
        SolanaBlockService,
        SolanaConfigService,
        SolanaProgramService,
        SolanaRpcService,
        SolanaSubscriptionService,
        SolanaTransactionService,
        SolanaUtilsService,
      ],
    };
  }

  private static createAsyncProviders(
    options: SolanaModuleAsyncOptions,
  ): Provider[] {
    if (options.useExisting || options.useFactory) {
      return [this.createAsyncOptionsProvider(options)];
    }

    return [
      this.createAsyncOptionsProvider(options),
      {
        provide: options.useClass!,
        useClass: options.useClass!,
      },
    ];
  }

  private static createAsyncOptionsProvider(
    options: SolanaModuleAsyncOptions,
  ): Provider {
    if (options.useFactory) {
      return {
        provide: SOLANA_MODULE_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }

    return {
      provide: SOLANA_MODULE_OPTIONS,
      useFactory: async (optionsFactory: SolanaModuleOptionsFactory) =>
        await optionsFactory.createSolanaModuleOptions(),
      inject: [options.useExisting || options.useClass!],
    };
  }
}
