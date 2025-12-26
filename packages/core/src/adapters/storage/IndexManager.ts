import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { ReceiptMetadata } from "../../ports";

export interface IndexManagerConfig {
  client: S3Client;
  bucket: string;
}

/** Manages NDJSON index files in S3 */
export class IndexManager {
  private client: S3Client;
  private bucket: string;

  constructor(config: IndexManagerConfig) {
    this.client = config.client;
    this.bucket = config.bucket;
  }

  /** Build index key from date */
  buildKey(date: string): string {
    return `index/dt=${date}/index.ndjson`;
  }

  /** Get existing index content, returns null if not found */
  async getContent(key: string): Promise<string | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key })
      );
      return (await response.Body?.transformToString()) || "";
    } catch (err: any) {
      if (err.name === "NoSuchKey") return null;
      throw err;
    }
  }

  /** Append metadata to index file */
  async append(
    metadata: ReceiptMetadata,
    key: string,
    existingContent: string | null
  ): Promise<void> {
    const newLine = JSON.stringify(metadata);
    const updatedContent = existingContent ? `${existingContent}\n${newLine}` : newLine;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: updatedContent,
        ContentType: "application/x-ndjson",
      })
    );
    console.log(`  Index: ${key}`);
  }

  /** Restore previous index content (for rollback) */
  async restore(key: string, content: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: content,
        ContentType: "application/x-ndjson",
      })
    );
    console.log(`  Rolled back index: ${key}`);
  }
}
