import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';

import { SolanaEventService, EventConfig } from './solana-event.service';

describe('SolanaEventService', () => {
  let service: SolanaEventService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [SolanaEventService],
    }).compile();

    service = module.get<SolanaEventService>(SolanaEventService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getEventDiscriminator', () => {
    it('should calculate discriminator for event name', () => {
      const discriminator = service.getEventDiscriminator('TransferEvent');

      expect(discriminator).toBeInstanceOf(Uint8Array);
      expect(discriminator.length).toBe(8);
    });

    it('should return consistent discriminator for same event', () => {
      const disc1 = service.getEventDiscriminator('MyEvent');
      const disc2 = service.getEventDiscriminator('MyEvent');

      expect(disc1).toEqual(disc2);
    });

    it('should return different discriminators for different events', () => {
      const disc1 = service.getEventDiscriminator('EventA');
      const disc2 = service.getEventDiscriminator('EventB');

      expect(disc1).not.toEqual(disc2);
    });

    it('should use caching', () => {
      // First call calculates
      const disc1 = service.getEventDiscriminator('CachedEvent');
      // Second call should return cached value
      const disc2 = service.getEventDiscriminator('CachedEvent');

      expect(disc1).toBe(disc2); // Same reference due to caching
    });
  });

  describe('getEventDiscriminatorBase64', () => {
    it('should return base64 encoded discriminator', () => {
      const base64 = service.getEventDiscriminatorBase64('TestEvent');

      expect(typeof base64).toBe('string');
      // Base64 of 8 bytes should be around 12 characters
      expect(base64.length).toBeGreaterThan(0);
    });

    it('should be decodable back to bytes', () => {
      const base64 = service.getEventDiscriminatorBase64('TestEvent');
      const bytes = Buffer.from(base64, 'base64');

      expect(bytes.length).toBe(8);
    });
  });

  describe('matchesDiscriminator', () => {
    it('should return true for matching discriminator', () => {
      const discriminator = service.getEventDiscriminator('MatchEvent');
      const data = new Uint8Array([...discriminator, 1, 2, 3, 4]);

      expect(service.matchesDiscriminator(data, 'MatchEvent')).toBe(true);
    });

    it('should return false for non-matching discriminator', () => {
      const data = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4]);

      expect(service.matchesDiscriminator(data, 'SomeEvent')).toBe(false);
    });

    it('should return false for data shorter than 8 bytes', () => {
      const data = new Uint8Array([1, 2, 3, 4]);

      expect(service.matchesDiscriminator(data, 'ShortEvent')).toBe(false);
    });
  });

  describe('parseLogData', () => {
    it('should parse "Program data:" log entry', () => {
      const testData = Buffer.from('Hello World').toString('base64');
      const log = `Program data: ${testData}`;

      const parsed = service.parseLogData(log);

      expect(parsed).toBeInstanceOf(Uint8Array);
      expect(Buffer.from(parsed!).toString()).toBe('Hello World');
    });

    it('should return null for non-data logs', () => {
      expect(service.parseLogData('Program log: some message')).toBeNull();
      expect(service.parseLogData('Something else')).toBeNull();
    });

    it('should return empty array for empty data', () => {
      const result = service.parseLogData('Program data: ');
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result!.length).toBe(0);
    });

    it('should return null for invalid base64 data', () => {
      // Invalid base64 string that will fail to decode
      const result = service.parseLogData('Program data: !!!invalid-base64!!!');
      expect(result).toBeNull();
    });
  });

  describe('filterLogsByProgram', () => {
    const programId = 'MyProgram11111111111111111111111111111111';

    it('should filter logs by program ID', () => {
      const logs = [
        'Program 11111111111111111111111111111111 invoke [1]',
        'Program log: other program',
        'Program 11111111111111111111111111111111 success',
        `Program ${programId} invoke [1]`,
        'Program log: my log',
        'Program data: SGVsbG8=',
        `Program ${programId} success`,
      ];

      const filtered = service.filterLogsByProgram(logs, programId);

      expect(filtered).toContain(`Program ${programId} invoke [1]`);
      expect(filtered).toContain('Program log: my log');
      expect(filtered).toContain('Program data: SGVsbG8=');
      expect(filtered).not.toContain('Program log: other program');
    });

    it('should handle nested program invocations', () => {
      const logs = [
        `Program ${programId} invoke [1]`,
        'Program log: outer start',
        `Program ${programId} invoke [2]`,
        'Program log: inner',
        `Program ${programId} success`,
        'Program log: outer end',
        `Program ${programId} success`,
      ];

      const filtered = service.filterLogsByProgram(logs, programId);

      expect(filtered.length).toBe(7);
    });

    it('should return empty array if program not found', () => {
      const logs = [
        'Program other111111111111111111111111111111 invoke [1]',
        'Program log: message',
        'Program other111111111111111111111111111111 success',
      ];

      const filtered = service.filterLogsByProgram(logs, programId);

      expect(filtered).toEqual([]);
    });
  });

  describe('extractEventsFromLogs', () => {
    it('should extract matching events', () => {
      const eventName = 'TestEvent';
      const discriminator = service.getEventDiscriminator(eventName);
      const payload = new Uint8Array([42, 43, 44]);
      const eventData = new Uint8Array([...discriminator, ...payload]);
      const base64 = Buffer.from(eventData).toString('base64');

      const logs = [
        'Program log: something',
        `Program data: ${base64}`,
        'Program log: something else',
      ];

      const config: EventConfig<number[]> = {
        name: eventName,
        discriminator,
        decode: (data) => Array.from(data),
      };

      const events = service.extractEventsFromLogs(logs, [config]);

      expect(events.length).toBe(1);
      expect(events[0].name).toBe(eventName);
      expect(events[0].data).toEqual([42, 43, 44]);
    });

    it('should handle multiple event types', () => {
      const event1Name = 'EventOne';
      const event2Name = 'EventTwo';
      const disc1 = service.getEventDiscriminator(event1Name);
      const disc2 = service.getEventDiscriminator(event2Name);

      const data1 = Buffer.from([...disc1, 1]).toString('base64');
      const data2 = Buffer.from([...disc2, 2]).toString('base64');

      const logs = [`Program data: ${data1}`, `Program data: ${data2}`];

      const configs: EventConfig<number>[] = [
        { name: event1Name, discriminator: disc1, decode: (d) => d[0] },
        { name: event2Name, discriminator: disc2, decode: (d) => d[0] },
      ];

      const events = service.extractEventsFromLogs(logs, configs);

      expect(events.length).toBe(2);
      expect(events.find((e) => e.name === event1Name)?.data).toBe(1);
      expect(events.find((e) => e.name === event2Name)?.data).toBe(2);
    });

    it('should skip non-matching events', () => {
      const disc = service.getEventDiscriminator('WantedEvent');
      const otherData = Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 99]).toString(
        'base64',
      );

      const logs = [`Program data: ${otherData}`];

      const config: EventConfig<number> = {
        name: 'WantedEvent',
        discriminator: disc,
        decode: (d) => d[0],
      };

      const events = service.extractEventsFromLogs(logs, [config]);

      expect(events.length).toBe(0);
    });

    it('should handle decode errors gracefully', () => {
      const eventName = 'ErrorEvent';
      const disc = service.getEventDiscriminator(eventName);
      const data = Buffer.from([...disc, 1, 2, 3]).toString('base64');

      const logs = [`Program data: ${data}`];

      const config: EventConfig<never> = {
        name: eventName,
        discriminator: disc,
        decode: () => {
          throw new Error('Decode failed');
        },
      };

      const events = service.extractEventsFromLogs(logs, [config]);

      expect(events.length).toBe(0);
    });

    it('should skip data shorter than discriminator length', () => {
      const disc = service.getEventDiscriminator('TestEvent');
      // Data with only 3 bytes - shorter than 8-byte discriminator
      const shortData = Buffer.from([1, 2, 3]).toString('base64');

      const logs = [`Program data: ${shortData}`];

      const config: EventConfig<number> = {
        name: 'TestEvent',
        discriminator: disc,
        decode: (d) => d[0],
      };

      const events = service.extractEventsFromLogs(logs, [config]);

      // Should not match since data is too short
      expect(events.length).toBe(0);
    });
  });

  describe('extractAllDataLogs', () => {
    it('should extract all data logs', () => {
      const data1 = Buffer.from([1, 2, 3]).toString('base64');
      const data2 = Buffer.from([4, 5, 6]).toString('base64');

      const logs = [
        'Program log: message',
        `Program data: ${data1}`,
        'Program log: another',
        `Program data: ${data2}`,
      ];

      const dataLogs = service.extractAllDataLogs(logs);

      expect(dataLogs.length).toBe(2);
      expect(Array.from(dataLogs[0])).toEqual([1, 2, 3]);
      expect(Array.from(dataLogs[1])).toEqual([4, 5, 6]);
    });

    it('should return empty array for no data logs', () => {
      const logs = ['Program log: message', 'Program log: another'];

      const dataLogs = service.extractAllDataLogs(logs);

      expect(dataLogs).toEqual([]);
    });
  });

  describe('parseLogsByProgram', () => {
    it('should group logs by program', () => {
      const prog1 = 'Program111111111111111111111111111111111';
      const prog2 = 'Program222222222222222222222222222222222';

      const logs = [
        `Program ${prog1} invoke [1]`,
        'Program log: prog1 log',
        `Program ${prog1} success`,
        `Program ${prog2} invoke [1]`,
        'Program log: prog2 log',
        `Program ${prog2} success`,
      ];

      const entries = service.parseLogsByProgram(logs);

      expect(entries.length).toBe(2);
      expect(entries[0].programId).toBe(prog1);
      expect(entries[1].programId).toBe(prog2);
    });

    it('should handle failed programs', () => {
      const prog = 'FailedProgram1111111111111111111111111';

      const logs = [
        `Program ${prog} invoke [1]`,
        'Program log: before fail',
        `Program ${prog} failed: error`,
      ];

      const entries = service.parseLogsByProgram(logs);

      expect(entries.length).toBe(1);
      expect(entries[0].programId).toBe(prog);
      expect(entries[0].logs.length).toBe(3);
    });
  });

  describe('createEventConfig', () => {
    it('should create event config with auto discriminator', () => {
      const config = service.createEventConfig('MyEvent', (data) =>
        Array.from(data),
      );

      expect(config.name).toBe('MyEvent');
      expect(config.discriminator).toEqual(
        service.getEventDiscriminator('MyEvent'),
      );
      expect(config.decode(new Uint8Array([1, 2, 3]))).toEqual([1, 2, 3]);
    });
  });
});
