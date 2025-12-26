import { StorageConfig } from "../../ports";

export type { ReceiptQuery, QueryResult, QueryServiceConfig } from "../../ports";

export interface S3QueryServiceConfig extends StorageConfig {
  enableCache?: boolean;
  cacheSize?: number;
  cacheTtlSeconds?: number;
  maxConcurrency?: number;
}
