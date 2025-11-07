import { Injectable, Logger } from '@nestjs/common';
import { address, createKeyPairSignerFromBytes, signature } from '@solana/kit';
import type {
  Address,
  Instruction,
  TransactionSigner,
  Signature,
} from '@solana/kit';
import {
  fromLegacyPublicKey,
  fromLegacyTransactionInstruction,
} from '@solana/compat';
import {
  PublicKey,
  Keypair,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
  AccountMeta,
} from '@solana/web3.js';

/**
 * Mapping of AccountRole numeric values to isSigner and isWritable flags
 *
 * Role values from @solana/kit:
 * - 0 (READONLY): Not signer, not writable
 * - 1 (READONLY_SIGNER): Is signer, not writable
 * - 2 (WRITABLE): Not signer, is writable
 * - 3 (WRITABLE_SIGNER): Is signer, is writable
 */
const accountRoleMapped = new Map<
  number,
  { isSigner: boolean; isWritable: boolean }
>([
  [3, { isSigner: true, isWritable: true }], // WRITABLE_SIGNER
  [2, { isSigner: false, isWritable: true }], // WRITABLE
  [1, { isSigner: true, isWritable: false }], // READONLY_SIGNER
  [0, { isSigner: false, isWritable: false }], // READONLY
]);

/**
 * Utility service for compatibility and conversion between legacy @solana/web3.js and modern @solana/kit
 *
 * This service provides:
 * - Bidirectional conversion utilities between legacy (web3.js) and modern (kit) formats
 * - All methods accept both legacy and kit inputs where applicable
 * - All conversion methods return kit format for consistency
 * - Lamports/SOL conversion utilities
 * - Leverages @solana/compat library for official conversions
 *
 * @see https://github.com/anza-xyz/kit/tree/main/packages/compat
 */
@Injectable()
export class SolanaUtilsService {
  private readonly logger = new Logger(SolanaUtilsService.name);

  // ============================================================================
  // Address Conversion (using @solana/compat)
  // ============================================================================

  /**
   * Convert legacy PublicKey or string to kit Address
   * Uses @solana/compat's fromLegacyPublicKey internally
   *
   * Accepts:
   * - Legacy PublicKey from @solana/web3.js
   * - Kit Address (passthrough)
   * - Base58 string
   *
   * Always returns: Kit Address
   *
   * @param input Legacy PublicKey, kit Address, or base58 string
   * @returns Kit Address
   * @example
   * ```typescript
   * // From legacy PublicKey
   * import { PublicKey } from '@solana/web3.js';
   * const legacyPubkey = new PublicKey('11111111111111111111111111111111');
   * const addr1 = utilsService.toAddress(legacyPubkey);
   *
   * // From string
   * const addr2 = utilsService.toAddress('11111111111111111111111111111111');
   *
   * // From kit Address (passthrough - no conversion needed)
   * const kitAddr = address('11111111111111111111111111111111');
   * const addr3 = utilsService.toAddress(kitAddr);
   * ```
   */
  toAddress(input: PublicKey | Address | string): Address {
    try {
      if (typeof input === 'string') {
        return address(input);
      }
      if (input instanceof PublicKey) {
        return fromLegacyPublicKey(input);
      }
      // Already an Address
      return input;
    } catch (error) {
      this.logger.error('Failed to convert to Address', error);
      throw error;
    }
  }

  /**
   * Convert kit Address to legacy PublicKey
   *
   * @param addr Kit Address or string
   * @returns Legacy PublicKey from @solana/web3.js
   * @example
   * ```typescript
   * import { address } from '@solana/kit';
   * const kitAddr = address('11111111111111111111111111111111');
   * const publicKey = utilsService.toPublicKey(kitAddr);
   * // publicKey is now a legacy PublicKey instance
   * ```
   */
  toPublicKey(addr: Address | string): PublicKey {
    try {
      return new PublicKey(addr);
    } catch (error) {
      this.logger.error('Failed to convert to PublicKey', error);
      throw error;
    }
  }

  /**
   * Convert string to kit Signature or passthrough existing Signature
   *
   * This is a convenience method that accepts either a base58-encoded signature
   * string or an existing kit Signature and ensures the return value is a
   * properly typed Signature.
   *
   * Accepts:
   * - Kit Signature (passthrough)
   * - Base58-encoded signature string
   *
   * Always returns: Kit Signature
   *
   * @param sig Signature string or existing Signature
   * @returns Kit Signature
   * @example
   * ```typescript
   * // From string
   * const sig1 = utilsService.toSignature('3Bxs7n...');
   *
   * // From existing Signature (passthrough)
   * const kitSig = signature('3Bxs7n...');
   * const sig2 = utilsService.toSignature(kitSig);
   * ```
   */
  toSignature(sig: Signature | string): Signature {
    return signature(sig);
  }

  // ============================================================================
  // Signer/Keypair Conversion (using @solana/compat)
  // ============================================================================

  /**
   * Convert legacy Keypair to kit TransactionSigner
   * Extracts the ed25519 seed (first 32 bytes) from the legacy keypair and creates a kit signer
   *
   * Note: Legacy Keypairs have a 64-byte secret key where:
   * - First 32 bytes: ed25519 seed (used for signing)
   * - Last 32 bytes: public key (derived from seed)
   *
   * @param keypair Legacy Keypair from @solana/web3.js
   * @returns Kit TransactionSigner (async operation as it involves key derivation)
   * @throws Error if the keypair is invalid or conversion fails
   * @example
   * ```typescript
   * import { Keypair } from '@solana/web3.js';
   *
   * // From generated keypair
   * const legacyKeypair = Keypair.generate();
   * const signer = await utilsService.keypairToSigner(legacyKeypair);
   *
   * // From file or environment
   * const buffer = fs.readFileSync('keypair.json');
   * const keypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(buffer.toString())));
   * const signer = await utilsService.keypairToSigner(keypair);
   * ```
   */
  async keypairToSigner(keypair: Keypair): Promise<TransactionSigner> {
    try {
      // Extract the ed25519 seed (first 32 bytes) from the 64-byte secret key
      const secretKeyBytes = new Uint8Array(keypair.secretKey);
      const signer = await createKeyPairSignerFromBytes(secretKeyBytes);
      this.logger.debug(`Converted Keypair to Signer`);
      return signer;
    } catch (error) {
      this.logger.error('Failed to convert Keypair to Signer', error);
      throw error;
    }
  }

  /**
   * Create kit TransactionSigner from secret key bytes
   * This is useful for creating signers from environment variables or stored keys
   *
   * Accepts either:
   * - ed25519 seed: 32 bytes (recommended for @solana/kit APIs)
   * - Legacy secret key: 64 bytes (first 32 bytes = seed, last 32 bytes = public key)
   *
   * @param secretKey Secret key bytes - either 32-byte ed25519 seed or 64-byte legacy format
   * @returns Kit TransactionSigner
   * @throws Error if secret key is invalid or conversion fails
   * @example
   * ```typescript
   * // From environment variable (32-byte seed)
   * const secretKeyArray = JSON.parse(process.env.SOLANA_SECRET_KEY);
   * const secretKey = new Uint8Array(secretKeyArray);
   * const signer = await utilsService.signerFromSecretKey(secretKey);
   *
   * // From base58 encoded key
   * import bs58 from 'bs58';
   * const base58Key = process.env.SOLANA_SECRET_KEY;
   * const secretKey = bs58.decode(base58Key);
   * const signer = await utilsService.signerFromSecretKey(secretKey);
   *
   * // From legacy 64-byte format (if you only have the raw bytes, not a Keypair object)
   * // Note: If you have a Keypair object, use keypairToSigner() instead
   * // const secretKey64 = new Uint8Array([...]); // 64-byte legacy secret key
   * // const signer = await utilsService.signerFromSecretKey(secretKey64.slice(0, 32));
   * ```
   */
  async signerFromSecretKey(secretKey: Uint8Array): Promise<TransactionSigner> {
    try {
      const signer = await createKeyPairSignerFromBytes(secretKey);
      this.logger.debug(`Created Signer from secret key`);
      return signer;
    } catch (error) {
      this.logger.error('Failed to create Signer from secret key', error);
      throw error;
    }
  }

  // ============================================================================
  // Instruction Conversion (using @solana/compat)
  // ============================================================================

  /**
   * Convert legacy TransactionInstruction to kit Instruction
   * Uses @solana/compat's fromLegacyTransactionInstruction internally
   *
   * This handles conversion of:
   * - Program ID: PublicKey → Address
   * - Account metas: {pubkey, isSigner, isWritable} → {address, role}
   * - Instruction data: Buffer → Uint8Array
   *
   * @param legacyInstruction Legacy TransactionInstruction from @solana/web3.js
   * @returns Kit Instruction
   * @example
   * ```typescript
   * import { SystemProgram, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
   *
   * const legacyIx = SystemProgram.transfer({
   *   fromPubkey: new PublicKey('...'),
   *   toPubkey: new PublicKey('...'),
   *   lamports: LAMPORTS_PER_SOL,
   * });
   *
   * const kitIx = utilsService.instructionToKit(legacyIx);
   * // Can now use kitIx with kit transaction building
   * ```
   */
  instructionToKit(legacyInstruction: TransactionInstruction): Instruction {
    try {
      const instruction = fromLegacyTransactionInstruction(legacyInstruction);
      this.logger.debug(`Converted legacy instruction to kit format`);
      return instruction;
    } catch (error) {
      this.logger.error('Failed to convert legacy instruction', error);
      throw error;
    }
  }

  /**
   * Convert array of legacy TransactionInstructions to kit Instructions
   * Convenience method for batch conversion
   *
   * @param legacyInstructions Array of legacy TransactionInstructions
   * @returns Array of kit Instructions
   * @example
   * ```typescript
   * const legacyIxs = [
   *   SystemProgram.transfer({...}),
   *   SystemProgram.createAccount({...}),
   *   TokenProgram.transfer({...}),
   * ];
   *
   * const kitIxs = utilsService.instructionsToKit(legacyIxs);
   * ```
   */
  instructionsToKit(
    legacyInstructions: TransactionInstruction[],
  ): Instruction[] {
    try {
      const instructions = legacyInstructions.map((ix) =>
        this.instructionToKit(ix),
      );
      this.logger.debug(
        `Converted ${instructions.length} legacy instructions to kit format`,
      );
      return instructions;
    } catch (error) {
      this.logger.error('Failed to convert legacy instructions', error);
      throw error;
    }
  }

  /**
   * Convert kit Instruction back to legacy TransactionInstruction
   *
   * This handles conversion of:
   * - Program address: Address → PublicKey
   * - Account metas: {address, role} → {pubkey, isSigner, isWritable}
   * - Instruction data: Uint8Array → Buffer
   *
   * @param instruction Kit Instruction
   * @returns Legacy TransactionInstruction
   * @example
   * ```typescript
   * import { getTransferSolInstruction } from '@solana/kit';
   *
   * const kitIx = getTransferSolInstruction({...});
   * const legacyIx = utilsService.instructionToLegacy(kitIx);
   * // Can now use with legacy Transaction
   * ```
   */
  instructionToLegacy(instruction: Instruction): TransactionInstruction {
    try {
      const accounts = (instruction.accounts || []).map((account) => {
        const { isSigner, isWritable } = this.roleToLegacyFlags(account.role);
        return {
          pubkey: this.toPublicKey(account.address),
          isSigner,
          isWritable,
        };
      });

      return new TransactionInstruction({
        programId: this.toPublicKey(instruction.programAddress),
        keys: accounts,
        data: instruction.data
          ? Buffer.from(instruction.data)
          : Buffer.alloc(0),
      });
    } catch (error) {
      this.logger.error('Failed to convert kit instruction to legacy', error);
      throw error;
    }
  }

  /**
   * Convert array of kit Instructions to legacy TransactionInstructions
   * Convenience method for batch conversion
   *
   * @param instructions Array of kit Instructions
   * @returns Array of legacy TransactionInstructions
   * @example
   * ```typescript
   * const kitIxs = [ix1, ix2, ix3];
   * const legacyIxs = utilsService.instructionsToLegacy(kitIxs);
   * ```
   */
  instructionsToLegacy(instructions: Instruction[]): TransactionInstruction[] {
    try {
      const legacyInstructions = instructions.map((ix) =>
        this.instructionToLegacy(ix),
      );
      this.logger.debug(
        `Converted ${legacyInstructions.length} kit instructions to legacy format`,
      );
      return legacyInstructions;
    } catch (error) {
      this.logger.error('Failed to convert kit instructions to legacy', error);
      throw error;
    }
  }

  // ============================================================================
  // Helper: AccountRole Conversion
  // ============================================================================

  /**
   * Convert legacy isSigner/isWritable flags to kit AccountRole
   *
   * AccountRole values:
   * - READONLY = 0: Not signer, not writable
   * - READONLY_SIGNER = 1: Is signer, not writable
   * - WRITABLE = 2: Not signer, is writable
   * - WRITABLE_SIGNER = 3: Is signer, is writable
   *
   * Accepts either individual flags or AccountMeta-like object
   *
   * @param flags Object with isSigner and isWritable boolean flags (from AccountMeta)
   * @returns AccountRole number (0-3)
   * @example
   * ```typescript
   * // From object (preferred)
   * const role1 = utilsService.legacyFlagsToRole({ isSigner: true, isWritable: true }); // 3
   * const role2 = utilsService.legacyFlagsToRole({ isSigner: false, isWritable: true }); // 2
   *
   * // For backward compatibility with individual flags, use:
   * // const role = utilsService.legacyFlagsToRole({ isSigner: true, isWritable: false }); // 1
   * ```
   */
  legacyFlagsToRole({
    isSigner,
    isWritable,
  }: Omit<AccountMeta, 'pubkey'>): number {
    if (isSigner && isWritable) return 3; // WRITABLE_SIGNER
    if (isSigner) return 1; // READONLY_SIGNER
    if (isWritable) return 2; // WRITABLE
    return 0; // READONLY
  }

  /**
   * Convert kit AccountRole to legacy isSigner/isWritable flags
   *
   * @param role AccountRole number (0-3)
   * @returns Object with isSigner and isWritable boolean flags
   * @example
   * ```typescript
   * const flags1 = utilsService.roleToLegacyFlags(3); // { isSigner: true, isWritable: true }
   * const flags2 = utilsService.roleToLegacyFlags(2); // { isSigner: false, isWritable: true }
   * const flags3 = utilsService.roleToLegacyFlags(1); // { isSigner: true, isWritable: false }
   * const flags4 = utilsService.roleToLegacyFlags(0); // { isSigner: false, isWritable: false }
   * ```
   */
  roleToLegacyFlags(role: number): Omit<AccountMeta, 'pubkey'> {
    return accountRoleMapped.get(role) ?? accountRoleMapped.get(0)!;
  }

  // ============================================================================
  // Error Utilities
  // ============================================================================

  /**
   * Check if an error is an abort error
   *
   * This utility is useful for filtering out expected AbortError exceptions
   * that occur when subscriptions or operations are intentionally cancelled.
   *
   * Handles multiple abort error formats:
   * - Error instances with name 'AbortError'
   * - DOMException with name 'AbortError' (browser/Node.js 15+)
   * - Error-like objects with name 'AbortError'
   *
   * Common use cases:
   * - WebSocket subscription cancellations via AbortController
   * - HTTP request cancellations
   * - Transaction waiting cancellations
   *
   * @param error The error to check
   * @returns True if the error is an AbortError, false otherwise
   * @example
   * ```typescript
   * try {
   *   await someAsyncOperation();
   * } catch (error) {
   *   if (!utilsService.isAbortError(error)) {
   *     // Only log/handle non-abort errors
   *     logger.error('Operation failed:', error);
   *   }
   * }
   * ```
   */
  isAbortError(error: unknown): boolean {
    // Fast path: Check if it's an Error instance with name 'AbortError'
    if (error instanceof Error && error.name === 'AbortError') {
      return true;
    }

    // Fallback: Check for error-like objects (e.g., DOMException)
    // DOMException is not always an instance of Error
    return (
      error !== null &&
      typeof error === 'object' &&
      'name' in error &&
      error.name === 'AbortError'
    );
  }

  // ============================================================================
  // Amount Conversion
  // ============================================================================

  /**
   * Convert lamports to SOL
   * Works with both bigint and number inputs for flexibility
   *
   * @param lamports Amount in lamports (bigint or number)
   * @returns Amount in SOL as a number
   * @example
   * ```typescript
   * const sol1 = utilsService.lamportsToSol(1000000000n); // 1.0
   * const sol2 = utilsService.lamportsToSol(1500000000); // 1.5
   * const sol3 = utilsService.lamportsToSol(1000000n); // 0.001
   * ```
   */
  lamportsToSol(lamports: bigint | number): number {
    const lamportValue =
      typeof lamports === 'bigint' ? Number(lamports) : lamports;
    return lamportValue / LAMPORTS_PER_SOL;
  }

  /**
   * Convert SOL to lamports
   * Always returns bigint for precision and compatibility with kit
   *
   * @param sol Amount in SOL
   * @returns Amount in lamports as bigint
   * @example
   * ```typescript
   * const lamports1 = utilsService.solToLamports(1.5); // 1500000000n
   * const lamports2 = utilsService.solToLamports(0.001); // 1000000n
   * const lamports3 = utilsService.solToLamports(2); // 2000000000n
   * ```
   */
  solToLamports(sol: number): bigint {
    try {
      return BigInt(Math.floor(sol * LAMPORTS_PER_SOL));
    } catch (error) {
      this.logger.error('Failed to convert SOL to lamports', error);
      throw error;
    }
  }
}
