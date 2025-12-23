import { Injectable, Logger } from '@nestjs/common';
import { type Address, getBase64Decoder, getBase64Encoder } from '@solana/kit';
import * as crypto from 'node:crypto';

/**
 * Configuration for an event type to extract
 */
export type EventConfig<T = unknown> = {
  readonly name: string;
  readonly discriminator: Uint8Array;
  readonly decode: (data: Uint8Array) => T;
};

/**
 * Extracted event with metadata
 */
export type ExtractedEvent<T = unknown> = {
  readonly name: string;
  readonly data: T;
  readonly rawData: Uint8Array;
};

/**
 * Parsed program log entry
 */
export type ParsedLogEntry = {
  readonly programId: Address;
  readonly logs: string[];
};

/**
 * Service for Solana event extraction and decoding utilities
 *
 * Provides:
 * - Event discriminator calculation (Anchor-style)
 * - Event extraction from transaction logs
 * - Log filtering by program
 * - Base64 log data parsing
 *
 * @example
 * ```typescript
 * // Calculate event discriminator
 * const discriminator = eventService.getEventDiscriminator('TransferEvent');
 *
 * // Extract events from transaction logs
 * const events = eventService.extractEventsFromLogs(logs, [
 *   {
 *     name: 'TransferEvent',
 *     discriminator: eventService.getEventDiscriminator('TransferEvent'),
 *     decode: (data) => myDecoder(data),
 *   },
 * ]);
 * ```
 */
// Pre-compiled regex patterns for performance
const PROGRAM_INVOKE_REGEX = /^Program (\w+) invoke/;
const PROGRAM_SUCCESS_REGEX = /^Program (\w+) success/;
const PROGRAM_FAILED_REGEX = /^Program (\w+) failed/;

@Injectable()
export class SolanaEventService {
  private readonly logger = new Logger(SolanaEventService.name);
  private readonly discriminatorCache = new Map<string, Uint8Array>();
  // getBase64Encoder: string (base64) → Uint8Array (decodes from base64)
  // getBase64Decoder: Uint8Array → string (base64) (encodes to base64)
  private readonly base64ToUint8Array = getBase64Encoder();
  private readonly uint8ArrayToBase64 = getBase64Decoder();

  /**
   * Calculate the Anchor-style event discriminator
   *
   * The discriminator is: SHA256("event:<EventName>")[0..8]
   *
   * @param eventName The name of the event (e.g., 'TransferEvent')
   * @returns 8-byte discriminator as Uint8Array
   *
   * @example
   * ```typescript
   * const discriminator = eventService.getEventDiscriminator('TransferEvent');
   * // Returns first 8 bytes of SHA256("event:TransferEvent")
   * ```
   */
  getEventDiscriminator(eventName: string): Uint8Array {
    const cached = this.discriminatorCache.get(eventName);
    if (cached) {
      return cached;
    }

    const preimage = `event:${eventName}`;
    const hash = this.sha256(new TextEncoder().encode(preimage));
    const discriminator = hash.slice(0, 8);

    this.discriminatorCache.set(eventName, discriminator);
    return discriminator;
  }

  /**
   * Get the event discriminator as a base64 string
   *
   * @param eventName The name of the event
   * @returns Base64-encoded discriminator
   */
  getEventDiscriminatorBase64(eventName: string): string {
    const bytes = this.getEventDiscriminator(eventName);
    return this.bytesToBase64(bytes);
  }

  /**
   * Check if data matches an event discriminator
   *
   * @param data Raw event data bytes
   * @param eventName The event name to check against
   * @returns true if the data starts with the event's discriminator
   */
  matchesDiscriminator(data: Uint8Array, eventName: string): boolean {
    if (data.length < 8) {
      return false;
    }

    const discriminator = this.getEventDiscriminator(eventName);
    return this.bytesEqual(data.slice(0, 8), discriminator);
  }

  /**
   * Extract events from transaction logs
   *
   * Parses "Program data: <base64>" log entries and matches them
   * against provided event configurations.
   *
   * @param logs Array of log strings from a transaction
   * @param eventConfigs Event configurations to match against
   * @returns Array of extracted events
   *
   * @example
   * ```typescript
   * const events = eventService.extractEventsFromLogs(
   *   transaction.meta.logMessages,
   *   [
   *     {
   *       name: 'Transfer',
   *       discriminator: eventService.getEventDiscriminator('Transfer'),
   *       decode: (data) => decodeTransfer(data),
   *     },
   *   ],
   * );
   * ```
   */
  extractEventsFromLogs<T>(
    logs: string[],
    eventConfigs: EventConfig<T>[],
  ): ExtractedEvent<T>[] {
    const events: ExtractedEvent<T>[] = [];

    for (const log of logs) {
      const data = this.parseLogData(log);
      if (!data) {
        continue;
      }

      for (const config of eventConfigs) {
        if (this.bytesEqual(data.slice(0, 8), config.discriminator)) {
          try {
            const decoded = config.decode(data.slice(8));
            events.push({
              name: config.name,
              data: decoded,
              rawData: data,
            });
          } catch (error) {
            this.logger.warn(
              `Failed to decode event '${config.name}': ${error}`,
            );
          }
        }
      }
    }

    return events;
  }

  /**
   * Filter logs by program ID
   *
   * Returns logs that occurred within the specified program's execution context.
   *
   * @param logs Array of log strings
   * @param programId The program ID to filter by
   * @returns Filtered log entries
   *
   * @example
   * ```typescript
   * const programLogs = eventService.filterLogsByProgram(
   *   logs,
   *   'MyProgram11111111111111111111111111111111',
   * );
   * ```
   */
  filterLogsByProgram(logs: string[], programId: Address | string): string[] {
    const filtered: string[] = [];
    let inProgram = false;
    let depth = 0;

    for (const log of logs) {
      if (log.includes(`Program ${programId} invoke`)) {
        inProgram = true;
        depth++;
      }

      if (inProgram) {
        filtered.push(log);
      }

      if (
        inProgram &&
        (log.includes(`Program ${programId} success`) ||
          log.includes(`Program ${programId} failed`))
      ) {
        depth--;
        if (depth === 0) {
          inProgram = false;
        }
      }
    }

    return filtered;
  }

  /**
   * Parse "Program data: <base64>" log entry
   *
   * Extracts and decodes the base64 data from Anchor-style log entries.
   *
   * @param log A single log string
   * @returns Decoded bytes or null if not a data log
   *
   * @example
   * ```typescript
   * const data = eventService.parseLogData('Program data: SGVsbG8gV29ybGQ=');
   * // Returns Uint8Array containing decoded bytes
   * ```
   */
  parseLogData(log: string): Uint8Array | null {
    const prefix = 'Program data: ';
    if (!log.startsWith(prefix)) {
      return null;
    }

    const base64Data = log.slice(prefix.length);
    try {
      return this.base64ToBytes(base64Data);
    } catch {
      return null;
    }
  }

  /**
   * Parse program execution logs into structured entries
   *
   * Groups logs by their program execution context.
   *
   * @param logs Array of log strings
   * @returns Array of parsed log entries grouped by program
   */
  parseLogsByProgram(logs: string[]): ParsedLogEntry[] {
    const entries: ParsedLogEntry[] = [];
    const programStack: { programId: Address; logs: string[] }[] = [];

    for (const log of logs) {
      const invokeMatch = log.match(PROGRAM_INVOKE_REGEX);
      if (invokeMatch) {
        programStack.push({
          programId: invokeMatch[1] as Address,
          logs: [log],
        });
        continue;
      }

      if (programStack.length > 0) {
        const current = programStack[programStack.length - 1];
        current.logs.push(log);

        const successMatch = log.match(PROGRAM_SUCCESS_REGEX);
        const failedMatch = log.match(PROGRAM_FAILED_REGEX);

        if (successMatch || failedMatch) {
          const completed = programStack.pop()!;
          entries.push({
            programId: completed.programId,
            logs: completed.logs,
          });
        }
      }
    }

    return entries;
  }

  /**
   * Extract all data logs from a transaction
   *
   * @param logs Array of log strings
   * @returns Array of decoded data entries
   */
  extractAllDataLogs(logs: string[]): Uint8Array[] {
    const dataLogs: Uint8Array[] = [];

    for (const log of logs) {
      const data = this.parseLogData(log);
      if (data) {
        dataLogs.push(data);
      }
    }

    return dataLogs;
  }

  /**
   * Create an event config helper
   *
   * @param name Event name
   * @param decode Decoder function
   * @returns EventConfig ready for use with extractEventsFromLogs
   */
  createEventConfig<T>(
    name: string,
    decode: (data: Uint8Array) => T,
  ): EventConfig<T> {
    return {
      name,
      discriminator: this.getEventDiscriminator(name),
      decode,
    };
  }

  private sha256(data: Uint8Array): Uint8Array {
    const hash = crypto.createHash('sha256');
    hash.update(data);
    return new Uint8Array(hash.digest());
  }

  private bytesToBase64(bytes: Uint8Array): string {
    return this.uint8ArrayToBase64.decode(bytes);
  }

  private base64ToBytes(base64: string): Uint8Array {
    return new Uint8Array(this.base64ToUint8Array.encode(base64));
  }

  private bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  }
}
