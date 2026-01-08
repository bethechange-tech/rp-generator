import {
  S3Client,
  SelectObjectContentCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { gunzipSync } from "zlib";
import { orderBy, findIndex, last, compact, flatMap } from "lodash";

import {
  IReceiptQueryService,
  ReceiptQuery,
  QueryResult,
  ReceiptMetadata,
  QueryServiceConfig,
} from "../../ports";
import { DateRange, Cursor, ParallelScanner } from "../shared";
import { S3ClientBuilder, IndexKey } from "../storage";
import { QueryCache } from "./QueryCache";
import { QueryFilter } from "./QueryFilter";

/** Service for querying receipts stored in S3 */
export class ReceiptQueryService implements IReceiptQueryService {
  private client: S3Client;
  private bucket: string;
  private cache: QueryCache;
  private scanner: ParallelScanner<string>;

  constructor(config: QueryServiceConfig) {
    this.bucket = config.bucket;
    this.scanner = new ParallelScanner(config.maxConcurrency ?? 5);
    this.cache = new QueryCache({
      enabled: config.enableCache ?? true,
      maxSize: config.cacheSize ?? 100,
      ttlSeconds: config.cacheTtlSeconds ?? 300,
    });
    this.client = S3ClientBuilder.fromConfig(config);
  }

  /** Query receipts with filtering and pagination */
  async query(query: ReceiptQuery): Promise<QueryResult> {
    if (!QueryFilter.hasSearchCriteria(query)) {
      return {
        records: [],
        scanned_dates: [],
        total_count: 0,
        has_more: false,
        page_size: query.limit ?? 50,
      };
    }

    const dateRange = DateRange.from(query.date_from, query.date_to);
    const dates = dateRange.toArray();
    const limit = Math.min(query.limit ?? 50, 100);
    const cursor = Cursor.parse(query.cursor);

    const allRecords = await this.scanner.scanAndFlatten(dates, (date) =>
      this.cache.queryDate(date, query, (prefix, q) => this.queryDatePrefix(prefix, q))
    );

    const sortedRecords = orderBy(allRecords, ["payment_date", "session_id"], ["desc", "desc"]);

    let startIndex = 0;

    if (cursor) {
      startIndex = findIndex(sortedRecords, (r) => r.payment_date === cursor.date && r.session_id === cursor.sessionId);
      if (startIndex === -1) startIndex = 0;
      else startIndex += 1;
    }

    const totalCount = sortedRecords.length;
    const paginatedRecords = sortedRecords.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < totalCount;

    let nextCursor: string | undefined;
    const lastRecord = last(paginatedRecords);
    if (hasMore && lastRecord) {
      nextCursor = Cursor.from(lastRecord.payment_date, lastRecord.session_id).toString();
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

  /** Query index file with S3 Select or fallback to client filter */
  private async queryDatePrefix(prefix: string, query: ReceiptQuery): Promise<ReceiptMetadata[]> {
    const partFiles = await this.listPartFiles(prefix);
    if (partFiles.length === 0) return [];

    const results = await Promise.all(
      partFiles.map((key) => this.queryPartFile(key, query))
    );
    return flatMap(results);
  }

  /** List all part files in a date prefix */
  private async listPartFiles(prefix: string): Promise<string[]> {
    const response = await this.client.send(
      new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix })
    );
    return (response.Contents ?? [])
      .map((obj) => obj.Key!)
      .filter((key) => IndexKey.isPartFile(key));
  }

  /** Query a single part file */
  private async queryPartFile(key: string, query: ReceiptQuery): Promise<ReceiptMetadata[]> {
    try {
      return await this.queryWithS3Select(key, query);
    } catch (error) {
      console.warn(`S3 Select failed for ${key}:`, error instanceof Error ? error.message : error);
      return await this.queryWithClientFilter(key, query);
    }
  }

  /** S3 Select - server-side filtering */
  private async queryWithS3Select(key: string, query: ReceiptQuery): Promise<ReceiptMetadata[]> {
    const sqlQuery = QueryFilter.buildSql(query);
    const command = new SelectObjectContentCommand({
      Bucket: this.bucket,
      Key: key,
      ExpressionType: "SQL",
      Expression: sqlQuery,
      InputSerialization: { JSON: { Type: "LINES" }, CompressionType: "GZIP" },
      OutputSerialization: { JSON: {} },
    });

    const response = await this.client.send(command);
    const lines: string[] = [];

    if (response.Payload) {
      for await (const event of response.Payload) {
        if (event.Records?.Payload) {
          const chunk = new TextDecoder().decode(event.Records.Payload);
          lines.push(...compact(chunk.split("\n")));
        }
      }
    }

    return lines.map((line) => JSON.parse(line) as ReceiptMetadata);
  }

  /** Client-side filtering fallback */
  private async queryWithClientFilter(key: string, query: ReceiptQuery): Promise<ReceiptMetadata[]> {
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const bytes = await response.Body?.transformToByteArray();
    if (!bytes?.length) return [];
    const content = gunzipSync(Buffer.from(bytes)).toString("utf-8");
    const records = compact(content.split("\n")).map((line) => JSON.parse(line) as ReceiptMetadata);
    return QueryFilter.filterRecords(records, query);
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheStats(): { size: number; enabled: boolean } {
    return this.cache.getStats();
  }

  /** Get PDF content by key */
  async getPdf(pdfKey: string): Promise<Buffer> {
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: pdfKey }));
    const bytes = await response.Body?.transformToByteArray();
    return Buffer.from(bytes || []);
  }

  /** Get PDF as base64 */
  async getPdfBase64(pdfKey: string): Promise<string> {
    const buffer = await this.getPdf(pdfKey);
    return buffer.toString("base64");
  }

  /** Get signed URL for PDF */
  async getSignedPdfUrl(pdfKey: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: pdfKey,
      ResponseContentType: "application/pdf",
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  /** Factory for local MinIO */
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
