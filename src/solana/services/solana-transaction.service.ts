import { Injectable, Logger } from '@nestjs/common';
import {
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
  getSignatureFromTransaction,
  getBase64EncodedWireTransaction,
  addSignersToTransactionMessage,
} from '@solana/kit';
import type {
  Address,
  Base64EncodedWireTransaction,
  Instruction,
  SendTransactionApi,
  Signature,
  Transaction,
  TransactionSigner,
} from '@solana/kit';
import { SolanaRpcService } from './solana-rpc.service';
import { SolanaBlockService } from './solana-block.service';
import {
  BlockhashInfo,
  BuiltTransactionMessage,
  GetSignaturesForAddressResult,
  SignedTransaction,
  SimulateTransactionResult,
  TransactionStatus,
} from '../types';
import { SolanaUtilsService } from './solana-utils.service';

/**
 * Arguments for building a transaction message
 */
type BuildTransactionMessageArgs = {
  /** Instructions to include in the transaction */
  readonly instructions: Instruction[];

  /** Transaction fee payer address */
  readonly feePayer: Address | string;
};

type SendTransactionOptions = Omit<
  NonNullable<Parameters<SendTransactionApi['sendTransaction']>[1]>,
  'encoding'
>;

/**
 * Result from sendAndConfirm operation
 */
type SendAndConfirmTransactionResult = {
  /** Transaction signature */
  readonly signature: Signature;
  /** Whether transaction was confirmed or finalized */
  readonly confirmed: boolean;
  /** Slot in which transaction was confirmed (if available) */
  readonly slot?: bigint;
};

@Injectable()
export class SolanaTransactionService {
  private readonly logger = new Logger(SolanaTransactionService.name);

  constructor(
    private readonly blockService: SolanaBlockService,
    private readonly rpcService: SolanaRpcService,
    private readonly utilsService: SolanaUtilsService,
  ) {}

  /**
   * Build transaction message with automatic blockhash fetching
   *
   * Creates a complete transaction message by automatically fetching the latest
   * blockhash from the blockchain. This is the recommended method for building
   * single transactions.
   *
   * @param args Transaction building parameters
   * @param args.instructions Array of instructions to include in the transaction
   * @param args.feePayer Address that will pay transaction fees
   * @returns Built transaction message ready for signing
   *
   * @example
   * ```typescript
   * import { getTransferSolInstruction } from '@solana/kit';
   *
   * const transferIx = getTransferSolInstruction({
   *   source: senderAddress,
   *   destination: recipientAddress,
   *   amount: lamports(1000000000n), // 1 SOL
   * });
   *
   * const txMessage = await transactionService.buildTransactionMessage({
   *   instructions: [transferIx],
   *   feePayer: senderAddress,
   * });
   * ```
   */
  async buildTransactionMessage(
    args: BuildTransactionMessageArgs,
  ): Promise<BuiltTransactionMessage> {
    const latestBlockhash = await this.blockService.getLatestBlockhash();

    // Build transaction message with all instructions at once
    const transactionMessage = this.buildTransactionMessageWithBlockhash({
      ...args,
      ...latestBlockhash,
    });

    return transactionMessage;
  }

  /**
   * Build transaction message with explicit blockhash
   *
   * Creates a transaction message using a provided blockhash instead of fetching
   * a new one. This is useful when building multiple transactions that should
   * share the same blockhash for batching.
   *
   * @param args Transaction building parameters with blockhash info
   * @param args.instructions Array of instructions to include in the transaction
   * @param args.feePayer Address that will pay transaction fees
   * @param args.blockhash Recent blockhash from the cluster
   * @param args.lastValidBlockHeight Block height after which transaction expires
   * @returns Built transaction message ready for signing
   *
   * @example
   * ```typescript
   * // Get blockhash once for multiple transactions
   * const blockhashInfo = await blockService.getLatestBlockhash();
   *
   * // Build multiple transactions with same blockhash
   * const tx1 = await transactionService.buildTransactionMessageWithBlockhash({
   *   instructions: [ix1],
   *   feePayer: senderAddress,
   *   ...blockhashInfo,
   * });
   *
   * const tx2 = await transactionService.buildTransactionMessageWithBlockhash({
   *   instructions: [ix2],
   *   feePayer: senderAddress,
   *   ...blockhashInfo,
   * });
   * ```
   */
  buildTransactionMessageWithBlockhash({
    instructions,
    feePayer,
    ...blockhashInfo
  }: BuildTransactionMessageArgs & BlockhashInfo): BuiltTransactionMessage {
    // Build transaction message with all instructions at once
    const transactionMessage = pipe(
      createTransactionMessage({ version: 0 }),
      (m) =>
        setTransactionMessageFeePayer(this.utilsService.toAddress(feePayer), m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(blockhashInfo, m),
      (m) => appendTransactionMessageInstructions(instructions, m),
    );

    return transactionMessage;
  }

  /**
   * Sign a transaction message with provided signers
   *
   * Takes a built transaction message and applies signatures from all provided
   * signers. The transaction must be signed by all required parties before it
   * can be sent to the network.
   *
   * @param transactionMessage Built transaction message to sign
   * @param signers Array of transaction signers (keypairs)
   * @returns Signed transaction ready to send
   *
   * @example
   * ```typescript
   * import { generateKeyPairSigner } from '@solana/kit';
   *
   * const signer = await generateKeyPairSigner();
   *
   * const txMessage = await transactionService.buildTransactionMessage({
   *   instructions: [transferIx],
   *   feePayer: signer.address,
   * });
   *
   * const signedTx = await transactionService.signTransactionMessage(
   *   txMessage,
   *   [signer]
   * );
   * ```
   */
  async signTransactionMessage(
    transactionMessage: BuiltTransactionMessage,
    signers: TransactionSigner[],
  ): Promise<SignedTransaction> {
    const txMessageWithSigners = addSignersToTransactionMessage(
      signers,
      transactionMessage,
    );

    const signedTransaction =
      await signTransactionMessageWithSigners(txMessageWithSigners);

    return signedTransaction;
  }

  /**
   * Send a signed transaction to the network without waiting for confirmation
   *
   * Encodes and broadcasts the signed transaction to the Solana network.
   * This method returns immediately after sending, without waiting for the
   * transaction to be confirmed. Use `sendAndConfirm()` if you need to wait
   * for confirmation.
   *
   * @param signedTransaction Signed transaction to send
   * @param options Optional RPC send parameters (skipPreflight, etc.)
   * @returns Transaction signature
   *
   * @example
   * ```typescript
   * // Just send, don't wait
   * const signature = await transactionService.sendTransaction(signedTx, {
   *   skipPreflight: false,
   *   maxRetries: 3,
   * });
   *
   * console.log('Transaction sent:', signature);
   *
   * // Wait for confirmation separately if needed
   * const result = await transactionService.waitForConfirmation(
   *   signature,
   *   lastValidBlockHeight,
   * );
   * ```
   */
  async sendTransaction(
    signedTransaction: SignedTransaction,
    options?: SendTransactionOptions,
  ): Promise<Signature> {
    const encodedTx = this.encodeTransaction(signedTransaction);
    const signature = await this.sendEncoded(encodedTx, options);

    return signature;
  }

  /**
   * Send a signed transaction and wait for confirmation
   *
   * Encodes, broadcasts, and waits for the signed transaction to be confirmed
   * on the blockchain. If the transaction has a blockhash lifetime constraint,
   * will automatically detect expiration and return early.
   *
   * ## Confirmation Strategy
   *
   * The method automatically adapts based on the transaction's lifetime constraint:
   * - **With blockhash lifetime**: Uses block height for early expiration detection
   * - **Without blockhash lifetime**: Uses attempt-based polling only
   *
   * @param signedTransaction Signed transaction to send and confirm
   * @param options Optional RPC send parameters (skipPreflight, etc.)
   * @param maxAttempts Maximum number of confirmation attempts (default: 30, ~30 seconds)
   * @returns Transaction result with signature, confirmation status, and slot
   *
   * @example
   * ```typescript
   * // Send and wait for confirmation (recommended for most use cases)
   * const result = await transactionService.sendAndConfirm(signedTx, {
   *   skipPreflight: false,
   * });
   *
   * if (result.confirmed) {
   *   console.log('Transaction confirmed at slot:', result.slot);
   * } else {
   *   console.log('Transaction timed out or expired');
   * }
   * ```
   *
   * @example
   * ```typescript
   * // With custom timeout
   * const result = await transactionService.sendAndConfirm(
   *   signedTx,
   *   { maxRetries: 3 },
   *   60, // Wait up to ~60 seconds
   * );
   * ```
   */
  async sendAndConfirm(
    signedTransaction: SignedTransaction,
    options?: SendTransactionOptions,
    maxAttempts = 30,
  ): Promise<SendAndConfirmTransactionResult> {
    const encodedTx = this.encodeTransaction(signedTransaction);
    const signature = await this.sendEncoded(encodedTx, options);

    // Extract lastValidBlockHeight if available
    const lastValidBlockHeight =
      'lastValidBlockHeight' in signedTransaction.lifetimeConstraint
        ? signedTransaction.lifetimeConstraint.lastValidBlockHeight
        : undefined;

    // Wait for confirmation
    const confirmResult = await this.waitForConfirmation(
      signature,
      lastValidBlockHeight,
      maxAttempts,
    );

    return {
      signature,
      confirmed: confirmResult.confirmed,
      slot: confirmResult.slot,
    };
  }

  /**
   * Send an encoded transaction to the network
   *
   * Broadcasts a base64-encoded transaction directly to the RPC endpoint.
   * This method does not wait for confirmation - use waitForConfirmation()
   * separately if needed.
   *
   * @param encodedTransaction Base64-encoded wire transaction
   * @param options Optional RPC send parameters
   * @returns Transaction signature
   *
   * @example
   * ```typescript
   * const encodedTx = transactionService.encodeTransaction(signedTx);
   * const signature = await transactionService.sendEncoded(encodedTx);
   *
   * // Wait for confirmation separately
   * const result = await transactionService.waitForConfirmation(
   *   signature,
   *   lastValidBlockHeight
   * );
   * ```
   */
  async sendEncoded(
    encodedTransaction: Base64EncodedWireTransaction,
    options?: SendTransactionOptions,
  ): Promise<Signature> {
    try {
      const rpc = this.rpcService.rpc;
      const signature = await rpc
        .sendTransaction(encodedTransaction, {
          ...options,
          encoding: 'base64',
        })
        .send();

      this.logger.log(`Transaction ${signature} sent`);
      return signature;
    } catch (error) {
      this.logger.error('Failed to send transaction', error);
      throw error;
    }
  }

  /**
   * Wait for a transaction to be confirmed on the blockchain
   *
   * Polls the RPC endpoint to check if a transaction has been confirmed or finalized.
   * Uses a polling mechanism with configurable retry attempts.
   *
   * ## Timeout Behavior
   *
   * The timeout mechanism varies based on whether `lastValidBlockHeight` is provided:
   *
   * ### With lastValidBlockHeight (Block Height Timeout)
   * - Fetches current block height before each confirmation check
   * - Returns `{ confirmed: false }` immediately if block height is exceeded
   * - This prevents wasting time on transactions that have expired on-chain
   * - Each attempt takes ~1 second (polling interval)
   * - Max total time: `maxAttempts * 1 second`
   *
   * ### Without lastValidBlockHeight (Attempt-Based Timeout)
   * - Skips block height check to save RPC calls
   * - Relies solely on `maxAttempts` for timeout
   * - Total timeout: `maxAttempts * 1 second`
   * - Default: 30 attempts = ~30 seconds total
   * - Better for transactions without explicit blockhash lifetime
   *
   * ## Return Values
   *
   * - `{ confirmed: true, slot: bigint }` - Transaction confirmed/finalized
   * - `{ confirmed: false }` - Transaction expired or timeout reached
   * - Throws error if transaction failed (status.err is set)
   *
   * @param signature Transaction signature (can be string or Signature type)
   * @param lastValidBlockHeight Optional last valid block height for the transaction.
   *                             Enables automatic expiration detection. If the current
   *                             block height exceeds this value, the method returns
   *                             immediately with `{ confirmed: false }`.
   * @param maxAttempts Maximum number of polling attempts (default: 30).
   *                    Total timeout ≈ maxAttempts × 1 second
   * @returns Confirmation result with status and optional slot number
   * @throws Error if transaction execution failed (status.err is not null)
   *
   * @example
   * ```typescript
   * // With lastValidBlockHeight - automatic expiration detection
   * const { blockhash, lastValidBlockHeight } =
   *   await blockService.getLatestBlockhash();
   *
   * const txMessage = await transactionService.buildTransactionMessageWithBlockhash({
   *   instructions: [instruction],
   *   feePayer: signer.address,
   *   blockhash,
   *   lastValidBlockHeight,
   * });
   *
   * const signedTx = await transactionService.signTransactionMessage(txMessage, [signer]);
   * const signature = transactionService.getSignature(signedTx);
   *
   * // Method will check block height and return if expired
   * const result = await transactionService.waitForConfirmation(
   *   signature,
   *   lastValidBlockHeight,
   *   30  // 30 attempts = ~30 seconds
   * );
   *
   * if (!result.confirmed) {
   *   console.log('Transaction expired or timed out');
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Without lastValidBlockHeight - simple polling without block height checks
   * const encodedTx = transactionService.encodeTransaction(signedTx);
   * const signature = await transactionService.sendEncoded(encodedTx);
   *
   * // Will poll for ~30 seconds without checking block height expiration
   * const result = await transactionService.waitForConfirmation(
   *   signature,
   *   undefined,  // No block height check
   *   30          // Still 30 attempts = ~30 seconds
   * );
   * ```
   *
   * @example
   * ```typescript
   * // Custom timeout - use more attempts for longer waits
   * const result = await transactionService.waitForConfirmation(
   *   signature,
   *   lastValidBlockHeight,
   *   60  // 60 attempts = ~60 seconds total
   * );
   * ```
   */
  async waitForConfirmation(
    signature: Signature | string,
    lastValidBlockHeight?: bigint,
    maxAttempts = 30,
  ): Promise<{ confirmed: boolean; slot?: bigint }> {
    const rpc = this.rpcService.rpc;
    const sig = this.utilsService.toSignature(signature);

    this.logger.debug(`Waiting for confirmation of transaction: ${sig}`);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Check current block height if lastValidBlockHeight is provided
        if (lastValidBlockHeight !== undefined) {
          const currentHeight = await rpc.getBlockHeight().send();

          if (currentHeight > lastValidBlockHeight) {
            this.logger.warn(
              `Transaction ${sig} expired (block height exceeded)`,
            );
            return { confirmed: false };
          }
        }

        // Check transaction status
        const { value: statuses } = await rpc
          .getSignatureStatuses([sig], { searchTransactionHistory: true })
          .send();

        const status = statuses[0];

        if (status) {
          if (status.err) {
            this.logger.error(`Transaction ${sig} failed:`, status.err);
            throw new Error(
              `Transaction failed: ${JSON.stringify(status.err)}`,
            );
          }

          if (
            status.confirmationStatus === 'confirmed' ||
            status.confirmationStatus === 'finalized'
          ) {
            this.logger.debug(
              `Transaction ${sig} ${status.confirmationStatus} at slot ${status.slot}`,
            );
            return {
              confirmed: true,
              slot: status.slot ? BigInt(status.slot) : undefined,
            };
          }
        }

        // Wait before next attempt
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        this.logger.error(
          `Error while waiting for confirmation (attempt ${attempt + 1})`,
          error,
        );
        if (attempt === maxAttempts - 1) {
          throw error;
        }
      }
    }

    this.logger.warn(`Transaction ${sig} confirmation timeout`);
    return { confirmed: false };
  }

  /**
   * Get transaction details
   * @param signature Transaction signature
   * @returns Transaction details or null if not found
   */
  async getTransaction(signature: Signature | string): Promise<any> {
    try {
      const rpc = this.rpcService.rpc;
      const sig = this.utilsService.toSignature(signature);

      const transaction = await rpc
        .getTransaction(sig, {
          encoding: 'jsonParsed',
          maxSupportedTransactionVersion: 0,
        })
        .send();

      if (!transaction) {
        this.logger.warn(`Transaction ${sig} not found`);
        return null;
      }

      this.logger.debug(`Retrieved transaction ${sig}`);
      return transaction;
    } catch (error) {
      this.logger.error(`Failed to get transaction ${signature}`, error);
      throw error;
    }
  }

  /**
   * Get transaction status
   * @param signature Transaction signature
   * @returns Transaction status information
   */
  async getTransactionStatus(
    signature: Signature | string,
  ): Promise<TransactionStatus | null> {
    try {
      const rpc = this.rpcService.rpc;
      const sig = this.utilsService.toSignature(signature);

      const { value: statuses } = await rpc
        .getSignatureStatuses([sig], { searchTransactionHistory: true })
        .send();

      const status = statuses[0];
      if (!status) {
        this.logger.warn(`Transaction status for ${sig} not found`);
        return null;
      }

      return status;
    } catch (error) {
      this.logger.error(`Failed to get transaction status ${signature}`, error);
      throw error;
    }
  }

  /**
   * Get signatures for an address
   * @param accountAddress The account address
   * @param limit Maximum number of signatures to return
   * @returns Array of signature information
   */
  async getSignaturesForAddress(
    address: string | Address,
    limit = 10,
  ): Promise<GetSignaturesForAddressResult> {
    try {
      const addr = this.utilsService.toAddress(address);
      const rpc = this.rpcService.rpc;

      const signatures = await rpc
        .getSignaturesForAddress(addr, { limit })
        .send();

      this.logger.debug(
        `Retrieved ${signatures.length} signatures for ${addr}`,
      );
      return signatures;
    } catch (error) {
      this.logger.error(
        `Failed to get signatures for address ${address}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Simulate a transaction before sending
   * @param encodedTx Base64-encoded wire transaction to simulate
   * @returns Simulation result
   */
  async simulateTransaction(
    encodedTx: Base64EncodedWireTransaction,
  ): Promise<SimulateTransactionResult> {
    const rpc = this.rpcService.rpc;

    try {
      const { value: simulation } = await rpc
        .simulateTransaction(encodedTx, {
          encoding: 'base64',
        })
        .send();

      this.logger.debug('Transaction simulation completed');
      return simulation;
    } catch (error) {
      this.logger.error('Failed to simulate transaction', error);
      throw error;
    }
  }

  /**
   * Get the signature from a signed transaction
   * Useful for tracking transaction status
   *
   * @param tx The transaction
   * @returns Transaction signature
   * @example
   * ```typescript
   * const signature = transactionService.getSignature(tx);
   * console.log('Transaction signature:', signature);
   * ```
   */
  getSignature(tx: Transaction): Signature {
    try {
      const signature = getSignatureFromTransaction(tx);
      this.logger.debug(`Got signature: ${signature}`);
      return signature;
    } catch (error) {
      this.logger.error('Failed to get signature from transaction', error);
      throw error;
    }
  }

  /**
   * Encode a signed transaction to base64 format for RPC transmission
   *
   * @param tx The transaction to encode
   * @returns Base64-encoded transaction string
   * @example
   * ```typescript
   * const encodedTx = transactionService.encodeTransaction(tx);
   * // Now ready to send via RPC: rpc.sendTransaction(encodedTx, { encoding: 'base64' })
   * ```
   */
  encodeTransaction(tx: Transaction): Base64EncodedWireTransaction {
    try {
      const encoded = getBase64EncodedWireTransaction(tx);
      this.logger.debug('Encoded transaction to base64');
      return encoded;
    } catch (error) {
      this.logger.error('Failed to encode transaction', error);
      throw error;
    }
  }
}
