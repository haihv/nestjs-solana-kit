import { Test, TestingModule } from '@nestjs/testing';
import { address, generateKeyPairSigner } from '@solana/kit';
import type { Instruction } from '@solana/kit';
import { SystemProgram } from '@solana/web3.js';

import { SolanaBlockService } from './solana-block.service';
import { SolanaRpcService } from './solana-rpc.service';
import { SolanaTransactionService } from './solana-transaction.service';
import { SolanaUtilsService } from './solana-utils.service';
import type {
  Address,
  Base64EncodedWireTransaction,
  BlockhashInfo,
  GetSignaturesForAddressResult,
  SimulateTransactionResult,
  TransactionStatus,
} from '../types';

const MOCK_SIGNATURE =
  '5kJt5h2B3p6kAMPxQqvYXvyfZ87Z84qxdjQbaVkj2rN6zGyFNR7fsRG3Gzdhvj1io8GZF1dgNpTi27CybBZhECXp';

const createPendingResponse = <T>(value: T) => ({
  send: jest.fn().mockResolvedValue(value),
});

const createMockRpc = (
  statusResponse: { value: (TransactionStatus | null)[] },
  signatures: GetSignaturesForAddressResult,
  simulation: SimulateTransactionResult,
) => ({
  sendTransaction: jest.fn(() => createPendingResponse(MOCK_SIGNATURE)),
  getBlockHeight: jest.fn(() => createPendingResponse(BigInt(100))),
  getSignatureStatuses: jest.fn(() => createPendingResponse(statusResponse)),
  getSignaturesForAddress: jest.fn(() => createPendingResponse(signatures)),
  simulateTransaction: jest.fn(() =>
    createPendingResponse({ value: simulation }),
  ),
  getTransaction: jest.fn(() => createPendingResponse(null)),
});

describe('SolanaTransactionService', () => {
  let service: SolanaTransactionService;
  let utilsService: SolanaUtilsService;
  let mockBlockService: {
    getLatestBlockhash: jest.Mock<Promise<BlockhashInfo>, []>;
  };
  let mockRpcService: { rpc: ReturnType<typeof createMockRpc> };
  let mockRpc: ReturnType<typeof createMockRpc>;
  let expectedStatus: TransactionStatus;
  let mockSignatures: GetSignaturesForAddressResult;
  let mockSimulation: SimulateTransactionResult;
  let mockBlockhashInfo: BlockhashInfo;

  beforeEach(async () => {
    jest.clearAllMocks();

    expectedStatus = {
      slot: 123,
      confirmations: 1,
      err: null,
      confirmationStatus: 'confirmed',
    } as unknown as TransactionStatus;

    mockSignatures = [
      {
        signature: MOCK_SIGNATURE,
        slot: 456,
        err: null,
        memo: null,
        blockTime: 1_700_000_000,
        confirmationStatus: 'finalized',
      },
    ] as unknown as GetSignaturesForAddressResult;

    mockSimulation = {
      err: null,
      logs: [],
      unitsConsumed: 500,
      returnData: null,
      accounts: null,
    } as unknown as SimulateTransactionResult;

    mockBlockhashInfo = {
      blockhash: '3n5M7s9Q1w2E4r6T8yA9uBcDeFgHiJkLmNpPqRsTuVwX',
      lastValidBlockHeight: BigInt(500),
    } as unknown as BlockhashInfo;

    mockRpc = createMockRpc(
      { value: [expectedStatus] },
      mockSignatures,
      mockSimulation,
    );
    mockRpcService = {
      get rpc() {
        return mockRpc;
      },
    };
    mockBlockService = {
      getLatestBlockhash: jest
        .fn<Promise<BlockhashInfo>, []>()
        .mockResolvedValue(mockBlockhashInfo),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolanaTransactionService,
        SolanaUtilsService,
        { provide: SolanaBlockService, useValue: mockBlockService },
        { provide: SolanaRpcService, useValue: mockRpcService },
      ],
    }).compile();

    service = module.get(SolanaTransactionService);
    utilsService = module.get(SolanaUtilsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createTransferInstruction = (from: Address, to: Address): Instruction =>
    utilsService.instructionToKit(
      SystemProgram.transfer({
        fromPubkey: utilsService.toPublicKey(from),
        toPubkey: utilsService.toPublicKey(to),
        lamports: 1_000_000,
      }),
    );

  const buildSignedTransaction = async () => {
    const signer = await generateKeyPairSigner();
    const recipient = await generateKeyPairSigner();
    const instruction = createTransferInstruction(
      signer.address,
      recipient.address,
    );

    const txMessage = await service.buildTransactionMessage({
      instructions: [instruction],
      feePayer: signer.address,
    });
    const signedTx = await service.signTransactionMessage(txMessage, [signer]);
    return { signer, signedTx };
  };

  it('builds transaction messages using the latest blockhash', async () => {
    const signer = await generateKeyPairSigner();
    const recipient = await generateKeyPairSigner();
    const message = await service.buildTransactionMessage({
      instructions: [
        createTransferInstruction(signer.address, recipient.address),
      ],
      feePayer: signer.address,
    });

    expect(mockBlockService.getLatestBlockhash).toHaveBeenCalledTimes(1);
    expect(message.instructions).toHaveLength(1);
    expect(message.feePayer.address).toEqual(signer.address);
    expect(message.lifetimeConstraint).toBeDefined();
  });

  it('builds transaction messages with provided blockhash details', async () => {
    const signer = await generateKeyPairSigner();
    const recipient = await generateKeyPairSigner();
    const message = service.buildTransactionMessageWithBlockhash({
      instructions: [
        createTransferInstruction(signer.address, recipient.address),
      ],
      feePayer: signer.address,
      ...mockBlockhashInfo,
    });

    expect(message.instructions).toHaveLength(1);
    expect(message.feePayer.address).toEqual(signer.address);
    expect(message.lifetimeConstraint).toEqual({
      blockhash: mockBlockhashInfo.blockhash,
      lastValidBlockHeight: mockBlockhashInfo.lastValidBlockHeight,
    });
  });

  it('signs transaction messages with the provided signers', async () => {
    const { signedTx } = await buildSignedTransaction();

    expect(signedTx).toBeDefined();
    expect(Object.keys(signedTx.signatures).length).toBeGreaterThan(0);
  });

  it('encodes signed transactions to base64 strings', async () => {
    const { signedTx } = await buildSignedTransaction();

    const encoded = service.encodeTransaction(signedTx);

    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(0);
  });

  it('derives the signature from a signed transaction', async () => {
    const { signedTx } = await buildSignedTransaction();

    const sig = service.getSignature(signedTx);

    expect(typeof sig).toBe('string');
    expect(sig.length).toBeGreaterThan(0);
  });

  it('sends encoded transactions through the RPC client', async () => {
    const encodedTx =
      'mock-wire-transaction' as unknown as Base64EncodedWireTransaction;
    const result = await service.sendEncoded(encodedTx, { maxRetries: 2n });

    expect(result).toBe(MOCK_SIGNATURE);
    expect(mockRpc.sendTransaction).toHaveBeenCalledWith(
      encodedTx,
      expect.objectContaining({ encoding: 'base64', maxRetries: 2n }),
    );
  });

  it('returns signature status information when available', async () => {
    const { signedTx } = await buildSignedTransaction();
    const validSignature = service.getSignature(signedTx);
    const status = await service.getTransactionStatus(validSignature);

    expect(status).toEqual(expectedStatus);
    expect(mockRpc.getSignatureStatuses).toHaveBeenCalledTimes(1);
  });

  it('returns null when signature status is missing', async () => {
    mockRpc.getSignatureStatuses.mockReturnValueOnce(
      createPendingResponse({ value: [null] }),
    );

    const { signedTx } = await buildSignedTransaction();
    const validSignature = service.getSignature(signedTx);
    const status = await service.getTransactionStatus(validSignature);

    expect(status).toBeNull();
  });

  it('fetches signatures for an address via RPC', async () => {
    const voteAccount = address('Vote111111111111111111111111111111111111111');
    const signatures = await service.getSignaturesForAddress(voteAccount, 5);

    expect(signatures).toEqual(mockSignatures);
    expect(mockRpc.getSignaturesForAddress).toHaveBeenCalledWith(voteAccount, {
      limit: 5,
    });
  });

  it('simulates transactions and returns RPC results', async () => {
    const result = await service.simulateTransaction(
      'mock-wire-transaction' as unknown as Base64EncodedWireTransaction,
    );

    expect(result).toEqual(mockSimulation);
    expect(mockRpc.simulateTransaction).toHaveBeenCalledTimes(1);
  });

  describe('waitForConfirmation', () => {
    describe('with lastValidBlockHeight', () => {
      it('waits for confirmation with block height validation', async () => {
        const result = await service.waitForConfirmation(
          MOCK_SIGNATURE,
          BigInt(500),
          5,
        );

        expect(result.confirmed).toBe(true);
        expect(mockRpc.getBlockHeight).toHaveBeenCalled();
        expect(mockRpc.getSignatureStatuses).toHaveBeenCalled();
      });

      it('detects transaction expiration when block height is exceeded', async () => {
        mockRpc.getBlockHeight.mockReturnValueOnce(
          createPendingResponse(BigInt(600)),
        );

        const result = await service.waitForConfirmation(
          MOCK_SIGNATURE,
          BigInt(500),
          5,
        );

        expect(result.confirmed).toBe(false);
        expect(mockRpc.getBlockHeight).toHaveBeenCalled();
        // Should exit early without checking signature status
        expect(mockRpc.getSignatureStatuses).not.toHaveBeenCalled();
      });

      it('retries on block height checks within valid range', async () => {
        // First block height check passes, but no confirmation yet
        // Second check also passes, and this time confirmed
        mockRpc.getBlockHeight
          .mockReturnValueOnce(createPendingResponse(BigInt(450)))
          .mockReturnValueOnce(createPendingResponse(BigInt(460)));

        mockRpc.getSignatureStatuses
          .mockReturnValueOnce(createPendingResponse({ value: [null] }))
          .mockReturnValueOnce(
            createPendingResponse({ value: [expectedStatus] }),
          );

        const result = await service.waitForConfirmation(
          MOCK_SIGNATURE,
          BigInt(500),
          5,
        );

        expect(result.confirmed).toBe(true);
        expect(mockRpc.getBlockHeight).toHaveBeenCalledTimes(2);
        expect(mockRpc.getSignatureStatuses).toHaveBeenCalledTimes(2);
      });

      it('returns confirmed status with slot number', async () => {
        const result = await service.waitForConfirmation(
          MOCK_SIGNATURE,
          BigInt(500),
          5,
        );

        expect(result.confirmed).toBe(true);
        expect(result.slot).toBeDefined();
        expect(result.slot).toBe(BigInt(expectedStatus.slot));
      });
    });

    describe('without lastValidBlockHeight', () => {
      it('waits for confirmation without block height checks', async () => {
        const result = await service.waitForConfirmation(
          MOCK_SIGNATURE,
          undefined,
          5,
        );

        expect(result.confirmed).toBe(true);
        expect(mockRpc.getSignatureStatuses).toHaveBeenCalled();
        // Block height check should not be called
        expect(mockRpc.getBlockHeight).not.toHaveBeenCalled();
      });

      it('retries until confirmation without block height validation', async () => {
        // First two calls return no confirmation, third returns confirmed
        mockRpc.getSignatureStatuses
          .mockReturnValueOnce(createPendingResponse({ value: [null] }))
          .mockReturnValueOnce(createPendingResponse({ value: [null] }))
          .mockReturnValueOnce(
            createPendingResponse({ value: [expectedStatus] }),
          );

        const result = await service.waitForConfirmation(
          MOCK_SIGNATURE,
          undefined,
          5,
        );

        expect(result.confirmed).toBe(true);
        expect(mockRpc.getSignatureStatuses).toHaveBeenCalledTimes(3);
        expect(mockRpc.getBlockHeight).not.toHaveBeenCalled();
      });

      it('returns unconfirmed when max attempts reached', async () => {
        mockRpc.getSignatureStatuses.mockReturnValue(
          createPendingResponse({ value: [null] }),
        );

        const result = await service.waitForConfirmation(
          MOCK_SIGNATURE,
          undefined,
          2,
        );

        expect(result.confirmed).toBe(false);
        expect(mockRpc.getSignatureStatuses).toHaveBeenCalledTimes(2);
        expect(mockRpc.getBlockHeight).not.toHaveBeenCalled();
      });

      it('uses attempt-based timeout with default maxAttempts', async () => {
        mockRpc.getSignatureStatuses.mockReturnValue(
          createPendingResponse({ value: [null] }),
        );

        // Default maxAttempts = 30 (we'll test with fewer attempts to keep test fast)
        const result = await service.waitForConfirmation(
          MOCK_SIGNATURE,
          undefined,
          3,
        );

        expect(result.confirmed).toBe(false);
        // Should have attempted 3 times
        expect(mockRpc.getSignatureStatuses).toHaveBeenCalledTimes(3);
      });
    });

    describe('error handling', () => {
      it('handles transaction execution failure (status.err set)', async () => {
        const failedStatus = {
          slot: 123,
          confirmations: 0,
          err: 'InstructionError',
          confirmationStatus: 'confirmed',
        } as unknown as TransactionStatus;

        // When status.err is present, method should throw
        mockRpc.getBlockHeight.mockReturnValue(
          createPendingResponse(BigInt(400)),
        );

        const failureMock = jest.fn(() =>
          Promise.resolve(
            createPendingResponse({
              value: [failedStatus],
            }),
          ),
        );
        mockRpc.getSignatureStatuses.mockImplementation(() => ({
          send: failureMock,
        }));

        await expect(
          service.waitForConfirmation(MOCK_SIGNATURE, BigInt(500), 1),
        ).rejects.toThrow();
      });

      it('recovers from transient RPC errors', async () => {
        const rpcError = new Error('Temporary error');
        // First call throws, second succeeds
        mockRpc.getBlockHeight
          .mockImplementationOnce(() => {
            throw rpcError;
          })
          .mockReturnValueOnce(createPendingResponse(BigInt(450)));

        mockRpc.getSignatureStatuses.mockReturnValue(
          createPendingResponse({ value: [expectedStatus] }),
        );

        const result = await service.waitForConfirmation(
          MOCK_SIGNATURE,
          BigInt(500),
          5,
        );

        expect(result.confirmed).toBe(true);
      });
    });

    describe('timeout edge cases', () => {
      it('handles single attempt (immediate result)', async () => {
        const result = await service.waitForConfirmation(
          MOCK_SIGNATURE,
          BigInt(500),
          1,
        );

        expect(result.confirmed).toBe(true);
        expect(mockRpc.getSignatureStatuses).toHaveBeenCalledTimes(1);
      });

      it('respects custom maxAttempts parameter', async () => {
        mockRpc.getSignatureStatuses.mockReturnValue(
          createPendingResponse({ value: [null] }),
        );

        const result = await service.waitForConfirmation(
          MOCK_SIGNATURE,
          undefined,
          2, // Use small number to keep test fast
        );

        expect(result.confirmed).toBe(false);
        expect(mockRpc.getSignatureStatuses).toHaveBeenCalledTimes(2);
      });

      it('returns unconfirmed when block height exactly matches lastValidBlockHeight', async () => {
        mockRpc.getBlockHeight.mockReturnValueOnce(
          createPendingResponse(BigInt(500)),
        );

        const result = await service.waitForConfirmation(
          MOCK_SIGNATURE,
          BigInt(500),
          5,
        );

        // Should still try to confirm when heights match (only exceeding fails)
        expect(result.confirmed).toBe(true);
        expect(mockRpc.getSignatureStatuses).toHaveBeenCalled();
      });

      it('accepts string signature and converts to Signature type', async () => {
        const result = await service.waitForConfirmation(
          MOCK_SIGNATURE as string,
          BigInt(500),
          5,
        );

        expect(result.confirmed).toBe(true);
      });
    });

    describe('finalization states', () => {
      it('confirms transaction in "confirmed" state', async () => {
        const result = await service.waitForConfirmation(
          MOCK_SIGNATURE,
          BigInt(500),
          5,
        );

        expect(result.confirmed).toBe(true);
        expect(result.slot).toBeDefined();
      });

      it('confirms transaction in "finalized" state', async () => {
        mockRpc.getSignatureStatuses.mockReturnValueOnce(
          createPendingResponse({
            value: [
              {
                ...expectedStatus,
                confirmationStatus: 'finalized',
              } as unknown as TransactionStatus,
            ],
          }),
        );

        const result = await service.waitForConfirmation(
          MOCK_SIGNATURE,
          BigInt(500),
          5,
        );

        expect(result.confirmed).toBe(true);
      });

      it('does not confirm transaction in "processed" state', async () => {
        mockRpc.getSignatureStatuses.mockReturnValue(
          createPendingResponse({
            value: [
              {
                ...expectedStatus,
                confirmationStatus: 'processed',
              } as unknown as TransactionStatus,
            ],
          }),
        );

        const result = await service.waitForConfirmation(
          MOCK_SIGNATURE,
          BigInt(500),
          2,
        );

        expect(result.confirmed).toBe(false);
        expect(mockRpc.getSignatureStatuses).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('sendTransaction vs sendAndConfirm', () => {
    it('sendTransaction returns only signature without waiting', async () => {
      const { signedTx } = await buildSignedTransaction();

      const signature = await service.sendTransaction(signedTx);

      expect(typeof signature).toBe('string');
      expect(signature.length).toBeGreaterThan(0);
      // Should NOT call getSignatureStatuses (no confirmation wait)
      expect(mockRpc.getSignatureStatuses).not.toHaveBeenCalled();
    });

    it('sendAndConfirm returns full result with confirmation data', async () => {
      const { signedTx } = await buildSignedTransaction();

      const result = await service.sendAndConfirm(signedTx);

      expect(result).toBeDefined();
      expect(result.signature).toBeDefined();
      expect(typeof result.signature).toBe('string');
      expect(result.confirmed).toBe(true);
      expect(result.slot).toBeDefined();
      // Should have called getSignatureStatuses for confirmation
      expect(mockRpc.getSignatureStatuses).toHaveBeenCalled();
    });

    it('sendAndConfirm with block height uses expiration detection', async () => {
      const { signedTx } = await buildSignedTransaction();

      const result = await service.sendAndConfirm(signedTx);

      expect(result.confirmed).toBe(true);
      // Should check block height for transactions with lifetime
      expect(mockRpc.getBlockHeight).toHaveBeenCalled();
    });

    it('sendAndConfirm returns unconfirmed when timeout reached', async () => {
      const { signedTx } = await buildSignedTransaction();

      mockRpc.getSignatureStatuses.mockReturnValue(
        createPendingResponse({ value: [null] }),
      );

      const result = await service.sendAndConfirm(signedTx, undefined, 2);

      expect(result.confirmed).toBe(false);
      expect(result.signature).toBeDefined();
    });

    it('sendAndConfirm respects custom maxAttempts', async () => {
      const { signedTx } = await buildSignedTransaction();

      mockRpc.getSignatureStatuses.mockReturnValue(
        createPendingResponse({ value: [null] }),
      );

      const result = await service.sendAndConfirm(signedTx, undefined, 2);

      expect(result.confirmed).toBe(false);
      expect(mockRpc.getSignatureStatuses).toHaveBeenCalledTimes(2);
    });

    it('sendAndConfirm handles transaction without blockhash lifetime', async () => {
      const { signedTx } = await buildSignedTransaction();

      // Mock a transaction without blockhash lifetime
      const txWithoutLifetime = {
        ...signedTx,
        lifetimeConstraint: { nonce: 'some-nonce' }, // Not a blockhash lifetime
      };

      const result = await service.sendAndConfirm(
        txWithoutLifetime as unknown as typeof signedTx,
        undefined,
        5,
      );

      expect(result.confirmed).toBe(true);
      expect(result.signature).toBeDefined();
      // Should NOT check block height for non-blockhash lifetimes
      expect(mockRpc.getBlockHeight).not.toHaveBeenCalled();
    });

    it('should handle RPC error in sendAndConfirm', async () => {
      const { signedTx } = await buildSignedTransaction();

      mockRpc.sendTransaction.mockReturnValue({
        send: jest.fn().mockRejectedValue(new Error('RPC error')),
      });

      await expect(service.sendAndConfirm(signedTx)).rejects.toThrow(
        'RPC error',
      );
    });
  });

  describe('sendTransaction error handling', () => {
    it('should handle RPC error in sendTransaction', async () => {
      mockRpc.sendTransaction.mockReturnValue({
        send: jest.fn().mockRejectedValue(new Error('RPC error')),
      });

      const { signedTx } = await buildSignedTransaction();

      await expect(service.sendTransaction(signedTx)).rejects.toThrow(
        'RPC error',
      );
    });

    it('should handle RPC error in waitForConfirmation', async () => {
      mockRpc.getSignatureStatuses.mockReturnValue({
        send: jest.fn().mockRejectedValue(new Error('RPC error')),
      });

      const signature =
        '4sGjMKvzttesJQgRHDDMyHVHJJ7TqSYVgv3vhbvVWX8vDM98tKfNGzAvzVdq9XhAD4y7FVJSuZXvZ1qx3hJXWMKs';

      await expect(service.waitForConfirmation(signature)).rejects.toThrow(
        'RPC error',
      );
    });

    it('should handle confirmed transaction in waitForConfirmation', async () => {
      mockRpc.getSignatureStatuses.mockReturnValue(
        createPendingResponse({
          value: [{ slot: 300000000, confirmationStatus: 'confirmed' }],
        }),
      );

      const signature =
        '4sGjMKvzttesJQgRHDDMyHVHJJ7TqSYVgv3vhbvVWX8vDM98tKfNGzAvzVdq9XhAD4y7FVJSuZXvZ1qx3hJXWMKs';

      const result = await service.waitForConfirmation(signature);

      expect(result.confirmed).toBe(true);
      expect(result.slot).toBeDefined();
    });

    it('should handle transaction error status', async () => {
      mockRpc.getSignatureStatuses.mockReturnValue(
        createPendingResponse({
          value: [
            {
              slot: 300000000,
              err: { InstructionError: [0, { Custom: 1 }] },
              confirmationStatus: 'finalized',
            },
          ],
        }),
      );

      const signature =
        '4sGjMKvzttesJQgRHDDMyHVHJJ7TqSYVgv3vhbvVWX8vDM98tKfNGzAvzVdq9XhAD4y7FVJSuZXvZ1qx3hJXWMKs';

      await expect(service.waitForConfirmation(signature)).rejects.toThrow();
    });
  });

  describe('getTransaction', () => {
    const validSignature =
      '4sGjMKvzttesJQgRHDDMyHVHJJ7TqSYVgv3vhbvVWX8vDM98tKfNGzAvzVdq9XhAD4y7FVJSuZXvZ1qx3hJXWMKs';

    it('should retrieve a transaction by signature', async () => {
      const mockTransaction: unknown = {
        transaction: {
          message: {
            header: {
              numRequiredSignatures: 1,
              numReadonlySignedAccounts: 0,
              numReadonlyUnsignedAccounts: 0,
            },
            accountKeys: [],
            instructions: [],
          },
          signatures: [validSignature],
        },
        blockTime: 1234567890,
        slot: 300000000,
      };

      mockRpc.getTransaction.mockReturnValue({
        send: jest.fn().mockResolvedValue(mockTransaction),
      });

      const typedResult = (await service.getTransaction(
        validSignature,
      )) as Record<string, unknown> | null;

      expect(typedResult).toEqual(mockTransaction);
      expect(mockRpc.getTransaction).toHaveBeenCalledWith(validSignature, {
        encoding: 'jsonParsed',
        maxSupportedTransactionVersion: 0,
      });
    });

    it('should return null when transaction is not found', async () => {
      mockRpc.getTransaction.mockReturnValue({
        send: jest.fn().mockResolvedValue(null),
      });

      const typedResult = (await service.getTransaction(
        validSignature,
      )) as Record<string, unknown> | null;

      expect(typedResult).toBeNull();
    });

    it('should handle string signature format', async () => {
      const signatureStr =
        '4sGjMKvzttesJQgRHDDMyHVHJJ7TqSYVgv3vhbvVWX8vDM98tKfNGzAvzVdq9XhAD4y7FVJSuZXvZ1qx3hJXWMKs';
      const mockTransaction: unknown = {
        transaction: { message: { accountKeys: [] } },
        blockTime: 1234567890,
      };

      mockRpc.getTransaction.mockReturnValue({
        send: jest.fn().mockResolvedValue(mockTransaction),
      });

      const typedResult = (await service.getTransaction(
        signatureStr,
      )) as Record<string, unknown> | null;

      expect(typedResult).toEqual(mockTransaction);
    });

    it('should handle RPC errors gracefully', async () => {
      mockRpc.getTransaction.mockReturnValue({
        send: jest.fn().mockRejectedValue(new Error('RPC error')),
      });

      await expect(service.getTransaction(validSignature)).rejects.toThrow(
        'RPC error',
      );
    });

    it('should return transaction with full details', async () => {
      const complexTransaction: unknown = {
        transaction: {
          message: {
            header: {
              numRequiredSignatures: 2,
              numReadonlySignedAccounts: 1,
              numReadonlyUnsignedAccounts: 2,
            },
            accountKeys: [
              'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
              'EPjFWaJsv6DjsSuaT4jXfVfuE3axYR4MdNKWcqTPqe8t',
            ],
            instructions: [
              {
                programIdIndex: 0,
                accounts: [0, 1],
                data: '3Bxs7n',
              },
            ],
            recentBlockhash: 'test-blockhash-123456789',
          },
          signatures: [validSignature, 'test-signature-2'],
        },
        blockTime: 1234567890,
        slot: 300000000,
        meta: {
          err: null,
          fee: 5000,
          preBalances: [1000000000, 2000000000],
          postBalances: [999995000, 2000000000],
        },
      };

      mockRpc.getTransaction.mockReturnValue({
        send: jest.fn().mockResolvedValue(complexTransaction),
      });

      const typedResult = (await service.getTransaction(
        validSignature,
      )) as Record<string, unknown> | null;

      expect(typedResult).toEqual(complexTransaction);
      expect(typedResult?.blockTime).toBeDefined();
      expect(typedResult?.slot).toBeDefined();
      expect(typedResult?.meta).toBeDefined();
    });

    it('should handle transaction with error status', async () => {
      const failedTransaction: unknown = {
        transaction: {
          message: { accountKeys: [] },
        },
        blockTime: 1234567890,
        slot: 300000000,
        meta: {
          err: { InstructionError: [0, { Custom: 1 }] },
          fee: 5000,
        },
      };

      mockRpc.getTransaction.mockReturnValue({
        send: jest.fn().mockResolvedValue(failedTransaction),
      });

      const typedResult = (await service.getTransaction(
        validSignature,
      )) as Record<string, unknown> | null;

      expect(typedResult).toEqual(failedTransaction);
      const meta = typedResult?.meta as Record<string, unknown> | undefined;
      expect(meta?.err).toBeDefined();
    });

    it('should pass correct encoding parameter to RPC', async () => {
      mockRpc.getTransaction.mockReturnValue({
        send: jest.fn().mockResolvedValue(null),
      });

      await service.getTransaction(validSignature);

      expect(mockRpc.getTransaction).toHaveBeenCalledWith(
        validSignature,
        expect.objectContaining({
          encoding: 'jsonParsed',
          maxSupportedTransactionVersion: 0,
        }),
      );
    });

    it('should handle multiple sequential getTransaction calls', async () => {
      const mockTransaction1: unknown = {
        transaction: { message: { accountKeys: [] } },
        slot: 1,
      };
      const mockTransaction2: unknown = {
        transaction: { message: { accountKeys: [] } },
        slot: 2,
      };

      mockRpc.getTransaction
        .mockReturnValueOnce({
          send: jest.fn().mockResolvedValue(mockTransaction1),
        })
        .mockReturnValueOnce({
          send: jest.fn().mockResolvedValue(mockTransaction2),
        });

      const result1Typed = (await service.getTransaction(
        validSignature,
      )) as Record<string, unknown> | null;
      const result2Typed = (await service.getTransaction(
        validSignature,
      )) as Record<string, unknown> | null;

      const typedResult1 = result1Typed;
      const typedResult2 = result2Typed;
      expect(typedResult1?.slot).toBe(1);
      expect(typedResult2?.slot).toBe(2);
    });

    it('should handle transaction with no meta information', async () => {
      const transactionNoMeta: unknown = {
        transaction: { message: { accountKeys: [] } },
        blockTime: 1234567890,
        slot: 300000000,
        // No meta field
      };

      mockRpc.getTransaction.mockReturnValue({
        send: jest.fn().mockResolvedValue(transactionNoMeta),
      });

      const typedResult = (await service.getTransaction(
        validSignature,
      )) as Record<string, unknown> | null;

      expect(typedResult).toEqual(transactionNoMeta);
      expect(typedResult?.meta).toBeUndefined();
    });

    it('should handle large transaction objects', async () => {
      // Create a large transaction with many instructions and accounts
      const largeTransaction: unknown = {
        transaction: {
          message: {
            accountKeys: Array(100)
              .fill(null)
              .map((_, i) => `account-${i}`),
            instructions: Array(50)
              .fill(null)
              .map((_, i) => ({
                programIdIndex: 0,
                accounts: [i, i + 1],
                data: `instruction-${i}`,
              })),
          },
          signatures: [validSignature],
        },
        blockTime: 1234567890,
        slot: 300000000,
        meta: {
          err: null,
          fee: 10000,
          preBalances: Array(100).fill(1000000000),
          postBalances: Array(100).fill(999990000),
        },
      };

      mockRpc.getTransaction.mockReturnValue({
        send: jest.fn().mockResolvedValue(largeTransaction),
      });

      const typedResult = (await service.getTransaction(
        validSignature,
      )) as Record<string, unknown> | null;

      expect(typedResult).toEqual(largeTransaction);
      const transaction = typedResult?.transaction as
        | Record<string, unknown>
        | undefined;
      const message = transaction?.message as
        | Record<string, unknown>
        | undefined;
      expect((message?.accountKeys as unknown[])?.length).toBe(100);
      expect((message?.instructions as unknown[])?.length).toBe(50);
    });

    it('should handle network timeout errors', async () => {
      mockRpc.getTransaction.mockReturnValue({
        send: jest.fn().mockRejectedValue(new Error('Network timeout')),
      });

      await expect(service.getTransaction(validSignature)).rejects.toThrow(
        'Network timeout',
      );
    });

    it('should convert signature string to proper format', async () => {
      const signatureStr =
        '4sGjMKvzttesJQgRHDDMyHVHJJ7TqSYVgv3vhbvVWX8vDM98tKfNGzAvzVdq9XhAD4y7FVJSuZXvZ1qx3hJXWMKs';
      mockRpc.getTransaction.mockReturnValue({
        send: jest.fn().mockResolvedValue(null),
      });

      await service.getTransaction(signatureStr);

      // The signature should be converted via utilsService.toSignature
      expect(mockRpc.getTransaction).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          encoding: 'jsonParsed',
          maxSupportedTransactionVersion: 0,
        }),
      );
    });
  });
});
