import {
  S3Client,
  SelectObjectContentCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3Config, ReceiptMetadata } from "./S3ReceiptStorage";

/**
 * Query parameters for searching receipts.
 * All fields are optional and can be combined for complex queries.
 * 
 * @example
 * // Query by session ID
 * { session_id: "session-12345" }
 * 
 * @example
 * // Query by consumer with date range
 * { consumer_id: "consumer-john", date_from: "2025-12-01", date_to: "2025-12-31" }
 * 
 * @example
 * // Query by card last four digits
 * { card_last_four: "4582", date_from: "2025-12-01" }
 * 
 * @example
 * // Query by amount range (in GBP)
 * { amount_min: 10, amount_max: 50, date_from: "2025-12-01" }
 * 
 * @example
 * // Query by receipt number
 * { receipt_number: "EVC-2025-41823" }
 * 
 * @example
 * // Complex query: consumer + card + date range
 * {
 *   consumer_id: "consumer-john",
 *   card_last_four: "4582",
 *   date_from: "2025-12-01",
 *   date_to: "2025-12-31"
 * }
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
}

/**
 * Query result containing matched records and metadata.
 */
export interface QueryResult {
  /** Array of matching receipt metadata records */
  records: ReceiptMetadata[];
  
  /** List of dates that were scanned (YYYY-MM-DD format) */
  scanned_dates: string[];
}

/**
 * Service for querying receipts stored in S3.
 * 
 * Supports SQL-like filtering on NDJSON index files with the following capabilities:
 * - Filter by session_id, consumer_id, card_last_four, receipt_number
 * - Date range queries (date_from, date_to)
 * - Amount range queries (amount_min, amount_max)
 * - Uses S3 Select for server-side filtering on AWS S3
 * - Falls back to client-side filtering for MinIO/local development
 * 
 * @example
 * ```typescript
 * const queryService = ReceiptQueryService.createLocal();
 * 
 * // Find all receipts for a consumer in December
 * const results = await queryService.query({
 *   consumer_id: "consumer-12345",
 *   date_from: "2025-12-01",
 *   date_to: "2025-12-31",
 * });
 * 
 * console.log(`Found ${results.records.length} receipts`);
 * console.log(`Scanned ${results.scanned_dates.length} days`);
 * 
 * // Download a specific PDF
 * const pdfBuffer = await queryService.getPdf(results.records[0].pdf_key);
 * ```
 */
export class ReceiptQueryService {
  private client: S3Client;
  private bucket: string;

  constructor(config: S3Config) {
    this.bucket = config.bucket;
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
   * Scans daily index files within the date range.
   */
  async query(query: ReceiptQuery): Promise<QueryResult> {
    const dates = this.getDateRange(query.date_from, query.date_to);
    const allRecords: ReceiptMetadata[] = [];

    for (const date of dates) {
      const indexKey = `index/dt=${date}/index.ndjson`;
      try {
        const records = await this.queryIndexFile(indexKey, query);
        allRecords.push(...records);
      } catch (err: any) {
        if (err.name !== "NoSuchKey") {
          console.warn(`Failed to query ${indexKey}:`, err.message);
        }
      }
    }

    return { records: allRecords, scanned_dates: dates };
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
    const lines = content.split("\n").filter(Boolean);

    return lines
      .map((line) => JSON.parse(line) as ReceiptMetadata)
      .filter((record) => this.matchesQuery(record, query));
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
  static createLocal(): ReceiptQueryService {
    return new ReceiptQueryService({
      endpoint: "http://localhost:9000",
      region: "us-east-1",
      accessKeyId: "minioadmin",
      secretAccessKey: "minioadmin",
      bucket: "receipts",
    });
  }
}
