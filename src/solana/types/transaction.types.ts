import type {
  GetSignaturesForAddressApi,
  GetSignatureStatusesApi,
  GetTransactionApi,
  SendableTransaction,
  SimulateTransactionApi,
  Transaction,
  TransactionMessage,
  TransactionMessageWithBlockhashLifetime,
  TransactionMessageWithFeePayer,
  TransactionWithLifetime,
} from '@solana/kit';

/**
 * Transaction types for Solana transaction operations
 *
 * All types are derived from @solana/kit v5.x to ensure perfect compatibility
 * and automatic updates when the SDK changes.
 */

/**
 * Built transaction message ready for signing
 *
 * Derived by combining @solana/kit base types:
 * - TransactionMessage: Base transaction structure
 * - TransactionMessageWithFeePayer: Has fee payer set
 * - TransactionMessageWithBlockhashLifetime: Has blockhash lifetime set
 *
 * This type represents a complete transaction message that has:
 * - Instructions to execute
 * - Fee payer address configured
 * - Blockhash and lastValidBlockHeight set
 *
 * Next step: Sign with `signTransactionMessage()` to create SignedTransaction
 *
 * @example
 * ```typescript
 * const txMessage = await transactionService.buildTransactionMessage({
 *   instructions: [transferIx],
 *   feePayer: senderAddress,
 * });
 * // txMessage is BuiltTransactionMessage - ready for signing
 * ```
 */
export type BuiltTransactionMessage = TransactionMessage &
  TransactionMessageWithFeePayer &
  TransactionMessageWithBlockhashLifetime;

/**
 * Signed transaction ready to send to the network
 *
 * Derived by combining @solana/kit base types:
 * - SendableTransaction: Can be encoded and sent to RPC
 * - Transaction: Core transaction structure with signatures
 * - TransactionWithLifetime: Has lifetime constraints (blockhash/durable nonce)
 *
 * This type represents a fully signed transaction that:
 * - Has all required signatures applied
 * - Can be serialized for network transmission
 * - Has lifetime constraints to prevent replay attacks
 *
 * Use with `sendTransaction()` to broadcast to the network
 *
 * @example
 * ```typescript
 * const signedTx = await transactionService.signTransactionMessage(
 *   txMessage,
 *   [signer1, signer2]
 * );
 * // signedTx is SignedTransaction - ready to send
 * const signature = await transactionService.sendTransaction(signedTx);
 * ```
 */
export type SignedTransaction = SendableTransaction &
  Transaction &
  TransactionWithLifetime;

/**
 * Transaction simulation result
 *
 * Derived from @solana/kit's SimulateTransactionApi return value.
 * Represents the outcome of simulating a transaction without actually
 * committing it to the blockchain.
 *
 * Structure includes:
 * - err: Error information if simulation failed, null if successful
 * - logs: Program execution logs (useful for debugging)
 * - unitsConsumed: Compute units consumed by the transaction
 * - accounts: Account states after simulation (if requested)
 * - returnData: Program return data (if any)
 *
 * Use this to validate transactions before sending them to avoid fees
 * from failed transactions.
 *
 * @example
 * ```typescript
 * const encodedTx = transactionService.encodeTransaction(signedTx);
 * const simulation = await transactionService.simulateTransaction(encodedTx);
 *
 * if (simulation.err) {
 *   console.error('Simulation failed:', simulation.err);
 *   console.log('Logs:', simulation.logs);
 * } else {
 *   console.log('Simulation successful, units consumed:', simulation.unitsConsumed);
 * }
 * ```
 */
export type SimulateTransactionResult = ReturnType<
  SimulateTransactionApi['simulateTransaction']
>['value'];

/**
 * Array of signature information for an address
 *
 * Derived from @solana/kit's GetSignaturesForAddressApi return type.
 * Each entry contains metadata about a transaction that involved the address.
 *
 * Each signature entry includes:
 * - signature: Transaction signature (unique identifier)
 * - slot: Slot in which transaction was processed
 * - err: Error information if transaction failed
 * - memo: Optional memo string
 * - blockTime: Unix timestamp of the block (nullable)
 * - confirmationStatus: Confirmation level (processed/confirmed/finalized)
 *
 * @example
 * ```typescript
 * const signatures = await transactionService.getSignaturesForAddress(
 *   walletAddress,
 *   10 // limit
 * );
 *
 * signatures.forEach(sig => {
 *   console.log(`Signature: ${sig.signature}`);
 *   console.log(`Slot: ${sig.slot}`);
 *   console.log(`Status: ${sig.confirmationStatus}`);
 *   console.log(`Failed: ${sig.err !== null}`);
 * });
 * ```
 */
export type GetSignaturesForAddressResult = ReturnType<
  GetSignaturesForAddressApi['getSignaturesForAddress']
>;

/**
 * Transaction status information
 *
 * Derived from @solana/kit's GetSignatureStatusesApi return type.
 * Represents the current status of a transaction on the blockchain.
 *
 * Structure includes:
 * - slot: Slot in which transaction was processed
 * - confirmations: Number of confirmations (null when finalized)
 * - err: Error information if transaction failed, null if successful
 * - confirmationStatus: 'processed' | 'confirmed' | 'finalized'
 *
 * Confirmation levels:
 * - processed: Transaction included in a block, may be rolled back
 * - confirmed: Transaction confirmed by supermajority of cluster
 * - finalized: Transaction finalized by supermajority, cannot be rolled back
 *
 * @example
 * ```typescript
 * const status = await transactionService.getTransactionStatus(signature);
 *
 * if (!status) {
 *   console.log('Transaction not found');
 * } else if (status.err) {
 *   console.error('Transaction failed:', status.err);
 * } else {
 *   console.log(`Transaction ${status.confirmationStatus} at slot ${status.slot}`);
 * }
 * ```
 */
export type TransactionStatus = NonNullable<
  ReturnType<GetSignatureStatusesApi['getSignatureStatuses']>['value'][0]
>;

/**
 * Full transaction details
 *
 * Derived from @solana/kit's GetTransactionApi return type.
 * Contains complete transaction information including metadata and decoded instructions.
 *
 * Returns null if transaction is not found or has been pruned from history.
 *
 * Structure varies based on encoding requested:
 * - 'json': Human-readable JSON format
 * - 'jsonParsed': JSON with parsed instructions (recommended)
 * - 'base64': Raw base64-encoded transaction
 *
 * When using 'jsonParsed' encoding, known program instructions are automatically
 * decoded with human-readable field names and values.
 *
 * @example
 * ```typescript
 * const tx = await transactionService.getTransaction(signature);
 *
 * if (tx) {
 *   console.log('Block time:', tx.blockTime);
 *   console.log('Slot:', tx.slot);
 *   console.log('Fee:', tx.meta?.fee);
 *   console.log('Success:', tx.meta?.err === null);
 * } else {
 *   console.log('Transaction not found or pruned');
 * }
 * ```
 */
export type GetTransactionResult = ReturnType<
  GetTransactionApi['getTransaction']
>;
