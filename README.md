# NestJS Module for Solana Kit

[![Test & Build](https://github.com/haihv/nestjs-solana-kit/actions/workflows/test.yml/badge.svg)](https://github.com/haihv/nestjs-solana-kit/actions/workflows/test.yml)
[![npm version](https://badge.fury.io/js/nestjs-solana-kit.svg)](https://badge.fury.io/js/nestjs-solana-kit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Type-safe NestJS integration for Solana blockchain with `@solana/kit` v5.x. Provides ready-to-use services for accounts, transactions, blocks, programs, and real-time subscriptions with full TypeScript support and dependency injection.

## Features

- **Modern SDK Integration**: Built on `@solana/kit` v5.x (Solana's new modular web3.js architecture) with full TypeScript support
- **Type-Safe with Derived Types**: All types are automatically derived from `@solana/kit` using TypeScript utility types (ReturnType, Awaited, Omit, etc.), ensuring perfect compatibility and automatic updates when the SDK changes
- **NestJS Native**: Designed for NestJS with dependency injection and module configuration
- **High-Level API**: Simplified methods for common Solana operations
- **Comprehensive Services**:
  - Connection management
  - Account queries and balance checks
  - Block and slot information
  - Transaction building, sending, and confirmation with automatic retry logic
  - Program interactions and instruction creation
  - WebSocket subscriptions for real-time updates
- **Flexible Configuration**: Both static and async module registration
- **Production Ready**: Built-in error handling, logging, and retry mechanisms

## Type Safety & Derivation

This library takes a unique approach to type safety by **deriving all types directly from `@solana/kit`** rather than manually redefining them. This ensures:

- ✅ **Perfect compatibility** - Types always match the actual SDK behavior
- ✅ **Automatic updates** - When `@solana/kit` updates, types update automatically
- ✅ **Zero drift** - No manual type maintenance or version sync issues
- ✅ **IDE support** - Full autocomplete and type checking from the official SDK

### Examples of Type Derivation

```typescript
// AccountInfo: Derived by combining base types from @solana/kit
export type AccountInfo = AccountInfoBase & AccountInfoWithBase64EncodedData;

// BlockhashInfo: Extracted from API return type
export type BlockhashInfo = ReturnType<GetLatestBlockhashApi['getLatestBlockhash']>['value'];

// BlockInfo variants: Base type + specific transaction details
export type BlockInfo = Omit<NonNullable<ReturnType<GetBlockApi['getBlock']>>, 'transactions'>;
export type BlockInfoWithSignatures = BlockInfo & { signatures: readonly Base58EncodedBytes[] };
export type BlockInfoWithTransactions = BlockInfo & { transactions: readonly TransactionForFullBase58<void>[] };

// Subscription types: Direct from notification APIs
export type AccountNotification = SolanaRpcResponse<AccountInfo>;
export type SignatureNotification = ReturnType<SignatureNotificationsApi['signatureNotifications']>;
```

### Generic Type Support

The library uses TypeScript generics to provide context-aware return types:

```typescript
// getBlock returns different types based on the includeTransactions parameter
const blockWithTxs = await solanaBlock.getBlock(slot, true);   // BlockInfoWithTransactions
const blockWithSigs = await solanaBlock.getBlock(slot, false); // BlockInfoWithSignatures
```

## Installation

```bash
# npm
npm install nestjs-solana-kit @solana/kit

# yarn
yarn add nestjs-solana-kit @solana/kit

# pnpm
pnpm add nestjs-solana-kit @solana/kit
```

**Peer Dependencies:**
- `@nestjs/common` (^10.0.0 || ^11.0.0) - NestJS framework
- `@nestjs/core` (^10.0.0 || ^11.0.0) - NestJS core
- `reflect-metadata` (^0.1.13 || ^0.2.0) - Reflection metadata
- `rxjs` (^7.0.0) - Reactive extensions

**Note:** This library supports both NestJS v10 and v11. Development uses the latest v11 for best DX while maintaining backward compatibility with v10.

## Quick Start

### 1. Static Module Registration

For simple applications with hardcoded configuration:

```typescript
import { Module } from '@nestjs/common';
import { SolanaModule } from 'nestjs-solana-kit';

@Module({
  imports: [
    SolanaModule.register({
      rpcUrl: 'https://api.devnet.solana.com',
      cluster: 'devnet',
      commitment: 'confirmed',
    }),
  ],
})
export class AppModule {}
```

### 2. Async Module Registration

For applications using `ConfigModule` or dynamic configuration:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SolanaModule } from 'nestjs-solana-kit';

@Module({
  imports: [
    ConfigModule.forRoot(),
    SolanaModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        rpcUrl: configService.get('SOLANA_RPC_URL'),
        cluster: configService.get('SOLANA_CLUSTER'),
        commitment: 'confirmed',
        wsUrl: configService.get('SOLANA_WS_URL'),
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

## Documentation

- **[Services Reference](./docs/SERVICES.md)** - Complete API documentation for all services and configuration options

## CI/CD & Publishing

This repository uses GitHub Actions for automated testing and publishing:

- **Test Workflow** (`test.yml`): Runs on every push and pull request
  - Tests on Node 18 and 20
  - Linting, unit tests, and build verification
  - Code coverage reports uploaded to Codecov

- **Publish Workflow** (`publish.yml`): Triggered on version tags (v*.*.*)
  - Runs full test suite before publishing
  - Automatically publishes to npm
  - Creates GitHub releases

### Publishing a New Version

```bash
# 1. Create and push a version tag
git tag v0.2.0
git push origin v0.2.0

# GitHub Actions will automatically:
# - Run all tests
# - Build the package
# - Publish to npm
# - Create a GitHub release
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate test coverage
npm run test:cov

# Lint code
npm run lint

# Format code
npm run format

# Build package
npm run build
```

## License

MIT
