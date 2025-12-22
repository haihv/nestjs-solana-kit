import { Injectable, Logger } from '@nestjs/common';
import {
  type Address,
  type KeyPairSigner,
  createKeyPairFromBytes,
  createSignerFromKeyPair,
  getAddressFromPublicKey,
} from '@solana/kit';
import { getBase58Encoder } from '@solana/kit';

/**
 * Authority type identifier
 *
 * Use string literals for custom authority types (e.g., 'admin', 'treasury', 'operator')
 */
export type AuthorityType = string;

/**
 * Configuration for registering an authority
 */
export type AuthorityConfig = {
  readonly type: AuthorityType;
  readonly privateKey: string | Uint8Array;
};

/**
 * Service for managing Solana keypairs and signers
 *
 * Provides:
 * - Keypair loading from various formats (base58, bytes)
 * - Authority caching to avoid repeated decoding
 * - Multiple authority type support (admin, treasury, operator, etc.)
 *
 * @example
 * ```typescript
 * // Register authorities on initialization
 * authorityService.registerAuthority({
 *   type: 'admin',
 *   privateKey: process.env.ADMIN_PRIVATE_KEY,
 * });
 *
 * // Get cached signer for signing transactions
 * const adminSigner = authorityService.getAuthority('admin');
 *
 * // Get just the address without the signer
 * const adminAddress = authorityService.getAuthorityAddress('admin');
 * ```
 */
@Injectable()
export class SolanaAuthorityService {
  private readonly logger = new Logger(SolanaAuthorityService.name);
  private readonly signerCache = new Map<AuthorityType, KeyPairSigner>();
  private readonly base58Encoder = getBase58Encoder();

  /**
   * Register an authority keypair
   *
   * The keypair will be parsed and cached for future use.
   *
   * @param config Authority configuration with type and private key
   *
   * @example
   * ```typescript
   * // From base58 string (e.g., from Phantom export)
   * authorityService.registerAuthority({
   *   type: 'treasury',
   *   privateKey: '5Jd7...base58...',
   * });
   *
   * // From byte array
   * authorityService.registerAuthority({
   *   type: 'operator',
   *   privateKey: new Uint8Array([...]),
   * });
   * ```
   */
  async registerAuthority(config: AuthorityConfig): Promise<void> {
    const { type, privateKey } = config;

    if (this.signerCache.has(type)) {
      this.logger.warn(`Authority '${type}' already registered, replacing`);
    }

    const signer =
      typeof privateKey === 'string'
        ? await this.createSignerFromBase58(privateKey)
        : await this.createSignerFromBytes(privateKey);

    this.signerCache.set(type, signer);
    this.logger.log(`Authority '${type}' registered: ${signer.address}`);
  }

  /**
   * Get a registered authority signer
   *
   * @param type The authority type to retrieve
   * @returns The cached KeyPairSigner
   * @throws Error if authority is not registered
   *
   * @example
   * ```typescript
   * const signer = authorityService.getAuthority('admin');
   * await transactionService.sendAndConfirm(message, [signer]);
   * ```
   */
  getAuthority(type: AuthorityType): KeyPairSigner {
    const signer = this.signerCache.get(type);
    if (!signer) {
      throw new Error(`Authority '${type}' not registered`);
    }
    return signer;
  }

  /**
   * Get the address of a registered authority
   *
   * Useful when you need the address but not the signing capability.
   *
   * @param type The authority type to retrieve
   * @returns The authority's address
   * @throws Error if authority is not registered
   *
   * @example
   * ```typescript
   * const treasuryAddress = authorityService.getAuthorityAddress('treasury');
   * ```
   */
  getAuthorityAddress(type: AuthorityType): Address {
    return this.getAuthority(type).address;
  }

  /**
   * Check if an authority is registered
   *
   * @param type The authority type to check
   * @returns true if the authority is registered
   */
  hasAuthority(type: AuthorityType): boolean {
    return this.signerCache.has(type);
  }

  /**
   * Get all registered authority types
   *
   * @returns Array of registered authority type names
   */
  getRegisteredTypes(): AuthorityType[] {
    return Array.from(this.signerCache.keys());
  }

  /**
   * Unregister an authority
   *
   * @param type The authority type to remove
   * @returns true if the authority was removed
   */
  unregisterAuthority(type: AuthorityType): boolean {
    const removed = this.signerCache.delete(type);
    if (removed) {
      this.logger.log(`Authority '${type}' unregistered`);
    }
    return removed;
  }

  /**
   * Clear all registered authorities
   */
  clearAll(): void {
    this.signerCache.clear();
    this.logger.log('All authorities cleared');
  }

  /**
   * Create a KeyPairSigner from raw private key bytes
   *
   * @param privateKeyBytes 64-byte private key (or 32-byte seed)
   * @returns KeyPairSigner ready for signing
   *
   * @example
   * ```typescript
   * const bytes = new Uint8Array([...64 bytes...]);
   * const signer = await authorityService.createSignerFromBytes(bytes);
   * ```
   */
  async createSignerFromBytes(
    privateKeyBytes: Uint8Array,
  ): Promise<KeyPairSigner> {
    const keyPair = await createKeyPairFromBytes(privateKeyBytes);
    return await createSignerFromKeyPair(keyPair);
  }

  /**
   * Create a KeyPairSigner from a base58-encoded private key
   *
   * @param privateKeyBase58 Base58-encoded private key string
   * @returns KeyPairSigner ready for signing
   *
   * @example
   * ```typescript
   * const base58Key = '5Jd7...'; // 64 or 88 character base58 string
   * const signer = await authorityService.createSignerFromBase58(base58Key);
   * ```
   */
  async createSignerFromBase58(
    privateKeyBase58: string,
  ): Promise<KeyPairSigner> {
    const encoded = this.base58Encoder.encode(privateKeyBase58);
    const privateKeyBytes = new Uint8Array(encoded);
    return this.createSignerFromBytes(privateKeyBytes);
  }

  /**
   * Get the public address from a private key without creating a full signer
   *
   * Useful for validation or address derivation without caching.
   *
   * @param privateKey Base58 string or byte array
   * @returns The derived public address
   */
  async getAddressFromPrivateKey(
    privateKey: string | Uint8Array,
  ): Promise<Address> {
    const bytes =
      typeof privateKey === 'string'
        ? new Uint8Array(this.base58Encoder.encode(privateKey))
        : privateKey;

    const keyPair = await createKeyPairFromBytes(bytes);
    return await getAddressFromPublicKey(keyPair.publicKey);
  }
}
