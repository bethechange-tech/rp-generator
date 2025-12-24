import {
  S3Client,
  SelectObjectContentCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { chunk, orderBy, findIndex, last, compact, filter } from "lodash";
import { S3Config, ReceiptMetadata } from "./S3ReceiptStorage";

// ============================================
// LRU CACHE IMPLEMENTATION
// ============================================

interface CacheEntry<T> {
  value: T;
  expiry: number;
}

/**
 * Simple LRU Cache with TTL for query results
 */
class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize: number = 100, ttlSeconds: number = 300) {
    this.maxSize = maxSize;
    this.ttlMs = ttlSeconds * 1000;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return undefined;
    }
    
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    
    this.cache.set(key, {
      value,
      expiry: Date.now() + this.ttlMs,
    });
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

// ============================================
// QUERY INTERFACES
// ============================================

/**
 * Query parameters for searching receipts.
 * All fields are optional and can be combined for complex queries.
 * 
 * @example
 * // Query by session ID
 * { session_id: "session-12345" }
 * 
 * @example
 * // Query by consumer with date range and pagination
 * { consumer_id: "consumer-john", date_from: "2025-12-01", date_to: "2025-12-31", limit: 20 }
 * 
 * @example
 * // Query with cursor for next page
 * { consumer_id: "consumer-john", cursor: "2025-12-15:session-123", limit: 20 }
 */
export interface ReceiptQuery {
  /** Filter by session ID (exact match) */
  session_id?: string;
  
  /** Filter by consumer ID (exact match) */
  consumer_id?: string;
  
  /** Filter by last 4 digits of payment card (exact match) */
  card_last_four?: string;
  
  /** Start date for query range (YYYY-MM-DD). Defaults to 7 days ago if not specified */
  date_from?: string;
  
  /** End date for query range (YYYY-MM-DD). Defaults to today if not specified */
  date_to?: string;
  
  /** Minimum amount filter (numeric, e.g., 10 for £10.00) */
  amount_min?: number;
  
  /** Maximum amount filter (numeric, e.g., 50 for £50.00) */
  amount_max?: number;
  
  /** Filter by receipt number (exact match) */
  receipt_number?: string;

  /** Maximum number of results to return (default: 50, max: 100) */
  limit?: number;

  /** Cursor for pagination (format: "date:session_id") */
  cursor?: string;
}

/**
 * Query result containing matched records and pagination metadata.
 */
export interface QueryResult {
  /** Array of matching receipt metadata records */
  records: ReceiptMetadata[];
  
  /** List of dates that were scanned (YYYY-MM-DD format) */
  scanned_dates: string[];

  /** Total count of records found (before pagination) */
  total_count: number;

  /** Cursor for next page (undefined if no more results) */
  next_cursor?: string;

  /** Whether there are more results available */
  has_more: boolean;

  /** Number of results per page */
  page_size: number;
}

/**
 * Configuration options for the query service
 */
export interface QueryServiceConfig extends S3Config {
  /** Enable result caching (default: true) */
  enableCache?: boolean;
  /** Cache size in number of queries (default: 100) */
  cacheSize?: number;
  /** Cache TTL in seconds (default: 300 = 5 minutes) */
  cacheTtlSeconds?: number;
  /** Maximum concurrent S3 requests (default: 5) */
  maxConcurrency?: number;
}

/**
 * Service for querying receipts stored in S3.
 * 
 * Supports SQL-like filtering on NDJSON index files with the following capabilities:
 * - Filter by session_id, consumer_id, card_last_four, receipt_number
 * - Date range queries (date_from, date_to)
 * - Amount range queries (amount_min, amount_max)
 * - Pagination with cursor-based navigation
 * - Parallel index file scanning for performance
 * - LRU caching for frequently accessed queries
 * - Uses S3 Select for server-side filtering on AWS S3
 * - Falls back to client-side filtering for MinIO/local development
 * 
 * @example
 * ```typescript
 * const queryService = ReceiptQueryService.createLocal();
 * 
 * // Find all receipts for a consumer in December with pagination
 * const results = await queryService.query({
 *   consumer_id: "consumer-12345",
 *   date_from: "2025-12-01",
 *   date_to: "2025-12-31",
 *   limit: 20,
 * });
 * 
 * console.log(`Found ${results.total_count} receipts`);
 * console.log(`Showing ${results.records.length} of ${results.page_size}`);
 * 
 * // Get next page
 * if (results.has_more) {
 *   const nextPage = await queryService.query({
 *     consumer_id: "consumer-12345",
 *     cursor: results.next_cursor,
 *     limit: 20,
 *   });
 * }
 * ```
 */
export class ReceiptQueryService {
  private client: S3Client;
  private bucket: string;
  private cache: LRUCache<ReceiptMetadata[]>;
  private enableCache: boolean;
  private maxConcurrency: number;

  constructor(config: QueryServiceConfig) {
    this.bucket = config.bucket;
    this.enableCache = config.enableCache ?? true;
    this.maxConcurrency = config.maxConcurrency ?? 5;
    this.cache = new LRUCache(
      config.cacheSize ?? 100,
      config.cacheTtlSeconds ?? 300
    );
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true,
    });
  }

  /**
   * Query receipts using SQL-like filtering on NDJSON index files.
   * Scans daily index files within the date range with parallel processing.
   * Supports pagination via limit and cursor parameters.
   */
  async query(query: ReceiptQuery): Promise<QueryResult> {
    const dates = this.getDateRange(query.date_from, query.date_to);
    const limit = Math.min(query.limit ?? 50, 100); // Cap at 100
    const cursor = this.parseCursor(query.cursor);
    
    // Parallel scan with concurrency control
    const allRecords = await this.parallelScan(dates, query);
    
    // Sort by date descending, then by session_id using lodash orderBy
    const sortedRecords = orderBy(allRecords, ["payment_date", "session_id"], ["desc", "desc"]);

    // Apply cursor-based pagination using lodash findIndex
    let startIndex = 0;
    if (cursor) {
      startIndex = findIndex(
        sortedRecords,
        (r) => r.payment_date === cursor.date && r.session_id === cursor.sessionId
      );
      if (startIndex === -1) startIndex = 0;
      else startIndex += 1; // Start after the cursor
    }

    const totalCount = sortedRecords.length;
    const paginatedRecords = sortedRecords.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < totalCount;
    
    // Generate next cursor using lodash last
    let nextCursor: string | undefined;
    const lastRecord = last(paginatedRecords);
    if (hasMore && lastRecord) {
      nextCursor = `${lastRecord.payment_date}:${lastRecord.session_id}`;
    }

    return {
      records: paginatedRecords,
      scanned_dates: dates,
      total_count: totalCount,
      next_cursor: nextCursor,
      has_more: hasMore,
      page_size: limit,
    };
  }

  /**
   * Scan multiple index files in parallel with concurrency control
   */
  private async parallelScan(
    dates: string[],
    query: ReceiptQuery
  ): Promise<ReceiptMetadata[]> {
    const allRecords: ReceiptMetadata[] = [];
    
    // Process dates in chunks for controlled concurrency
    const dateChunks = chunk(dates, this.maxConcurrency);
    
    for (const dateChunk of dateChunks) {
      const chunkResults = await Promise.all(
        dateChunk.map((date) => this.queryDateWithCache(date, query))
      );
      
      for (const records of chunkResults) {
        allRecords.push(...records);
      }
    }

    return allRecords;
  }

  /**
   * Query a single date's index file with caching
   */
  private async queryDateWithCache(
    date: string,
    query: ReceiptQuery
  ): Promise<ReceiptMetadata[]> {
    const indexKey = `index/dt=${date}/index.ndjson`;
    const cacheKey = this.buildCacheKey(date, query);

    // Check cache first
    if (this.enableCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const records = await this.queryIndexFile(indexKey, query);
      
      // Cache the results
      if (this.enableCache) {
        this.cache.set(cacheKey, records);
      }
      
      return records;
    } catch (err: any) {
      if (err.name !== "NoSuchKey") {
        console.warn(`Failed to query ${indexKey}:`, err.message);
      }
      return [];
    }
  }

  /**
   * Build a cache key from query parameters
   */
  private buildCacheKey(date: string, query: ReceiptQuery): string {
    const parts = [
      date,
      query.session_id || "",
      query.consumer_id || "",
      query.card_last_four || "",
      query.receipt_number || "",
      query.amount_min?.toString() || "",
      query.amount_max?.toString() || "",
    ];
    return parts.join("|");
  }

  /**
   * Parse cursor string into date and session_id
   */
  private parseCursor(cursor?: string): { date: string; sessionId: string } | null {
    if (!cursor) return null;
    const [date, ...sessionParts] = cursor.split(":");
    const sessionId = sessionParts.join(":"); // Handle session IDs with colons
    if (!date || !sessionId) return null;
    return { date, sessionId };
  }

  /**
   * Clear the query cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; enabled: boolean } {
    return {
      size: this.cache.size,
      enabled: this.enableCache,
    };
  }

  /**
   * Query a single index file using S3 Select (SQL).
   * Falls back to client-side filtering if S3 Select unavailable.
   */
  private async queryIndexFile(
    key: string,
    query: ReceiptQuery
  ): Promise<ReceiptMetadata[]> {
    try {
      return await this.queryWithS3Select(key, query);
    } catch (err: any) {
      // Fallback to client-side filtering (MinIO may not support S3 Select)
      return await this.queryWithClientFilter(key, query);
    }
  }

  /**
   * S3 Select - server-side SQL filtering (AWS S3)
   */
  private async queryWithS3Select(
    key: string,
    query: ReceiptQuery
  ): Promise<ReceiptMetadata[]> {
    const sql = this.buildSqlQuery(query);

    const command = new SelectObjectContentCommand({
      Bucket: this.bucket,
      Key: key,
      ExpressionType: "SQL",
      Expression: sql,
      InputSerialization: { JSON: { Type: "LINES" } },
      OutputSerialization: { JSON: {} },
    });

    const response = await this.client.send(command);
    const records: ReceiptMetadata[] = [];

    if (response.Payload) {
      for await (const event of response.Payload) {
        if (event.Records?.Payload) {
          const chunk = new TextDecoder().decode(event.Records.Payload);
          const lines = chunk.split("\n").filter(Boolean);
          for (const line of lines) {
            records.push(JSON.parse(line));
          }
        }
      }
    }

    return records;
  }

  /**
   * Client-side filtering fallback (MinIO / local dev)
   */
  private async queryWithClientFilter(
    key: string,
    query: ReceiptQuery
  ): Promise<ReceiptMetadata[]> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key })
    );
    const content = (await response.Body?.transformToString()) || "";
    
    // Use lodash compact to remove empty lines
    const lines = compact(content.split("\n"));
    const records = lines.map((line) => JSON.parse(line) as ReceiptMetadata);
    
    // Use lodash filter for filtering
    return filter(records, (record) => this.matchesQuery(record, query));
  }

  private matchesQuery(record: ReceiptMetadata, query: ReceiptQuery): boolean {
    if (query.session_id && record.session_id !== query.session_id) {
      return false;
    }
    if (query.consumer_id && record.consumer_id !== query.consumer_id) {
      return false;
    }
    if (query.card_last_four && record.card_last_four !== query.card_last_four) {
      return false;
    }
    if (query.receipt_number && record.receipt_number !== query.receipt_number) {
      return false;
    }
    if (query.amount_min || query.amount_max) {
      const amount = parseFloat(record.amount.replace(/[^0-9.]/g, ""));
      if (query.amount_min && amount < query.amount_min) return false;
      if (query.amount_max && amount > query.amount_max) return false;
    }
    return true;
  }

  private buildSqlQuery(query: ReceiptQuery): string {
    const conditions: string[] = [];

    if (query.session_id) {
      conditions.push(`s.session_id = '${query.session_id}'`);
    }
    if (query.consumer_id) {
      conditions.push(`s.consumer_id = '${query.consumer_id}'`);
    }
    if (query.card_last_four) {
      conditions.push(`s.card_last_four = '${query.card_last_four}'`);
    }
    if (query.receipt_number) {
      conditions.push(`s.receipt_number = '${query.receipt_number}'`);
    }

    const where = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";
    return `SELECT * FROM s3object s${where}`;
  }

  private getDateRange(from?: string, to?: string): string[] {
    const endDate = to ? new Date(to) : new Date();
    const startDate = from ? new Date(from) : new Date(endDate);
    
    // Default to last 7 days if no range specified
    if (!from && !to) {
      startDate.setDate(startDate.getDate() - 7);
    }

    const dates: string[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      dates.push(current.toISOString().split("T")[0]);
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  /**
   * Get PDF content by key
   */
  async getPdf(pdfKey: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: pdfKey })
    );
    const bytes = await response.Body?.transformToByteArray();
    return Buffer.from(bytes || []);
  }

  /**
   * Get PDF as base64 by key
   */
  async getPdfBase64(pdfKey: string): Promise<string> {
    const buffer = await this.getPdf(pdfKey);
    return buffer.toString("base64");
  }

  /**
   * Get a signed URL for direct PDF access
   * @param pdfKey The S3 key for the PDF
   * @param expiresIn Expiration time in seconds (default: 3600 = 1 hour)
   */
  async getSignedPdfUrl(pdfKey: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: pdfKey,
      ResponseContentType: "application/pdf",
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  // Factory for local MinIO
  static createLocal(options?: Partial<QueryServiceConfig>): ReceiptQueryService {
    return new ReceiptQueryService({
      endpoint: "http://localhost:9000",
      region: "us-east-1",
      accessKeyId: "minioadmin",
      secretAccessKey: "minioadmin",
      bucket: "receipts",
      ...options,
    });
  }
}
