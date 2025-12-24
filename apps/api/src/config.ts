import { S3Config, ReceiptQueryService, S3ReceiptStorage } from "@ev-receipt/core";

export function getS3Config(): S3Config {
  return {
    endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
    region: process.env.S3_REGION || "us-east-1",
    accessKeyId: process.env.S3_ACCESS_KEY || "minioadmin",
    secretAccessKey: process.env.S3_SECRET_KEY || "minioadmin",
    bucket: process.env.S3_BUCKET || "receipts",
  };
}

let storage: S3ReceiptStorage | null = null;
let queryService: ReceiptQueryService | null = null;

export function getStorage(): S3ReceiptStorage {
  if (!storage) {
    storage = new S3ReceiptStorage(getS3Config());
  }
  return storage;
}

export function getQueryService(): ReceiptQueryService {
  if (!queryService) {
    queryService = new ReceiptQueryService(getS3Config());
  }
  return queryService;
}
