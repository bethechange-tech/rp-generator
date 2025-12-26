import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { compact } from "lodash";

export interface S3Config {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export interface ReceiptMetadata {
  session_id: string;
  consumer_id: string;
  receipt_number: string;
  payment_date: string;
  card_last_four: string;
  amount: string;
  pdf_key: string;
  metadata_key: string;
  created_at: string;
}

export interface ReceiptUploadResult {
  pdf_key: string;
  metadata_key: string;
  index_key: string;
  consumer_index_key: string;
  card_index_key: string;
}

/**
 * Secondary index types for O(1) lookups
 */
export enum SecondaryIndexType {
  CONSUMER = "by-consumer",
  CARD = "by-card",
}

export class S3ReceiptStorage {
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
   * Store receipt with full indexing (transactional):
   * 1. Store PDF at receipts/pdfs/{session_id}.pdf
   * 2. Store metadata at receipts/metadata/{session_id}.json
   * 3. Append to daily index at receipts/index/dt={date}/index.ndjson
   * 4. Append to consumer index at receipts/index/by-consumer/{consumer_id}/receipts.ndjson
   * 5. Append to card index at receipts/index/by-card/{card_last_four}/receipts.ndjson
   * 
   * If any step fails, previously uploaded objects are rolled back.
   */
  async storeReceipt(
    base64Pdf: string,
    metadata: Omit<ReceiptMetadata, "pdf_key" | "metadata_key" | "created_at">
  ): Promise<ReceiptUploadResult> {
    const sessionId = metadata.session_id;
    const date = metadata.payment_date;

    const pdfKey = `pdfs/${sessionId}.pdf`;
    const metadataKey = `metadata/${sessionId}.json`;
    const indexKey = `index/dt=${date}/index.ndjson`;
    const consumerIndexKey = this.getSecondaryIndexKey(SecondaryIndexType.CONSUMER, metadata.consumer_id);
    const cardIndexKey = this.getSecondaryIndexKey(SecondaryIndexType.CARD, metadata.card_last_four);

    const uploadedKeys: string[] = [];
    const indexStates: Map<string, string | null> = new Map();

    try {
      // 1. Store PDF
      await this.uploadPdf(base64Pdf, pdfKey);
      uploadedKeys.push(pdfKey);

      // 2. Store Metadata JSON
      const fullMetadata: ReceiptMetadata = {
        ...metadata,
        pdf_key: pdfKey,
        metadata_key: metadataKey,
        created_at: new Date().toISOString(),
      };
      await this.uploadMetadata(fullMetadata, metadataKey);
      uploadedKeys.push(metadataKey);

      // 3. Append to Daily Index (NDJSON) - save previous state for rollback
      const previousIndexContent = await this.getIndexContent(indexKey);
      indexStates.set(indexKey, previousIndexContent);
      await this.appendToIndex(fullMetadata, indexKey, previousIndexContent);

      // 4. Append to Consumer Secondary Index
      const previousConsumerIndex = await this.getIndexContent(consumerIndexKey);
      indexStates.set(consumerIndexKey, previousConsumerIndex);
      await this.appendToIndex(fullMetadata, consumerIndexKey, previousConsumerIndex);
      console.log(`  Consumer Index: ${consumerIndexKey}`);

      // 5. Append to Card Secondary Index
      const previousCardIndex = await this.getIndexContent(cardIndexKey);
      indexStates.set(cardIndexKey, previousCardIndex);
      await this.appendToIndex(fullMetadata, cardIndexKey, previousCardIndex);
      console.log(`  Card Index: ${cardIndexKey}`);

      console.log(`Receipt stored: ${sessionId}`);
      return {
        pdf_key: pdfKey,
        metadata_key: metadataKey,
        index_key: indexKey,
        consumer_index_key: consumerIndexKey,
        card_index_key: cardIndexKey,
      };

    } catch (error) {
      console.error(`Transaction failed, rolling back...`);
      await this.rollback(uploadedKeys, indexStates);
      throw error;
    }
  }

  /**
   * Get the S3 key for a secondary index
   */
  getSecondaryIndexKey(type: SecondaryIndexType, value: string): string {
    return `index/${type}/${value}/receipts.ndjson`;
  }

  /**
   * Read all entries from a secondary index file
   */
  async readSecondaryIndex(type: SecondaryIndexType, value: string): Promise<ReceiptMetadata[]> {
    const key = this.getSecondaryIndexKey(type, value);
    try {
      const content = await this.getIndexContent(key);
      if (!content) return [];
      
      const lines = compact(content.split("\n"));
      return lines.map((line) => JSON.parse(line) as ReceiptMetadata);
    } catch (err: any) {
      if (err.name === "NoSuchKey") return [];
      throw err;
    }
  }

  private async rollback(
    keysToDelete: string[],
    indexStates: Map<string, string | null>
  ): Promise<void> {
    // Delete uploaded objects
    for (const key of keysToDelete) {
      try {
        await this.client.send(
          new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
        );
        console.log(`  Rolled back: ${key}`);
      } catch (err) {
        console.error(`  Failed to rollback ${key}:`, (err as Error).message);
      }
    }

    // Restore previous index content for all affected indexes
    const indexKeys = Array.from(indexStates.keys());
    for (const indexKey of indexKeys) {
      const previousContent = indexStates.get(indexKey);
      if (previousContent !== null && previousContent !== undefined) {
        try {
          await this.client.send(
            new PutObjectCommand({
              Bucket: this.bucket,
              Key: indexKey,
              Body: previousContent,
              ContentType: "application/x-ndjson",
            })
          );
          console.log(`  Rolled back index: ${indexKey}`);
        } catch (err) {
          console.error(`  Failed to rollback index ${indexKey}:`, (err as Error).message);
        }
      }
    }
  }

  private async uploadPdf(base64: string, key: string): Promise<void> {
    const buffer = Buffer.from(base64, "base64");
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: "application/pdf",
      })
    );
    console.log(`  PDF: ${key}`);
  }

  private async uploadMetadata(metadata: ReceiptMetadata, key: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: JSON.stringify(metadata, null, 2),
        ContentType: "application/json",
      })
    );
    console.log(`  Metadata: ${key}`);
  }

  private async getIndexContent(key: string): Promise<string | null> {
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

  private async appendToIndex(
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

  // Factory for local MinIO
  static createLocal(): S3ReceiptStorage {
    return new S3ReceiptStorage({
      endpoint: "http://localhost:9000",
      region: "us-east-1",
      accessKeyId: "minioadmin",
      secretAccessKey: "minioadmin",
      bucket: "receipts",
    });
  }
}
