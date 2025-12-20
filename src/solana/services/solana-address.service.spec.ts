import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import type { Address } from '@solana/kit';

import { SolanaAddressService } from './solana-address.service';

describe('SolanaAddressService', () => {
  let service: SolanaAddressService;

  const testProgramId =
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address;
  const testAddress = '11111111111111111111111111111111' as Address;
  const testMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' as Address;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [SolanaAddressService],
    }).compile();

    service = module.get<SolanaAddressService>(SolanaAddressService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('derivePda', () => {
    it('should derive PDA with string seed', async () => {
      const result = await service.derivePda(testProgramId, ['test_seed']);

      expect(result).toBeDefined();
      expect(result.address).toBeDefined();
      expect(typeof result.bump).toBe('number');
      expect(result.bump).toBeGreaterThanOrEqual(0);
      expect(result.bump).toBeLessThanOrEqual(255);
    });

    it('should derive PDA with address seed', async () => {
      const result = await service.derivePda(testProgramId, [testAddress]);

      expect(result).toBeDefined();
      expect(result.address).toBeDefined();
    });

    it('should derive PDA with multiple seeds', async () => {
      const result = await service.derivePda(testProgramId, [
        'user_state',
        testAddress,
      ]);

      expect(result).toBeDefined();
      expect(result.address).toBeDefined();
    });

    it('should derive PDA with number seed', async () => {
      const result = await service.derivePda(testProgramId, [
        'card',
        123,
      ]);

      expect(result).toBeDefined();
      expect(result.address).toBeDefined();
    });

    it('should derive PDA with bigint seed', async () => {
      const result = await service.derivePda(testProgramId, [
        'card',
        BigInt(123456789),
      ]);

      expect(result).toBeDefined();
      expect(result.address).toBeDefined();
    });

    it('should derive PDA with Uint8Array seed', async () => {
      const bytes = new Uint8Array([1, 2, 3, 4]);
      const result = await service.derivePda(testProgramId, [bytes]);

      expect(result).toBeDefined();
      expect(result.address).toBeDefined();
    });

    it('should accept string program ID', async () => {
      const result = await service.derivePda(
        'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
        ['test'],
      );

      expect(result).toBeDefined();
      expect(result.address).toBeDefined();
    });

    it('should produce consistent results for same inputs', async () => {
      const result1 = await service.derivePda(testProgramId, ['test_seed']);
      const result2 = await service.derivePda(testProgramId, ['test_seed']);

      expect(result1.address).toBe(result2.address);
      expect(result1.bump).toBe(result2.bump);
    });

    it('should produce different results for different seeds', async () => {
      const result1 = await service.derivePda(testProgramId, ['seed_a']);
      const result2 = await service.derivePda(testProgramId, ['seed_b']);

      expect(result1.address).not.toBe(result2.address);
    });
  });

  describe('deriveAta', () => {
    it('should derive ATA address', async () => {
      const ata = await service.deriveAta(testAddress, testMint);

      expect(ata).toBeDefined();
      expect(typeof ata).toBe('string');
    });

    it('should accept string addresses', async () => {
      const ata = await service.deriveAta(
        '11111111111111111111111111111111',
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      );

      expect(ata).toBeDefined();
    });

    it('should produce consistent results', async () => {
      const ata1 = await service.deriveAta(testAddress, testMint);
      const ata2 = await service.deriveAta(testAddress, testMint);

      expect(ata1).toBe(ata2);
    });

    it('should produce different results for different owners', async () => {
      const owner2 = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address;
      const ata1 = await service.deriveAta(testAddress, testMint);
      const ata2 = await service.deriveAta(owner2, testMint);

      expect(ata1).not.toBe(ata2);
    });

    it('should accept custom token program', async () => {
      const tokenProgram = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb' as Address;
      const ata = await service.deriveAta(testAddress, testMint, tokenProgram);

      expect(ata).toBeDefined();
    });
  });

  describe('isValidAddress', () => {
    it('should return true for valid address', () => {
      expect(service.isValidAddress('11111111111111111111111111111111')).toBe(
        true,
      );
    });

    it('should return true for another valid address', () => {
      expect(
        service.isValidAddress('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
      ).toBe(true);
    });

    it('should return false for invalid address', () => {
      expect(service.isValidAddress('invalid')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(service.isValidAddress('')).toBe(false);
    });

    it('should return false for too short address', () => {
      expect(service.isValidAddress('1111111111111111111111111111111')).toBe(
        false,
      );
    });
  });

  describe('addressToBytes', () => {
    it('should convert address to bytes', () => {
      const bytes = service.addressToBytes(testAddress);

      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBe(32);
    });

    it('should accept string address', () => {
      const bytes = service.addressToBytes(
        '11111111111111111111111111111111',
      );

      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBe(32);
    });
  });

  describe('bytesToAddress', () => {
    it('should convert bytes to address', () => {
      const originalBytes = service.addressToBytes(testAddress);
      const address = service.bytesToAddress(originalBytes);

      expect(address).toBe(testAddress);
    });

    it('should round-trip correctly', () => {
      const original = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address;
      const bytes = service.addressToBytes(original);
      const result = service.bytesToAddress(bytes);

      expect(result).toBe(original);
    });
  });

  describe('toAddress', () => {
    it('should return typed Address for valid input', () => {
      const result = service.toAddress('11111111111111111111111111111111');

      expect(result).toBe('11111111111111111111111111111111');
    });

    it('should throw for invalid address', () => {
      expect(() => service.toAddress('invalid')).toThrow('Invalid address');
    });
  });

  describe('seed encoding', () => {
    it('should handle u8 number seed', async () => {
      const result = await service.derivePda(testProgramId, ['card', 255]);
      expect(result).toBeDefined();
    });

    it('should handle u16 number seed', async () => {
      const result = await service.derivePda(testProgramId, ['card', 65535]);
      expect(result).toBeDefined();
    });

    it('should handle u32 number seed', async () => {
      const result = await service.derivePda(testProgramId, [
        'card',
        4294967295,
      ]);
      expect(result).toBeDefined();
    });

    it('should throw for negative number', async () => {
      await expect(
        service.derivePda(testProgramId, ['card', -1]),
      ).rejects.toThrow('Number out of range');
    });

    it('should throw for number > u32', async () => {
      await expect(
        service.derivePda(testProgramId, ['card', 4294967296]),
      ).rejects.toThrow('Number out of range');
    });

    it('should throw for negative bigint', async () => {
      await expect(
        service.derivePda(testProgramId, ['card', BigInt(-1)]),
      ).rejects.toThrow('Negative bigint not supported');
    });
  });
});
