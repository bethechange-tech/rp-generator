import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { gzipSync } from "zlib";
import { randomUUID } from "crypto";
import { ReceiptMetadata } from "../../ports";

export interface IndexManagerConfig {
  client: S3Client;
  bucket: string;
}

/** Manages compressed NDJSON part files in S3 */
export class IndexManager {
  private client: S3Client;
  private bucket: string;

  constructor(config: IndexManagerConfig) {
    this.client = config.client;
    this.bucket = config.bucket;
  }

  /** Build part file key from date and card_last_four (with hour + shard) */
  buildKey(date: string, cardLastFour: string): string {
    const hour = String(new Date().getUTCHours()).padStart(2, "0");
    const shard = String(parseInt(cardLastFour, 10) % 100).padStart(2, "0");
    const uuid = randomUUID();
    return `index/dt=${date}/hr=${hour}/shard=${shard}/part-${uuid}.ndjson.gz`;
  }

  /** Write metadata as a new part file (no append, just create) */
  async writePart(metadata: ReceiptMetadata, key: string): Promise<void> {
    const content = JSON.stringify(metadata);
    const compressed = gzipSync(Buffer.from(content, "utf-8"));

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: compressed,
        ContentType: "application/x-ndjson",
        ContentEncoding: "gzip",
      })
    );
    console.log(`  Index: ${key}`);
  }

  /** Delete a part file (for rollback) */
  async deletePart(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
    );
    console.log(`  Rolled back index: ${key}`);
  }
}
