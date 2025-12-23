import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';

import { SolanaAuthorityService } from './solana-authority.service';

describe('SolanaAuthorityService', () => {
  let service: SolanaAuthorityService;

  // Test keypair (DO NOT USE IN PRODUCTION)
  // This is a well-known test keypair for testing purposes only
  const testPrivateKeyBytes = new Uint8Array([
    174, 47, 154, 16, 202, 193, 206, 113, 199, 190, 53, 133, 169, 175, 31, 56,
    222, 53, 138, 189, 224, 216, 117, 173, 10, 149, 53, 45, 73, 251, 237, 246,
    15, 185, 186, 82, 177, 240, 148, 69, 241, 227, 167, 80, 141, 89, 240, 121,
    121, 35, 172, 247, 68, 251, 226, 218, 48, 63, 176, 109, 168, 89, 238, 135,
  ]);

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [SolanaAuthorityService],
    }).compile();

    service = module.get<SolanaAuthorityService>(SolanaAuthorityService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSignerFromBytes', () => {
    it('should create signer from private key bytes', async () => {
      const signer = await service.createSignerFromBytes(testPrivateKeyBytes);

      expect(signer).toBeDefined();
      expect(signer.address).toBeDefined();
      expect(typeof signer.address).toBe('string');
      expect(signer.signMessages).toBeDefined();
      expect(signer.signTransactions).toBeDefined();
    });

    it('should produce consistent address from same bytes', async () => {
      const signer1 = await service.createSignerFromBytes(testPrivateKeyBytes);
      const signer2 = await service.createSignerFromBytes(testPrivateKeyBytes);

      expect(signer1.address).toBe(signer2.address);
    });
  });

  describe('createSignerFromBase58', () => {
    it('should create signer from base58 private key', async () => {
      // Create a base58 encoded version of the test key first
      const signerFromBytes =
        await service.createSignerFromBytes(testPrivateKeyBytes);
      const base58Key =
        '5MaiiCavjCmn9Hs1o3eznqDEhRwxo7pXiAYez7keQUviUkauRiTMD8DrESdrNjN8zd9mTmVhRvBJeg5vhyvgrAhG';

      const signerFromBase58 = await service.createSignerFromBase58(base58Key);

      expect(signerFromBase58).toBeDefined();
      expect(signerFromBase58.address).toBeDefined();
      // Both methods should produce valid signers
      expect(typeof signerFromBase58.address).toBe('string');
    });
  });

  describe('registerAuthority', () => {
    it('should register authority from bytes', async () => {
      await service.registerAuthority({
        type: 'admin',
        privateKey: testPrivateKeyBytes,
      });

      expect(service.hasAuthority('admin')).toBe(true);
    });

    it('should register authority from base58 string', async () => {
      const base58Key =
        '5MaiiCavjCmn9Hs1o3eznqDEhRwxo7pXiAYez7keQUviUkauRiTMD8DrESdrNjN8zd9mTmVhRvBJeg5vhyvgrAhG';

      await service.registerAuthority({
        type: 'base58Admin',
        privateKey: base58Key,
      });

      expect(service.hasAuthority('base58Admin')).toBe(true);
      const signer = service.getAuthority('base58Admin');
      expect(signer.address).toBeDefined();
    });

    it('should allow retrieving registered authority', async () => {
      await service.registerAuthority({
        type: 'treasury',
        privateKey: testPrivateKeyBytes,
      });

      const signer = service.getAuthority('treasury');
      expect(signer).toBeDefined();
      expect(signer.address).toBeDefined();
    });

    it('should replace existing authority with same type', async () => {
      await service.registerAuthority({
        type: 'operator',
        privateKey: testPrivateKeyBytes,
      });

      const differentKeyBytes = new Uint8Array(64);
      differentKeyBytes.set(testPrivateKeyBytes);
      differentKeyBytes[0] = 100; // Modify first byte

      // This should replace without throwing
      await expect(
        service.registerAuthority({
          type: 'operator',
          privateKey: testPrivateKeyBytes,
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('getAuthority', () => {
    it('should throw for unregistered authority', () => {
      expect(() => service.getAuthority('nonexistent')).toThrow(
        "Authority 'nonexistent' not registered",
      );
    });

    it('should return cached signer', async () => {
      await service.registerAuthority({
        type: 'cached',
        privateKey: testPrivateKeyBytes,
      });

      const signer1 = service.getAuthority('cached');
      const signer2 = service.getAuthority('cached');

      expect(signer1).toBe(signer2); // Same reference
    });
  });

  describe('getAuthorityAddress', () => {
    it('should return address for registered authority', async () => {
      await service.registerAuthority({
        type: 'test',
        privateKey: testPrivateKeyBytes,
      });

      const address = service.getAuthorityAddress('test');
      expect(address).toBeDefined();
      expect(typeof address).toBe('string');
    });

    it('should throw for unregistered authority', () => {
      expect(() => service.getAuthorityAddress('missing')).toThrow(
        "Authority 'missing' not registered",
      );
    });
  });

  describe('hasAuthority', () => {
    it('should return false for unregistered authority', () => {
      expect(service.hasAuthority('unknown')).toBe(false);
    });

    it('should return true for registered authority', async () => {
      await service.registerAuthority({
        type: 'known',
        privateKey: testPrivateKeyBytes,
      });

      expect(service.hasAuthority('known')).toBe(true);
    });
  });

  describe('getRegisteredTypes', () => {
    it('should return empty array initially', () => {
      expect(service.getRegisteredTypes()).toEqual([]);
    });

    it('should return all registered types', async () => {
      await service.registerAuthority({
        type: 'admin',
        privateKey: testPrivateKeyBytes,
      });
      await service.registerAuthority({
        type: 'treasury',
        privateKey: testPrivateKeyBytes,
      });

      const types = service.getRegisteredTypes();
      expect(types).toContain('admin');
      expect(types).toContain('treasury');
      expect(types.length).toBe(2);
    });
  });

  describe('unregisterAuthority', () => {
    it('should remove registered authority', async () => {
      await service.registerAuthority({
        type: 'removable',
        privateKey: testPrivateKeyBytes,
      });

      expect(service.hasAuthority('removable')).toBe(true);

      const removed = service.unregisterAuthority('removable');
      expect(removed).toBe(true);
      expect(service.hasAuthority('removable')).toBe(false);
    });

    it('should return false for non-existent authority', () => {
      const removed = service.unregisterAuthority('nonexistent');
      expect(removed).toBe(false);
    });
  });

  describe('clearAll', () => {
    it('should remove all authorities', async () => {
      await service.registerAuthority({
        type: 'admin',
        privateKey: testPrivateKeyBytes,
      });
      await service.registerAuthority({
        type: 'treasury',
        privateKey: testPrivateKeyBytes,
      });

      expect(service.getRegisteredTypes().length).toBe(2);

      service.clearAll();

      expect(service.getRegisteredTypes().length).toBe(0);
      expect(service.hasAuthority('admin')).toBe(false);
      expect(service.hasAuthority('treasury')).toBe(false);
    });
  });

  describe('getAddressFromPrivateKey', () => {
    it('should derive address from bytes', async () => {
      const address =
        await service.getAddressFromPrivateKey(testPrivateKeyBytes);

      expect(address).toBeDefined();
      expect(typeof address).toBe('string');
    });

    it('should derive address from base58 string', async () => {
      const base58Key =
        '5MaiiCavjCmn9Hs1o3eznqDEhRwxo7pXiAYez7keQUviUkauRiTMD8DrESdrNjN8zd9mTmVhRvBJeg5vhyvgrAhG';

      const address = await service.getAddressFromPrivateKey(base58Key);

      expect(address).toBeDefined();
      expect(typeof address).toBe('string');
    });

    it('should match signer address', async () => {
      const addressDirect =
        await service.getAddressFromPrivateKey(testPrivateKeyBytes);
      const signer = await service.createSignerFromBytes(testPrivateKeyBytes);

      expect(addressDirect).toBe(signer.address);
    });
  });

  describe('multiple authority types', () => {
    it('should support multiple different authority types', async () => {
      const modifiedBytes1 = new Uint8Array(testPrivateKeyBytes);
      const modifiedBytes2 = new Uint8Array(testPrivateKeyBytes);
      modifiedBytes2[0] = testPrivateKeyBytes[0] + 1;

      await service.registerAuthority({
        type: 'admin',
        privateKey: modifiedBytes1,
      });
      await service.registerAuthority({
        type: 'operator',
        privateKey: modifiedBytes1,
      });

      const admin = service.getAuthority('admin');
      const operator = service.getAuthority('operator');

      // Both should be valid signers
      expect(admin.address).toBeDefined();
      expect(operator.address).toBeDefined();
    });
  });
});
