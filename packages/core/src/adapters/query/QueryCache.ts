import { LRUCache } from "../shared";
import { IndexKey } from "../storage";
import { ReceiptQuery, ReceiptMetadata } from "../../ports";

export interface QueryCacheConfig {
  enabled?: boolean;
  maxSize?: number;
  ttlSeconds?: number;
}

/** Function type for fetching records from a date prefix (lists all part files) */
export type DatePrefixFetcher = (prefix: string, query: ReceiptQuery) => Promise<ReceiptMetadata[]>;

/** Manages caching for receipt queries */
export class QueryCache {
  private cache: LRUCache<ReceiptMetadata[]>;
  private enabled: boolean;

  constructor(config: QueryCacheConfig = {}) {
    this.enabled = config.enabled ?? true;
    this.cache = new LRUCache(config.maxSize ?? 100, config.ttlSeconds ?? 300);
  }

  /**
   * Query a date with caching support.
   * Returns cached results if available, otherwise fetches and caches.
   */
  async queryDate(
    date: string,
    query: ReceiptQuery,
    fetcher: DatePrefixFetcher
  ): Promise<ReceiptMetadata[]> {
    const cached = this.get(date, query);
    if (cached) return cached;

    const indexKey = IndexKey.fromDate(date);

    try {
      const records = await fetcher(indexKey.prefix, query);
      this.set(date, query, records);
      return records;
    } catch (err: any) {
      if (err.name !== "NoSuchKey") {
        console.warn(`Failed to query ${indexKey}:`, err.message);
      }
      return [];
    }
  }

  /** Get cached results for a date/query combination */
  get(date: string, query: ReceiptQuery): ReceiptMetadata[] | undefined {
    if (!this.enabled) return undefined;
    return this.cache.get(this.buildKey(date, query));
  }

  /** Cache results for a date/query combination */
  set(date: string, query: ReceiptQuery, records: ReceiptMetadata[]): void {
    if (!this.enabled) return;
    this.cache.set(this.buildKey(date, query), records);
  }

  /** Clear all cached entries */
  clear(): void {
    this.cache.clear();
  }

  /** Get cache statistics */
  getStats(): { size: number; enabled: boolean } {
    return { size: this.cache.size, enabled: this.enabled };
  }

  /** Build unique cache key from date and query parameters */
  private buildKey(date: string, query: ReceiptQuery): string {
    return [
      date,
      query.session_id ?? "",
      query.consumer_id ?? "",
      query.card_last_four ?? "",
      query.receipt_number ?? "",
      query.amount_min?.toString() ?? "",
      query.amount_max?.toString() ?? "",
    ].join("|");
  }
}
