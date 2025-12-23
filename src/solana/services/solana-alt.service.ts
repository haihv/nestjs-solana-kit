import { Injectable, Logger } from '@nestjs/common';
import {
  type Address,
  type Instruction,
  address,
  getAddressDecoder,
  getAddressEncoder,
} from '@solana/kit';

import { SolanaRpcService } from './solana-rpc.service';

/**
 * Address Lookup Table information
 */
export type AltInfo = {
  readonly address: Address;
  readonly authority: Address | null;
  readonly addresses: readonly Address[];
  readonly deactivationSlot: bigint | null;
  readonly lastExtendedSlot: bigint;
  readonly lastExtendedSlotStartIndex: number;
};

/**
 * Cached ALT entry with expiration
 */
type CachedAlt = {
  readonly alt: AltInfo;
  readonly expiresAt: number;
};

const ADDRESS_LOOKUP_TABLE_PROGRAM =
  'AddressLookupTab1e1111111111111111111111111' as Address;

/**
 * Service for Solana Address Lookup Table (ALT) management
 *
 * Provides:
 * - ALT fetching with TTL-based caching
 * - ALT creation and extension instruction building
 * - Cache management
 *
 * Address Lookup Tables reduce transaction size by referencing addresses
 * from a pre-built table instead of including full 32-byte addresses.
 *
 * @example
 * ```typescript
 * // Fetch ALT with caching
 * const alt = await altService.getAlt(altAddress);
 *
 * // Use addresses from ALT
 * console.log(alt.addresses);
 *
 * // Invalidate cache when ALT is modified
 * altService.invalidateCache(altAddress);
 * ```
 */
@Injectable()
export class SolanaAltService {
  private readonly logger = new Logger(SolanaAltService.name);
  private readonly cache = new Map<string, CachedAlt>();
  private readonly addressEncoder = getAddressEncoder();

  private readonly DEFAULT_TTL_MS = 60_000; // 1 minute

  constructor(private readonly rpcService: SolanaRpcService) {}

  /**
   * Get an Address Lookup Table with caching
   *
   * @param altAddress The ALT address
   * @param ttlMs Cache TTL in milliseconds (default: 60000)
   * @returns ALT information
   *
   * @example
   * ```typescript
   * const alt = await altService.getAlt(altAddress);
   * console.log(`ALT has ${alt.addresses.length} addresses`);
   * ```
   */
  async getAlt(altAddress: Address | string, ttlMs?: number): Promise<AltInfo> {
    const addr = address(altAddress);
    const key = addr.toString();

    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.alt;
    }

    const alt = await this.fetchAlt(addr);

    this.cache.set(key, {
      alt,
      expiresAt: Date.now() + (ttlMs ?? this.DEFAULT_TTL_MS),
    });

    return alt;
  }

  /**
   * Fetch an Address Lookup Table directly from chain
   *
   * Bypasses the cache and always fetches fresh data.
   *
   * @param altAddress The ALT address
   * @returns ALT information
   */
  async fetchAlt(altAddress: Address | string): Promise<AltInfo> {
    const addr = address(altAddress);

    const accountInfo = await this.rpcService.rpc
      .getAccountInfo(addr, { encoding: 'base64' })
      .send();

    if (!accountInfo.value) {
      throw new Error(`Address Lookup Table not found: ${addr}`);
    }

    const data = Buffer.from(accountInfo.value.data[0], 'base64');
    return this.parseAltData(addr, data);
  }

  /**
   * Check if an address exists in an ALT
   *
   * @param altAddress The ALT address
   * @param targetAddress The address to look for
   * @returns true if the address exists in the ALT
   */
  async hasAddress(
    altAddress: Address | string,
    targetAddress: Address | string,
  ): Promise<boolean> {
    const alt = await this.getAlt(altAddress);
    const target = address(targetAddress);

    return alt.addresses.includes(target);
  }

  /**
   * Get the index of an address in an ALT
   *
   * @param altAddress The ALT address
   * @param targetAddress The address to find
   * @returns The index or -1 if not found
   */
  async getAddressIndex(
    altAddress: Address | string,
    targetAddress: Address | string,
  ): Promise<number> {
    const alt = await this.getAlt(altAddress);
    const target = address(targetAddress);

    return alt.addresses.findIndex((a) => a === target);
  }

  /**
   * Invalidate cache for a specific ALT or all ALTs
   *
   * @param altAddress Optional specific ALT to invalidate, or all if not provided
   */
  invalidateCache(altAddress?: Address | string): void {
    if (altAddress) {
      const addr = address(altAddress);
      this.cache.delete(addr.toString());
      this.logger.debug(`Cache invalidated for ALT: ${addr}`);
    } else {
      this.cache.clear();
      this.logger.debug('All ALT caches cleared');
    }
  }

  /**
   * Get cache statistics
   *
   * @returns Cache size and entries info
   */
  getCacheStats(): {
    size: number;
    entries: Array<{ address: string; expiresAt: number }>;
  } {
    const entries: Array<{ address: string; expiresAt: number }> = [];

    for (const [addr, cached] of this.cache) {
      entries.push({ address: addr, expiresAt: cached.expiresAt });
    }

    return {
      size: this.cache.size,
      entries,
    };
  }

  /**
   * Clean up expired cache entries
   *
   * @returns Number of entries removed
   */
  cleanExpiredCache(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, cached] of this.cache) {
      if (cached.expiresAt <= now) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      this.logger.debug(`Cleaned ${removed} expired ALT cache entries`);
    }

    return removed;
  }

  /**
   * Build instruction to extend an ALT with new addresses
   *
   * Note: This returns the instruction data structure. The actual
   * instruction must be built with the ALT program.
   *
   * @param altAddress The ALT address to extend
   * @param authority The ALT authority (must sign)
   * @param payer The account paying for the extension
   * @param newAddresses Addresses to add to the ALT
   * @returns Instruction for extending the ALT
   */
  buildExtendInstruction(
    altAddress: Address | string,
    authority: Address | string,
    payer: Address | string,
    newAddresses: readonly (Address | string)[],
  ): Instruction {
    const altAddr = address(altAddress);
    const authorityAddr = address(authority);
    const payerAddr = address(payer);
    const addresses = newAddresses.map((a) => address(a));

    // Build instruction data for ExtendLookupTable
    const addressBytes = addresses.flatMap((a) => [
      ...this.addressEncoder.encode(a),
    ]);

    // Instruction type (2 = ExtendLookupTable) + length + addresses
    const data = new Uint8Array(4 + 4 + addressBytes.length);
    new DataView(data.buffer).setUint32(0, 2, true); // Instruction type
    new DataView(data.buffer).setUint32(4, addresses.length, true); // Number of addresses
    data.set(addressBytes, 8);

    return {
      programAddress: ADDRESS_LOOKUP_TABLE_PROGRAM,
      accounts: [
        { address: altAddr, role: 1 }, // Writable
        { address: authorityAddr, role: 2 }, // Signer
        { address: payerAddr, role: 3 }, // Writable + Signer
      ],
      data,
    };
  }

  /**
   * Parse raw ALT account data
   */
  private parseAltData(altAddress: Address, data: Buffer): AltInfo {
    // ALT layout:
    // 0-4: Type discriminator (1 for LookupTable)
    // 4-8: Deactivation slot (u64) or 0xFFFFFFFF... if active
    // 12-20: Last extended slot (u64)
    // 20-21: Last extended slot start index (u8)
    // 21: Padding
    // 22-54: Authority (optional 32 bytes)
    // 56+: Addresses (32 bytes each)

    const view = new DataView(data.buffer, data.byteOffset);

    const deactivationSlotRaw = view.getBigUint64(4, true);
    const deactivationSlot =
      deactivationSlotRaw === BigInt('18446744073709551615')
        ? null
        : deactivationSlotRaw;

    const lastExtendedSlot = view.getBigUint64(12, true);
    const lastExtendedSlotStartIndex = data[20];

    // Authority is at offset 22, 32 bytes
    const authorityBytes = data.subarray(22, 54);
    const addressDecoder = getAddressDecoder();
    const authority = authorityBytes.every((b) => b === 0)
      ? null
      : addressDecoder.decode(authorityBytes);

    // Addresses start at offset 56
    const addressesData = data.subarray(56);
    const addresses: Address[] = [];

    for (let i = 0; i < addressesData.length; i += 32) {
      const addrBytes = addressesData.subarray(i, i + 32);
      if (addrBytes.length === 32) {
        addresses.push(addressDecoder.decode(addrBytes));
      }
    }

    return {
      address: altAddress,
      authority,
      addresses,
      deactivationSlot,
      lastExtendedSlot,
      lastExtendedSlotStartIndex,
    };
  }
}
