import { Logger } from '@nestjs/common';
import { vi } from 'vitest';

import { TransactionalProcessingStore } from '../interfaces/persistence.interfaces';
import { BaseProcessingService } from './base-processing';

type TestInput = {
  signature: string;
  userId: string;
  amount: bigint;
};

type TestRecord = {
  id: string;
  signature: string;
  userId: string;
  amount: bigint;
  status: 'pending' | 'confirmed';
};

type TestResult = {
  id: string;
  status: string;
};

class TestProcessingService extends BaseProcessingService<
  TestInput,
  TestRecord,
  TestResult
> {
  protected readonly logger = new Logger(TestProcessingService.name);

  protected toResult(record: TestRecord): TestResult {
    return {
      id: record.id,
      status: record.status,
    };
  }
}

describe('BaseProcessingService', () => {
  let service: TestProcessingService;
  let mockStore: TransactionalProcessingStore<TestInput, TestRecord>;

  const testInput: TestInput = {
    signature: 'abc123def456',
    userId: 'user-123',
    amount: BigInt(1000000),
  };

  const pendingRecord: TestRecord = {
    id: 'record-123',
    signature: 'abc123def456',
    userId: 'user-123',
    amount: BigInt(1000000),
    status: 'pending',
  };

  const confirmedRecord: TestRecord = {
    ...pendingRecord,
    status: 'confirmed',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockStore = {
      findRecord: vi.fn().mockResolvedValue(null),
      executeInTransaction: vi.fn().mockImplementation(async (fn) => fn({})),
      findRecordInTransaction: vi.fn().mockResolvedValue(null),
      saveRecordInTransaction: vi.fn().mockResolvedValue(confirmedRecord),
      isFullyProcessed: vi.fn().mockReturnValue(false),
    };

    service = new TestProcessingService(mockStore);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('process', () => {
    it('should process new record successfully', async () => {
      const result = await service.process(testInput);

      expect(mockStore.findRecord).toHaveBeenCalledWith(testInput);
      expect(mockStore.executeInTransaction).toHaveBeenCalled();
      expect(mockStore.findRecordInTransaction).toHaveBeenCalled();
      expect(mockStore.saveRecordInTransaction).toHaveBeenCalled();

      expect(result).toEqual({
        result: {
          id: 'record-123',
          status: 'confirmed',
        },
        isNew: true,
      });
    });

    it('should return cached result for already processed record (quick check)', async () => {
      (mockStore.findRecord as ReturnType<typeof vi.fn>).mockResolvedValue(
        confirmedRecord,
      );
      (mockStore.isFullyProcessed as ReturnType<typeof vi.fn>).mockReturnValue(
        true,
      );

      const result = await service.process(testInput);

      expect(mockStore.findRecord).toHaveBeenCalledWith(testInput);
      expect(mockStore.executeInTransaction).not.toHaveBeenCalled();

      expect(result).toEqual({
        result: {
          id: 'record-123',
          status: 'confirmed',
        },
        isNew: false,
      });
    });

    it('should handle race condition (record processed during transaction)', async () => {
      // First findRecord returns null (outside transaction)
      (mockStore.findRecord as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      // But findRecordInTransaction returns a processed record
      (
        mockStore.findRecordInTransaction as ReturnType<typeof vi.fn>
      ).mockResolvedValue(confirmedRecord);

      // And isFullyProcessed returns true for that record
      (
        mockStore.isFullyProcessed as ReturnType<typeof vi.fn>
      ).mockImplementation((record: TestRecord) => record.status === 'confirmed');

      // executeInTransaction should return the existing record
      (
        mockStore.executeInTransaction as ReturnType<typeof vi.fn>
      ).mockImplementation(async (fn) => {
        const result = await fn({});
        return result;
      });

      const result = await service.process(testInput);

      expect(mockStore.findRecordInTransaction).toHaveBeenCalled();
      expect(mockStore.saveRecordInTransaction).not.toHaveBeenCalled();

      expect(result).toEqual({
        result: {
          id: 'record-123',
          status: 'confirmed',
        },
        isNew: true,
      });
    });

    it('should process record when found but not fully processed', async () => {
      (mockStore.findRecord as ReturnType<typeof vi.fn>).mockResolvedValue(
        pendingRecord,
      );
      (mockStore.isFullyProcessed as ReturnType<typeof vi.fn>).mockReturnValue(
        false,
      );
      (
        mockStore.findRecordInTransaction as ReturnType<typeof vi.fn>
      ).mockResolvedValue(pendingRecord);
      (
        mockStore.saveRecordInTransaction as ReturnType<typeof vi.fn>
      ).mockResolvedValue(confirmedRecord);

      const result = await service.process(testInput);

      expect(mockStore.executeInTransaction).toHaveBeenCalled();
      expect(mockStore.saveRecordInTransaction).toHaveBeenCalledWith(
        expect.anything(),
        testInput,
        pendingRecord,
      );

      expect(result).toEqual({
        result: {
          id: 'record-123',
          status: 'confirmed',
        },
        isNew: true,
      });
    });

    it('should propagate store errors', async () => {
      (mockStore.findRecord as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(service.process(testInput)).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should propagate transaction errors', async () => {
      (
        mockStore.executeInTransaction as ReturnType<typeof vi.fn>
      ).mockRejectedValue(new Error('Transaction failed'));

      await expect(service.process(testInput)).rejects.toThrow(
        'Transaction failed',
      );
    });
  });

  describe('toResult', () => {
    it('should convert record to result correctly', async () => {
      const result = await service.process(testInput);

      expect(result.result).toEqual({
        id: 'record-123',
        status: 'confirmed',
      });
    });
  });

  describe('isNew flag', () => {
    it('should be true when record was not previously processed', async () => {
      (mockStore.findRecord as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      const result = await service.process(testInput);

      expect(result.isNew).toBe(true);
    });

    it('should be false when record was already fully processed', async () => {
      (mockStore.findRecord as ReturnType<typeof vi.fn>).mockResolvedValue(
        confirmedRecord,
      );
      (mockStore.isFullyProcessed as ReturnType<typeof vi.fn>).mockReturnValue(
        true,
      );

      const result = await service.process(testInput);

      expect(result.isNew).toBe(false);
    });

    it('should be true when record existed but was not fully processed', async () => {
      (mockStore.findRecord as ReturnType<typeof vi.fn>).mockResolvedValue(
        pendingRecord,
      );
      (mockStore.isFullyProcessed as ReturnType<typeof vi.fn>).mockReturnValue(
        false,
      );

      const result = await service.process(testInput);

      expect(result.isNew).toBe(true);
    });
  });
});
