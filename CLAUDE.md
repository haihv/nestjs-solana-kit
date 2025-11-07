# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NestJS Solana Kit is a comprehensive NestJS library for Solana blockchain integration built on `@solana/kit` v5.x. This is a **library package** designed to be published to npm and consumed by other NestJS applications.

**Key Characteristics:**
- **Solana SDK Version:** @solana/kit v5.x (latest modular SDK)
- **NestJS Support:** v10.0.0+ and v11.0.0+ (backward compatible)
- **Node.js Support:** 18+, 20+, 24+ (LTS versions)
- **Development:** Latest tools (NestJS v11, Jest 30, TypeScript 5.9)
- **Type Safety:** Strict mode enabled with derived types from @solana/kit

## Build & Development Commands

```bash
# Build the library (outputs to dist/)
pnpm build

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:cov

# Lint and auto-fix
pnpm lint

# Format code
pnpm format
```

**Testing a single service:**
```bash
pnpm test -- solana-account.service.spec.ts
pnpm test -- --testNamePattern="getBalance"
```

## Architecture

### Module Structure

The library follows NestJS dynamic module pattern with both sync and async registration:

```typescript
// Synchronous registration
SolanaModule.register({
  rpcUrl: 'https://api.devnet.solana.com',
  cluster: 'devnet',
  commitment: 'confirmed',
})

// Asynchronous registration (with ConfigService)
SolanaModule.registerAsync({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => ({
    rpcUrl: configService.get('SOLANA_RPC_URL'),
    cluster: configService.get('SOLANA_CLUSTER'),
  }),
  inject: [ConfigService],
})
```

The module injects `SOLANA_MODULE_OPTIONS` token and exports 7 services:
- **SolanaRpcService** - Core RPC client management
- **SolanaAccountService** - Account queries and balances
- **SolanaBlockService** - Block and epoch information
- **SolanaTransactionService** - Transaction operations
- **SolanaSubscriptionService** - WebSocket subscriptions
- **SolanaUtilsService** - Conversion utilities (legacy ↔ kit)
- **SolanaProgramService** - Program queries

### Service Dependencies

```
SolanaConfigService (configuration center)
│
├── SolanaRpcService (depends on SolanaConfigService)
│   ├── SolanaAccountService
│   ├── SolanaBlockService
│   │   └── SolanaTransactionService
│   ├── SolanaProgramService
│   └── SolanaUtilsService (depends on SolanaBlockService for blockhashes)
│
└── SolanaSubscriptionService (depends on SolanaConfigService directly)
    └── SolanaUtilsService
```

**Architecture Notes:**
- `SolanaConfigService` centralizes all configuration management (cluster, RPC URL, commitment, WebSocket URL)
- All services access configuration via the config service instead of embedding config logic
- Uses getter-based API for clean, idiomatic TypeScript (`clusterName`, `rpcUrl`, `commitment`, `wsUrl`, `options`)
- All services depend on either `SolanaRpcService` or `SolanaConfigService` for configuration access

## Type System Architecture

### Type Derivation Strategy

**Critical principle:** All types in `src/solana/types/rpc.types.ts` are **derived from @solana/kit v5.x** using TypeScript utility types. Never manually redefine types.

**Derivation patterns:**

```typescript
// Combine base types
export type AccountInfo = AccountInfoBase & AccountInfoWithBase64EncodedData;

// Extract from API return types
export type BlockhashInfo = ReturnType<GetLatestBlockhashApi['getLatestBlockhash']>['value'];

// Use Omit to create base types
export type BlockInfo = Omit<NonNullable<ReturnType<GetBlockApi['getBlock']>>, 'transactions'>;

// Extend base types for variants
export type BlockInfoWithSignatures = BlockInfo & { signatures: readonly Base58EncodedBytes[] };
export type BlockInfoWithTransactions = BlockInfo & { transactions: readonly TransactionForFullBase58<void>[] };

// Direct from notification APIs
export type SignatureNotification = ReturnType<SignatureNotificationsApi['signatureNotifications']>;
```

**Why this matters:**
- Types automatically update when `@solana/kit` updates
- Perfect compatibility with SDK behavior
- Zero type drift
- No manual maintenance

### Generic Type Safety

Some services use conditional types for type-safe returns based on parameters:

```typescript
// In SolanaBlockService
async getBlock<T extends boolean>(
  slot: Slot,
  includeTransactions = true as T,
): Promise<
  | (T extends true ? BlockInfoWithTransactions : BlockInfoWithSignatures)
  | null
>
```

This provides compile-time type safety - the return type changes based on the `includeTransactions` parameter.

## Naming Conventions

### Variables and Methods

**Use "Args" suffix for parameter types (not "Config", "Options", "Params"):**

```typescript
// Correct
export type BuildTransactionArgs = { ... }
export type SendTransactionArgs = { ... }

// Incorrect (old pattern)
export type BuildTransactionConfig = { ... }
export type SendTransactionOptions = { ... }
```

This is a project-wide standard established to maintain consistency across all service methods.

### Service Method Patterns

- **get*** - Fetches data (getBalance, getAccountInfo, getBlock)
- **send*** - Sends transactions (sendTransaction, sendAndConfirm)
- **on*** - WebSocket subscriptions (onAccountChange, onSlotChange)
- **build*** - Transaction building (buildTransaction, buildTransactionWithBlockhash)
- **is*** - Boolean checks (isHealthy, isProgramDeployed)

## Key Implementation Details

### Configuration API (SolanaConfigService)

`SolanaConfigService` provides a clean getter-based API for accessing Solana configuration:

```typescript
// Getter-based API (idiomatic TypeScript)
configService.clusterName        // Returns: SolanaCluster ('devnet' | 'testnet' | 'mainnet-beta' | ...)
configService.rpcUrl             // Returns: string
configService.wsUrl              // Returns: string | undefined
configService.commitment         // Returns: string ('confirmed' | 'finalized' | 'processed')
configService.options            // Returns: SolanaModuleOptions (complete config object)
```

**Usage in services:**
```typescript
constructor(private readonly configService: SolanaConfigService) {
  const rpc = createSolanaRpc(this.configService.rpcUrl);
  this.logger.log(`Connected to ${this.configService.clusterName}`);
}
```

**Note:** Development phase - no deprecated method variants. Use getters directly.

### RPC Service Naming

The core connection service is named **SolanaRpcService** (not SolanaConnectionService) to align with @solana/kit terminology. All variable names follow this pattern:

```typescript
// Correct
constructor(private readonly rpcService: SolanaRpcService) {}

// Incorrect (old pattern)
constructor(private readonly connectionService: SolanaConnectionService) {}
```

**RPC Service API:**
```typescript
rpcService.instance              // Getter: Returns the @solana/kit RPC instance
rpcService.getRpc()              // Method: Delegates to instance getter
```

### Subscription Service Implementation

The subscription service uses @solana/kit v5 async iterables with **no type assertions**:

```typescript
// Correct - properly typed with encoding parameter
const iterable = await this.subscriptions!.accountNotifications(
  addr,
  { encoding: 'base64' },
).subscribe({ abortSignal: abortController.signal });

// Incorrect - old pattern with unsafe cast
const iterable = await (this.subscriptions as any)!
  .accountNotifications(addr)
  .subscribe({ abortSignal: abortController.signal });
```

Always specify `{ encoding: 'base64' }` for account and program subscriptions to ensure consistent data format.

### Transaction Building

Two approaches for building transactions:

1. **buildTransaction()** - Auto-fetches latest blockhash (recommended for single transactions)
2. **buildTransactionWithBlockhash()** - Requires explicit blockhash (for batching multiple transactions with shared blockhash)

The Utils service handles conversions between legacy `@solana/web3.js` v1.x types and modern `@solana/kit` v5.x types.

## Type Isolation Strategy

Types are organized by usage:

- **Shared RPC types**: `src/solana/types/rpc.types.ts` - Used across multiple services
- **Service-specific types**: Exported directly from service files (e.g., transaction types in `SolanaTransactionService`)

When a type is only used in a single service, define it in that service file, not in a shared types directory.

## Documentation Standards

### JSDoc Requirements

All exported types in `rpc.types.ts` must include:
- How the type is derived from @solana/kit
- What the type represents
- Key properties/structure
- Usage examples for complex types

Example:
```typescript
/**
 * Account change notification
 *
 * Derived from @solana/kit using SolanaRpcResponse wrapper with AccountInfo.
 * This type represents real-time notifications received when subscribed accounts change.
 *
 * Structure:
 * - context: { slot } - The slot in which the account update occurred
 * - value: AccountInfo - The updated account information with base64-encoded data
 *
 * @example
 * solanaSubscription.onAccountChange(address, (notification) => {
 *   console.log('Account updated at slot:', notification.context.slot);
 * });
 */
export type AccountNotification = SolanaRpcResponse<AccountInfo>;
```

### Service Method Comments

Methods should document:
- Purpose
- Key parameters (especially config objects with "Args" suffix)
- Return value meaning
- Examples for complex operations

## Version References

Always refer to:
- `@solana/kit` as **v5.x** (latest modular SDK)
- `@solana/web3.js` as **v1.x** (legacy SDK, for compat only)
- `@nestjs/common` & `@nestjs/core` as **v10+ and v11+** (dual support)

The project uses `@solana/kit` v5.x which is built on Solana's new modular web3.js architecture.

**Version Support Matrix:**
- **Development (devDependencies):** Latest versions for best DX
  - NestJS v11, Jest 30, TypeScript 5.9
- **Production (peerDependencies):** Support v10+ and v11+ for backward compatibility
- **Runtime (dependencies):** @solana/kit v5.x, @solana/compat v5.x
- **Target (Node.js):** 18.x, 20.x, 24.x LTS

## Readonly Modifiers

All type properties should use `readonly` modifier following @solana/kit conventions:

```typescript
// Correct
export type BlockInfo = {
  readonly blockHeight: bigint;
  readonly blockhash: string;
};

// Incorrect
export type BlockInfo = {
  blockHeight: bigint;
  blockhash: string;
};
```

## CI/CD & Publishing Workflows

The repository uses GitHub Actions for automated testing and publishing:

### Test Workflow (`.github/workflows/test.yml`)
- Triggers on push to main/develop and pull requests
- Tests on Node 18 and 20
- Runs: linting → tests → build → coverage upload
- All tests must pass before merging to main

### Publish Workflow (`.github/workflows/publish.yml`)
- Triggers on git tags matching `v*.*.*` (e.g., v0.1.0)
- Runs full test suite as safety check
- Publishes to npm automatically
- Creates GitHub release with version info
- Requires `NPM_TOKEN` secret configured

### Publishing Process
1. Update version in `package.json`
2. Create and push a git tag: `git tag v0.2.0 && git push origin v0.2.0`
3. GitHub Actions automatically handles publishing
4. Verify on https://www.npmjs.com/package/nestjs-solana-kit

## Git Workflow

When creating commits or PRs:
- Do NOT commit changes unless explicitly requested by the user
- Do NOT stage changes automatically
- Always let the user review changes before committing
- Use `pnpm build` and `pnpm test` to verify changes before user review
- Ensure all changes pass CI before user approves

## Testing Strategy

### Test Organization

All services have corresponding `.spec.ts` test files in `src/solana/services/`:
- Each service is tested independently with mocked dependencies
- Tests follow NestJS Testing Module pattern for dependency injection
- Full coverage of success paths, error paths, and edge cases

### Test Patterns

**Mock Services:**
```typescript
// Example: Mocking SolanaConfigService for tests
const mockConfigService = {
  clusterName: 'devnet',
  rpcUrl: 'https://api.devnet.solana.com',
  wsUrl: undefined,
  commitment: 'confirmed',
  options: { rpcUrl: 'https://api.devnet.solana.com', cluster: 'devnet' },
};

const module: TestingModule = await Test.createTestingModule({
  providers: [
    ServiceUnderTest,
    { provide: SolanaConfigService, useValue: mockConfigService },
    // ... other mocks
  ],
}).compile();
```

**Accessing getters in tests:**
- Use getter notation directly: `configService.clusterName` (not `configService.getCluster()`)
- Mock getters as object properties: `{ clusterName: 'devnet' }`

### Coverage Goals

Target areas for testing:
- **Success paths** - Standard operations with valid inputs
- **Error paths** - Network failures, invalid data, service unavailable scenarios
- **Edge cases** - Boundary values, empty arrays, null/undefined handling
- **Dependencies** - Verify correct service communication and delegation

## Dependencies

Key dependencies and their purposes:
- `@solana/kit` (v4.x) - Core Solana SDK with modular architecture
- `@solana/compat` (v4.x) - Compatibility layer between legacy and modern SDKs
- `@solana/web3.js` (v1.x) - Legacy SDK for backwards compatibility in Utils service
- `@nestjs/common`, `@nestjs/core` (v10-11) - Peer dependencies for NestJS integration
- Always check with the best pratices for the current cases before deside to using any approach
- Always follow the Nestjs best practices, if I want to do something in the other approachs let warning me first, before execute the editing