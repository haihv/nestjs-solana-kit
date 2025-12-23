import { Injectable, Logger } from '@nestjs/common';
import {
  type Address,
  address,
  getAddressCodec,
  getAddressEncoder,
  getProgramDerivedAddress,
  isAddress,
} from '@solana/kit';

const ASSOCIATED_TOKEN_PROGRAM_ADDRESS =
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL' as Address;
const TOKEN_PROGRAM_ADDRESS =
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address;

/**
 * Seed types that can be used for PDA derivation
 *
 * Supports:
 * - Uint8Array: Raw bytes
 * - string: Text (will be encoded as UTF-8)
 * - Address: Solana address (will be encoded to bytes)
 * - number: Integer (will be encoded as little-endian bytes)
 * - bigint: Large integer (will be encoded as little-endian bytes)
 */
export type PdaSeed = Uint8Array | string | Address | number | bigint;

/**
 * Result of PDA derivation
 */
export type PdaAddress = {
  readonly address: Address;
  readonly bump: number;
};

/**
 * Service for Solana address derivation and utilities
 *
 * Provides:
 * - PDA (Program Derived Address) derivation
 * - ATA (Associated Token Account) derivation
 * - Address validation and encoding
 *
 * @example
 * ```typescript
 * // Derive a PDA
 * const pda = await addressService.derivePda(programId, ['user_state', userAddress]);
 *
 * // Derive an ATA
 * const ata = await addressService.deriveAta(ownerAddress, mintAddress);
 *
 * // Validate an address
 * if (addressService.isValidAddress(input)) {
 *   // input is a valid Solana address
 * }
 * ```
 */
@Injectable()
export class SolanaAddressService {
  private readonly logger = new Logger(SolanaAddressService.name);
  private readonly addressEncoder = getAddressEncoder();
  private readonly addressCodec = getAddressCodec();

  /**
   * Derive a Program Derived Address (PDA)
   *
   * @param programId The program ID to derive the PDA from
   * @param seeds Array of seeds (up to 16)
   * @returns PDA address and bump seed
   *
   * @example
   * ```typescript
   * // Simple seed
   * const pda = await addressService.derivePda(programId, ['global_state']);
   *
   * // Multiple seeds with different types
   * const userPda = await addressService.derivePda(programId, [
   *   'user_state',
   *   userAddress,
   *   BigInt(cardId),
   * ]);
   * ```
   */
  async derivePda(
    programId: Address | string,
    seeds: PdaSeed[],
  ): Promise<PdaAddress> {
    const programAddress = address(programId);
    const encodedSeeds = seeds.map((seed) => this.encodeSeed(seed));

    const [pdaAddress, bump] = await getProgramDerivedAddress({
      programAddress,
      seeds: encodedSeeds,
    });

    return {
      address: pdaAddress,
      bump,
    };
  }

  /**
   * Derive an Associated Token Account (ATA) address
   *
   * Uses the standard ATA program for derivation.
   *
   * @param owner The wallet address that owns the ATA
   * @param mint The token mint address
   * @param tokenProgram Optional token program (defaults to Token Program)
   * @returns The ATA address
   *
   * @example
   * ```typescript
   * const ata = await addressService.deriveAta(walletAddress, usdcMint);
   * ```
   */
  async deriveAta(
    owner: Address | string,
    mint: Address | string,
    tokenProgram?: Address | string,
  ): Promise<Address> {
    const ownerAddress = address(owner);
    const mintAddress = address(mint);
    const tokenProgramAddress = tokenProgram
      ? address(tokenProgram)
      : TOKEN_PROGRAM_ADDRESS;

    // ATA is a PDA derived from: [owner, tokenProgram, mint]
    const [ata] = await getProgramDerivedAddress({
      programAddress: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
      seeds: [
        this.addressEncoder.encode(ownerAddress),
        this.addressEncoder.encode(tokenProgramAddress),
        this.addressEncoder.encode(mintAddress),
      ],
    });

    return ata;
  }

  /**
   * Check if a string is a valid Solana address
   *
   * @param value The string to validate
   * @returns true if valid address
   */
  isValidAddress(value: string): value is Address {
    return isAddress(value);
  }

  /**
   * Convert an address to bytes
   *
   * @param addr The address to convert
   * @returns 32-byte Uint8Array
   */
  addressToBytes(addr: Address | string): Uint8Array {
    const encoded = this.addressEncoder.encode(address(addr));
    return new Uint8Array(encoded);
  }

  /**
   * Convert bytes to an address
   *
   * @param bytes 32-byte Uint8Array
   * @returns Address string
   */
  bytesToAddress(bytes: Uint8Array): Address {
    return this.addressCodec.decode(bytes);
  }

  /**
   * Create an Address from a string
   *
   * @param value Base58 encoded address string
   * @returns Typed Address
   * @throws Error if invalid address
   */
  toAddress(value: string): Address {
    return address(value);
  }

  /**
   * Encode a seed to bytes for PDA derivation
   */
  private encodeSeed(seed: PdaSeed): Uint8Array {
    if (seed instanceof Uint8Array) {
      return seed;
    }

    if (typeof seed === 'string') {
      if (isAddress(seed)) {
        return new Uint8Array(this.addressEncoder.encode(seed as Address));
      }
      return new TextEncoder().encode(seed);
    }

    if (typeof seed === 'number') {
      return this.encodeNumber(seed);
    }

    // Must be bigint at this point (TypeScript ensures this via PdaSeed type)
    return this.encodeBigInt(seed);
  }

  /**
   * Encode a number to little-endian bytes
   */
  private encodeNumber(value: number): Uint8Array {
    if (value < 0 || value > 0xffffffff) {
      throw new Error(`Number out of range for u32: ${value}`);
    }

    if (value <= 0xff) {
      return new Uint8Array([value]);
    }

    if (value <= 0xffff) {
      const bytes = new Uint8Array(2);
      new DataView(bytes.buffer).setUint16(0, value, true);
      return bytes;
    }

    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, value, true);
    return bytes;
  }

  /**
   * Encode a bigint to little-endian bytes
   */
  private encodeBigInt(value: bigint): Uint8Array {
    if (value < 0n) {
      throw new Error(`Negative bigint not supported: ${value}`);
    }

    if (value <= 0xffffffffffffffffn) {
      const bytes = new Uint8Array(8);
      new DataView(bytes.buffer).setBigUint64(0, value, true);
      return bytes;
    }

    throw new Error(`BigInt too large: ${value}`);
  }
}
