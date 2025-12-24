import { ReceiptQueryService, S3Config } from "@ev-receipt/core";

// S3/MinIO configuration
export function getS3Config(): S3Config {
  return {
    endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
    region: process.env.S3_REGION || "us-east-1",
    accessKeyId: process.env.S3_ACCESS_KEY || "minioadmin",
    secretAccessKey: process.env.S3_SECRET_KEY || "minioadmin",
    bucket: process.env.S3_BUCKET || "receipts",
  };
}

// Singleton query service
let queryService: ReceiptQueryService | null = null;

export function getQueryService(): ReceiptQueryService {
  if (!queryService) {
    queryService = new ReceiptQueryService(getS3Config());
  }
  return queryService;
}
