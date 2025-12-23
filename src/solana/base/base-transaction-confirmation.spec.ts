import { vi } from 'vitest';

import { TransactionRecordStore } from '../interfaces/persistence.interfaces';
import { BaseTransactionConfirmationService } from './base-transaction-confirmation';

type TestExtractedData = {
  cardId: number;
  userAddress: string;
  amount: bigint;
};

type TestRecord = {
  id: string;
  cardId: number;
  userAddress: string;
  amount: bigint;
  confirmed: boolean;
};

type TestResult = {
  id: string;
  cardId: number;
  status: string;
};

class TestConfirmationService extends BaseTransactionConfirmationService<
  TestExtractedData,
  TestRecord,
  TestResult
> {
  public extractDataMock = vi.fn<(signature: string) => Promise<TestExtractedData>>();
  public verifyMock = vi.fn<
    (signature: string, data: TestExtractedData) => Promise<void>
  >();

  protected async extractData(signature: string): Promise<TestExtractedData> {
    return this.extractDataMock(signature);
  }

  protected async verify(
    signature: string,
    data: TestExtractedData,
  ): Promise<void> {
    return this.verifyMock(signature, data);
  }

  protected toResult(record: TestRecord): TestResult {
    return {
      id: record.id,
      cardId: record.cardId,
      status: record.confirmed ? 'confirmed' : 'pending',
    };
  }
}

describe('BaseTransactionConfirmationService', () => {
  let service: TestConfirmationService;
  let mockStore: TransactionRecordStore<TestRecord, TestExtractedData>;

  const testSignature = 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz';
  const testUserId = 'user-123';

  const testExtractedData: TestExtractedData = {
    cardId: 1,
    userAddress: '11111111111111111111111111111111',
    amount: BigInt(1000000),
  };

  const testRecord: TestRecord = {
    id: 'record-123',
    cardId: 1,
    userAddress: '11111111111111111111111111111111',
    amount: BigInt(1000000),
    confirmed: false,
  };

  const confirmedRecord: TestRecord = {
    ...testRecord,
    confirmed: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockStore = {
      findRecord: vi.fn().mockResolvedValue(null),
      createRecord: vi.fn().mockResolvedValue(testRecord),
      isConfirmed: vi.fn().mockReturnValue(false),
      confirmRecord: vi.fn().mockResolvedValue(confirmedRecord),
    };

    service = new TestConfirmationService(mockStore);
    service.extractDataMock.mockResolvedValue(testExtractedData);
    service.verifyMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('confirmTransaction', () => {
    it('should complete 5-step flow for new record', async () => {
      const result = await service.confirmTransaction(testSignature, testUserId);

      // Step 1: Extract data
      expect(service.extractDataMock).toHaveBeenCalledWith(testSignature);

      // Step 2: Find or create record
      expect(mockStore.findRecord).toHaveBeenCalledWith(testExtractedData);
      expect(mockStore.createRecord).toHaveBeenCalledWith(
        testExtractedData,
        testUserId,
      );

      // Step 3: Check idempotency (isConfirmed)
      expect(mockStore.isConfirmed).toHaveBeenCalledWith(testRecord);

      // Step 4: Verify transaction
      expect(service.verifyMock).toHaveBeenCalledWith(
        testSignature,
        testExtractedData,
      );

      // Step 5: Process confirmation
      expect(mockStore.confirmRecord).toHaveBeenCalledWith(
        testRecord,
        testExtractedData,
      );

      expect(result).toEqual({
        data: {
          id: 'record-123',
          cardId: 1,
          status: 'confirmed',
        },
        status: 'processed',
        message: 'Transaction confirmed successfully',
      });
    });

    it('should use existing record when found', async () => {
      (mockStore.findRecord as ReturnType<typeof vi.fn>).mockResolvedValue(
        testRecord,
      );

      await service.confirmTransaction(testSignature, testUserId);

      expect(mockStore.findRecord).toHaveBeenCalledWith(testExtractedData);
      expect(mockStore.createRecord).not.toHaveBeenCalled();
    });

    it('should return already_processed for confirmed record', async () => {
      (mockStore.findRecord as ReturnType<typeof vi.fn>).mockResolvedValue(
        confirmedRecord,
      );
      (mockStore.isConfirmed as ReturnType<typeof vi.fn>).mockReturnValue(true);

      const result = await service.confirmTransaction(testSignature, testUserId);

      expect(result).toEqual({
        data: {
          id: 'record-123',
          cardId: 1,
          status: 'confirmed',
        },
        status: 'already_processed',
        message: 'Transaction was already confirmed',
      });

      // Should not verify or confirm again
      expect(service.verifyMock).not.toHaveBeenCalled();
      expect(mockStore.confirmRecord).not.toHaveBeenCalled();
    });

    it('should propagate extractData errors', async () => {
      service.extractDataMock.mockRejectedValue(
        new Error('Failed to fetch transaction'),
      );

      await expect(
        service.confirmTransaction(testSignature, testUserId),
      ).rejects.toThrow('Failed to fetch transaction');
    });

    it('should propagate verify errors', async () => {
      service.verifyMock.mockRejectedValue(
        new Error('Transaction verification failed'),
      );

      await expect(
        service.confirmTransaction(testSignature, testUserId),
      ).rejects.toThrow('Transaction verification failed');
    });

    it('should propagate store errors', async () => {
      (mockStore.createRecord as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.confirmTransaction(testSignature, testUserId),
      ).rejects.toThrow('Database error');
    });

    it('should handle non-Error thrown values', async () => {
      (mockStore.createRecord as ReturnType<typeof vi.fn>).mockRejectedValue(
        'string error',
      );

      await expect(
        service.confirmTransaction(testSignature, testUserId),
      ).rejects.toBe('string error');
    });
  });

  describe('toResult', () => {
    it('should convert record to result correctly', async () => {
      const result = await service.confirmTransaction(testSignature, testUserId);

      expect(result.data).toEqual({
        id: 'record-123',
        cardId: 1,
        status: 'confirmed',
      });
    });

    it('should handle pending status', async () => {
      (mockStore.isConfirmed as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (mockStore.findRecord as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...testRecord,
        confirmed: false,
      });

      const result = await service.confirmTransaction(testSignature, testUserId);

      expect(result.data.status).toBe('pending');
    });
  });

  describe('short signature handling', () => {
    it('should handle short signatures without truncation', async () => {
      const shortSignature = 'short';

      const result = await service.confirmTransaction(shortSignature, testUserId);

      expect(result.status).toBe('processed');
      expect(service.extractDataMock).toHaveBeenCalledWith(shortSignature);
    });
  });
});
