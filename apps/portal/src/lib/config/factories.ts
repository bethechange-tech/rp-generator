import { ReceiptQueryService, S3Config } from "@ev-receipt/core";

export class S3ConfigFactory {
  static create(): S3Config {
    return {
      ...(process.env.S3_ENDPOINT && { endpoint: process.env.S3_ENDPOINT }),
      region: process.env.S3_REGION || "us-east-1",
      accessKeyId: process.env.S3_ACCESS_KEY || "minioadmin",
      secretAccessKey: process.env.S3_SECRET_KEY || "minioadmin",
      bucket: process.env.S3_BUCKET || "receipts",
    };
  }
}

export class QueryServiceFactory {
  private static instance: ReceiptQueryService | null = null;

  static get(): ReceiptQueryService {
    if (!this.instance) {
      this.instance = new ReceiptQueryService(S3ConfigFactory.create());
    }
    return this.instance;
  }

  static reset(): void {
    this.instance = null;
  }
}
