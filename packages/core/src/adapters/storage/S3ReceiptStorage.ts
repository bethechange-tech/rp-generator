import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { S3ClientBuilder } from "./S3ClientBuilder";
import { IndexManager } from "./IndexManager";
import { RollbackManager } from "./RollbackManager";
import { Money } from "../shared";
import {
  IReceiptStorage,
  ReceiptMetadata,
  ReceiptUploadResult,
  StorageConfig,
} from "../../ports";

/** S3-specific configuration (extends generic StorageConfig) */
export interface S3Config extends StorageConfig {}

export class S3ReceiptStorage implements IReceiptStorage {
  private client: S3Client;
  private bucket: string;
  private indexManager: IndexManager;
  private rollbackManager: RollbackManager;

  constructor(config: S3Config) {
    this.bucket = config.bucket;
    this.client = S3ClientBuilder.fromConfig(config);
    this.indexManager = new IndexManager({ client: this.client, bucket: this.bucket });
    this.rollbackManager = new RollbackManager({
      client: this.client,
      bucket: this.bucket,
      indexManager: this.indexManager,
    });
  }

  /**
   * Store receipt with full indexing (transactional):
   * 1. Store PDF at receipts/pdfs/{session_id}.pdf
   * 2. Store metadata at receipts/metadata/{session_id}.json
   * 3. Append to daily index at receipts/index/dt={date}/index.ndjson
   */
  async storeReceipt(
    base64Pdf: string,
    metadata: Omit<ReceiptMetadata, "pdf_key" | "metadata_key" | "created_at">
  ): Promise<ReceiptUploadResult> {
    const sessionId = metadata.session_id;
    const date = metadata.payment_date;

    const pdfKey = `pdfs/${sessionId}.pdf`;
    const metadataKey = `metadata/${sessionId}.json`;
    const indexKey = this.indexManager.buildKey(date);

    const uploadedKeys: string[] = [];
    let previousIndexContent: string | null = null;

    try {
      await this.uploadPdf(base64Pdf, pdfKey);
      uploadedKeys.push(pdfKey);

      const amountPence = Money.parse(metadata.amount).toPence();
      
      const fullMetadata: ReceiptMetadata = {
        ...metadata,
        amount_pence: amountPence,
        pdf_key: pdfKey,
        metadata_key: metadataKey,
        created_at: new Date().toISOString(),
      };

      await this.uploadMetadata(fullMetadata, metadataKey);
      uploadedKeys.push(metadataKey);

      previousIndexContent = await this.indexManager.getContent(indexKey);
      await this.indexManager.append(fullMetadata, indexKey, previousIndexContent);      console.log(`Receipt stored: ${sessionId}`);
      return { pdf_key: pdfKey, metadata_key: metadataKey, index_key: indexKey };
    } catch (error) {
      console.error(`Transaction failed, rolling back...`);
      await this.rollbackManager.execute(uploadedKeys, indexKey, previousIndexContent);
      throw error;
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
