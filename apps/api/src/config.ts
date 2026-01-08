import type { IReceiptStorage, IReceiptQueryService } from "@ev-receipt/core";
import { S3Config, ReceiptQueryService, S3ReceiptStorage } from "@ev-receipt/core";

const s3Config: S3Config = {
  ...(process.env.S3_ENDPOINT && { endpoint: process.env.S3_ENDPOINT }),
  region: process.env.S3_REGION || "us-east-1",
  accessKeyId: process.env.S3_ACCESS_KEY || "minioadmin",
  secretAccessKey: process.env.S3_SECRET_KEY || "minioadmin",
  bucket: process.env.S3_BUCKET || "receipts",
};

console.log("Using S3 Configuration:", {
  endpoint: s3Config.endpoint || "default",
  region: s3Config.region,
  bucket: s3Config.bucket,
});

export class StorageFactory {
  private static instance: IReceiptStorage | null = null;

  static get(): IReceiptStorage {
    if (!this.instance) {
      this.instance = new S3ReceiptStorage(s3Config);
    }
    return this.instance;
  }

  static reset(): void {
    this.instance = null;
  }
}

export class QueryServiceFactory {
  private static instance: IReceiptQueryService | null = null;

  static get(): IReceiptQueryService {
    if (!this.instance) {
      this.instance = new ReceiptQueryService(s3Config);
    }
    return this.instance;
  }

  static reset(): void {
    this.instance = null;
  }
}
