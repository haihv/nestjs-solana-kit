/**
 * Centralized test fixtures and constants for Solana service tests
 * This file provides reusable test data, mock objects, and factory functions
 * to ensure consistency across all test suites
 */

// ============================================================================
// ADDRESS CONSTANTS
// ============================================================================

/**
 * Common Solana addresses used across tests
 * These represent well-known programs and accounts on the Solana network
 */
export const TEST_ADDRESSES = {
  /** System Program - used for basic account operations */
  SYSTEM_PROGRAM: '11111111111111111111111111111111' as const,
  /** Token Program - used for SPL token operations */
  TOKEN_PROGRAM: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as const,
  /** USDC Mint - a common SPL token for testing */
  USDC_MINT: 'EPjFWaJsv6DjsSuaT4jXfVfuE3axYR4MdNKWcqTPqe8t' as const,
  /** Associated Token Program - used for ATA operations */
  ASSOCIATED_TOKEN_PROGRAM:
    'ATokenGPvbdGVqstBssXNB8ghrT8K3tLj7Hu618hF6ty' as const,
  /** BPF Loader - used for program deployment */
  BPF_LOADER: 'BPFLoader1111111111111111111111111111111111' as const,
} as const;

// ============================================================================
// SIGNATURE CONSTANTS
// ============================================================================

/**
 * Valid Solana signatures for testing
 * These are properly formatted 88-character base58 encoded transaction signatures
 */
export const TEST_SIGNATURES = {
  /** Primary test signature */
  MAIN: '4sGjMKvzttesJQgRHDDMyHVHJJ7TqSYVgv3vhbvVWX8vDM98tKfNGzAvzVdq9XhAD4y7FVJSuZXvZ1qx3hJXWMKs' as const,
  /** Secondary test signature for comparison tests */
  SECONDARY:
    '5kJt5h2B3p6kAMPxQqvYXvyfZ87Z84qxdjQbaVkj2rN6zGyFNR7fsRG3Gzdhvj1io8GZF1dgNpTi27CybBZhECXp' as const,
  /** Third test signature */
  TERTIARY:
    '8kJt5h2B3p6kAMPxQqvYXvyfZ87Z84qxdjQbaVkj2rN6zGyFNR7fsRG3Gzdhvj1io8GZF1dgNpTi27CybBZhECXp' as const,
} as const;

// ============================================================================
// CLUSTER & RPC OPTIONS
// ============================================================================

/**
 * Common RPC options configuration for different Solana clusters
 * Uses official Solana public RPC endpoints: https://solana.com/rpc
 */
export const TEST_RPC_OPTIONS = {
  /** Mainnet-beta configuration - production cluster (finalized commitment) */
  MAINNET: {
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    cluster: 'mainnet-beta',
    commitment: 'finalized',
  } as const,
  /** Devnet configuration - development and testing cluster */
  DEVNET: {
    rpcUrl: 'https://api.devnet.solana.com',
    cluster: 'devnet',
    commitment: 'confirmed',
  } as const,
  /** Testnet configuration - testing cluster */
  TESTNET: {
    rpcUrl: 'https://api.testnet.solana.com',
    cluster: 'testnet',
    commitment: 'confirmed',
  } as const,
  /** Local cluster configuration - for local development and validators */
  LOCALNET: {
    rpcUrl: 'http://localhost:8899',
    cluster: 'localnet',
    commitment: 'confirmed',
  } as const,
  /** Invalid RPC configuration - for testing unhealthy RPC connections */
  INVALIDNET: {
    rpcUrl: 'http://invalid-rpc-endpoint-that-does-not-exist.example.com:9999',
    cluster: 'localnet',
    commitment: 'confirmed',
  } as const,
} as const;

// ============================================================================
// MOCK RESPONSE FACTORIES
// ============================================================================

/**
 * Creates a pending RPC response mock
 * RPC methods return pending responses with a send() method
 *
 * @example
 * const response = createPendingResponse({ value: BigInt(1000000000) });
 * // response.send() will resolve to { value: BigInt(1000000000) }
 */
/* istanbul ignore next */
export const createPendingResponse = <T>(value: T) => ({
  send: jest.fn().mockResolvedValue(value),
});

// ============================================================================
// TEST DATA CONSTANTS
// ============================================================================

/**
 * Common account roles for instruction accounts
 * Maps role numbers to their legacy flag equivalents
 */
export const ACCOUNT_ROLES = {
  /** Read-only account */
  READONLY: 0,
  /** Read-only signer */
  READONLY_SIGNER: 1,
  /** Writable account */
  WRITABLE: 2,
  /** Writable signer */
  WRITABLE_SIGNER: 3,
} as const;

/**
 * Common slot/block height values for testing
 */
export const TEST_SLOTS = {
  /** Default current slot */
  CURRENT: BigInt(123456),
  /** Later slot for comparison */
  LATER: BigInt(250000000),
  /** Much earlier slot for historical queries */
  HISTORICAL: BigInt(1000),
} as const;

/**
 * Common lamport amounts for testing
 */
export const TEST_LAMPORTS = {
  /** 1 SOL in lamports */
  ONE_SOL: BigInt(1000000000),
  /** 2 SOL in lamports */
  TWO_SOL: BigInt(2000000000),
  /** 5 SOL in lamports (common minimum balance) */
  FIVE_SOL: BigInt(5000000000),
  /** Rent exempt amount for empty accounts */
  RENT_EXEMPT: BigInt(890880),
} as const;

// ============================================================================
// HELPER TYPE EXPORTS
// ============================================================================

/** Type-safe address constant */
export type TestAddress = (typeof TEST_ADDRESSES)[keyof typeof TEST_ADDRESSES];

/** Type-safe signature constant */
export type TestSignature =
  (typeof TEST_SIGNATURES)[keyof typeof TEST_SIGNATURES];

/** Type-safe RPC options */
export type TestRpcOptions =
  (typeof TEST_RPC_OPTIONS)[keyof typeof TEST_RPC_OPTIONS];
