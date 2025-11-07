/**
 * Solana RPC Types
 *
 * This file contains all RPC-related type definitions derived from @solana/kit v4.x using TypeScript
 * utility types (ReturnType, Awaited, Omit, etc.) to ensure type safety and compatibility with
 * the official @solana/kit SDK.
 *
 * Type Categories:
 * - RPC Client Types: SolanaRpc, SolanaRpcSubscriptions
 * - RPC Response Types: AccountInfo, BlockhashInfo, BlockInfo variants, EpochInfo
 * - Subscription Notification Types: AccountNotification, SignatureNotification, etc.
 * - Configuration Types: ClusterConfig
 *
 * Type Derivation Strategy:
 * All types are derived using TypeScript utility types to extract exact type definitions from
 * @solana/kit APIs. This approach ensures:
 * - Type safety: Types automatically update with @solana/kit library updates
 * - Consistency: Types match the actual runtime behavior from @solana/kit
 * - Maintainability: Eliminates manual type redefinition and reduces drift
 *
 * @see https://github.com/solana-labs/solana-web3.js/tree/master/packages
 */

import type {
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  AccountInfoBase,
  AccountInfoWithBase64EncodedData,
  GetLatestBlockhashApi,
  GetBlockApi,
  GetEpochInfoApi,
  SolanaRpcResponse,
  SignatureNotificationsApi,
  AccountInfoWithPubkey,
  LogsNotificationsApi,
  Base58EncodedBytes,
  TransactionForFullBase58,
  SlotNotificationsApi,
} from '@solana/kit';

// ============================================================================
// RPC Client Types
// ============================================================================

/**
 * Solana RPC client type
 *
 * Derived from @solana/kit createSolanaRpc factory function using ReturnType utility.
 * This type represents the RPC client instance used for making JSON-RPC calls to Solana nodes.
 *
 * The client provides methods for:
 * - Account operations (getAccountInfo, getMultipleAccounts, etc.)
 * - Block operations (getBlock, getBlockHeight, getLatestBlockhash, etc.)
 * - Transaction operations (sendTransaction, getTransaction, simulateTransaction, etc.)
 * - And many more Solana RPC methods
 *
 * Each method returns a pending call object with a .send() method for execution.
 *
 * @see https://github.com/solana-labs/solana-web3.js/tree/master/packages/rpc
 */
export type SolanaRpc = ReturnType<typeof createSolanaRpc>;

/**
 * Solana RPC subscriptions client type
 *
 * Derived from @solana/kit createSolanaRpcSubscriptions factory function using ReturnType utility.
 * This type represents the WebSocket subscriptions client for real-time updates from Solana nodes.
 *
 * The client provides subscription methods for:
 * - Account changes (accountNotifications)
 * - Program account changes (programNotifications)
 * - Signature status updates (signatureNotifications)
 * - Slot changes (slotNotifications)
 * - Logs (logsNotifications)
 * - And other real-time notifications
 *
 * Each subscription method returns an async iterable that yields notifications.
 *
 * @see https://github.com/solana-labs/solana-web3.js/tree/master/packages/rpc-subscriptions
 */
export type SolanaRpcSubscriptions = ReturnType<
  typeof createSolanaRpcSubscriptions
>;

// ============================================================================
// RPC Response Types
// ============================================================================

/**
 * Account information with base64-encoded data
 *
 * Derived from @solana/kit by combining AccountInfoBase and AccountInfoWithBase64EncodedData.
 * This type represents account data returned by getAccountInfo and related methods when
 * using base64 encoding (the default for this library).
 *
 * Properties include:
 * - data: Account data as base64-encoded string
 * - executable: Whether the account contains a program
 * - lamports: Account balance in lamports
 * - owner: Public key of the program that owns this account
 * - rentEpoch: Epoch at which this account will next owe rent
 * - space: Data size of the account
 */
export type AccountInfo = AccountInfoBase & AccountInfoWithBase64EncodedData;

/**
 * Blockhash information with validity window
 *
 * Derived from @solana/kit GetLatestBlockhashApi using ReturnType and value property access.
 * This type represents the response from getLatestBlockhash RPC method, containing both
 * the blockhash and its validity information for transaction lifetime.
 *
 * Properties:
 * - blockhash: A recent blockhash from the ledger
 * - lastValidBlockHeight: Last block height at which the blockhash will be valid
 *
 * Used for setting transaction lifetime when building and sending transactions.
 * Transactions must be confirmed before reaching lastValidBlockHeight or they expire.
 */
export type BlockhashInfo = ReturnType<
  GetLatestBlockhashApi['getLatestBlockhash']
>['value'];

/**
 * Base block information without transaction details
 *
 * Derived from @solana/kit GetBlockApi using Omit utility to exclude the transactions field.
 * This type contains common block metadata that's always present regardless of transactionDetails configuration.
 *
 * Base properties:
 * - blockHeight: The number of blocks beneath this block
 * - blockTime: Estimated production time as Unix timestamp
 * - blockhash: The blockhash of this block
 * - parentSlot: The slot index of this block's parent
 * - previousBlockhash: The blockhash of this block's parent
 *
 * Use BlockInfoWithSignatures or BlockInfoWithTransactions for variants with transaction data.
 */
export type BlockInfo = Omit<
  NonNullable<ReturnType<GetBlockApi['getBlock']>>,
  'transactions'
>;

/**
 * Block information with transaction signatures only
 *
 * Derived from BlockInfo with signatures array from @solana/kit Base58EncodedBytes.
 * Returned when getBlock is called with transactionDetails: 'signatures'.
 *
 * Includes all base block properties plus:
 * - signatures: Array of transaction signatures in the block
 *
 * This is a lighter-weight alternative to BlockInfoWithTransactions when you only need signatures.
 */
export type BlockInfoWithSignatures = BlockInfo & {
  signatures: readonly Base58EncodedBytes[];
};

/**
 * Block information with full transaction details
 *
 * Derived from BlockInfo with transactions array from @solana/kit TransactionForFullBase58.
 * Returned when getBlock is called with transactionDetails: 'full'.
 *
 * Includes all base block properties plus:
 * - transactions: Array of full transaction objects with metadata and message details
 *
 * Each transaction includes meta (transaction metadata) and transaction (the full transaction message).
 * Use this type when you need complete transaction information for block analysis.
 */
export type BlockInfoWithTransactions = BlockInfo & {
  transactions: readonly TransactionForFullBase58<void>[];
};

/**
 * Epoch information
 *
 * Derived from @solana/kit GetEpochInfoApi using ReturnType utility.
 * This type represents information about the current epoch on the Solana network.
 *
 * Properties:
 * - absoluteSlot: Current slot
 * - blockHeight: Current block height
 * - epoch: Current epoch
 * - slotIndex: Current slot relative to the start of the current epoch
 * - slotsInEpoch: Number of slots in the current epoch
 * - transactionCount: Total number of transactions processed without error since genesis
 *
 * Useful for understanding network timing and epoch-based mechanics.
 */
export type EpochInfo = ReturnType<GetEpochInfoApi['getEpochInfo']>;

// ============================================================================
// Subscription Notification Types
// ============================================================================

/**
 * Account change notification
 *
 * Derived from @solana/kit using SolanaRpcResponse wrapper with AccountInfo.
 * This type represents real-time notifications received when subscribed accounts change.
 *
 * Provided to accountNotifications subscription callbacks in SolanaSubscriptionService.
 * Contains updated account information whenever the account's data or lamports change.
 *
 * Structure:
 * - context: { slot } - The slot in which the account update occurred
 * - value: AccountInfo - The updated account information with base64-encoded data
 *
 * @example
 * solanaSubscription.onAccountChange(address, (notification) => {
 *   console.log('Account updated at slot:', notification.context.slot);
 *   console.log('New lamports balance:', notification.value.lamports);
 * });
 */
export type AccountNotification = SolanaRpcResponse<AccountInfo>;

/**
 * Slot change notification
 *
 * Derived from @solana/kit SlotNotificationsApi using ReturnType utility.
 * This type represents real-time notifications about slot changes on the Solana blockchain.
 *
 * Provided to slotNotifications subscription callbacks in SolanaSubscriptionService.
 * Emitted whenever a new slot is processed by the validator.
 *
 * Structure:
 * - parent: bigint - The parent slot number
 * - root: bigint - The root slot number (last finalized slot)
 * - slot: bigint - The current slot number
 *
 * Slots represent the time units in Solana (~400ms each). Each slot can contain
 * one block, but not all slots produce blocks.
 *
 * @example
 * ```typescript
 * solanaSubscription.onSlotChange((notification) => {
 *   console.log('New slot:', notification.slot);
 *   console.log('Parent slot:', notification.parent);
 *   console.log('Root (finalized) slot:', notification.root);
 * });
 * ```
 */
export type SlotNotification = ReturnType<
  SlotNotificationsApi['slotNotifications']
>;

/**
 * Signature status notification
 *
 * Derived from @solana/kit SignatureNotificationsApi using ReturnType utility.
 * This type represents real-time notifications about transaction signature confirmation status.
 *
 * Provided to signatureNotifications subscription callbacks in SolanaSubscriptionService.
 * Automatically emitted when a transaction reaches the specified commitment level.
 *
 * Used for monitoring transaction confirmation progress in real-time without polling.
 *
 * @example
 * solanaSubscription.onSignature(signature, (notification) => {
 *   console.log('Transaction confirmed at slot:', notification.context.slot);
 * });
 */
export type SignatureNotification = ReturnType<
  SignatureNotificationsApi['signatureNotifications']
>;

/**
 * Program account change notification
 *
 * Derived from @solana/kit using SolanaRpcResponse wrapper with AccountInfoWithPubkey.
 * This type represents real-time notifications when any account owned by a program changes.
 *
 * Provided to programNotifications subscription callbacks in SolanaSubscriptionService.
 * Includes both the account's public key and its updated information.
 *
 * Structure:
 * - context: { slot } - The slot in which the account update occurred
 * - value: { pubkey, account: AccountInfo } - Account public key and updated info with base64 data
 *
 * Useful for monitoring all accounts associated with a specific program (e.g., token program accounts).
 *
 * @example
 * solanaSubscription.onProgramAccountChange(programId, (notification) => {
 *   console.log('Program account changed:', notification.value.pubkey);
 *   console.log('New data:', notification.value.account.data);
 * });
 */
export type ProgramAccountNotification = SolanaRpcResponse<
  AccountInfoWithPubkey<AccountInfo>
>;

/**
 * Logs notification
 *
 * Derived from @solana/kit LogsNotificationsApi using ReturnType utility.
 * This type represents real-time notifications containing transaction log messages.
 *
 * Provided to logsNotifications subscription callbacks in SolanaSubscriptionService.
 * Contains program logs emitted during transaction execution for specified accounts.
 *
 * Useful for monitoring program execution and debugging smart contract behavior in real-time.
 *
 * @example
 * solanaSubscription.onLogs(address, (notification) => {
 *   console.log('Transaction signature:', notification.value.signature);
 *   console.log('Logs:', notification.value.logs);
 *   if (notification.value.err) {
 *     console.error('Transaction failed:', notification.value.err);
 *   }
 * });
 */
export type LogsNotification = ReturnType<
  LogsNotificationsApi['logsNotifications']
>;
