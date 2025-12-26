import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { IndexManager } from "./IndexManager";

export interface RollbackManagerConfig {
  client: S3Client;
  bucket: string;
  indexManager: IndexManager;
}

/** Handles rollback operations for failed S3 transactions */
export class RollbackManager {
  private client: S3Client;
  private bucket: string;
  private indexManager: IndexManager;

  constructor(config: RollbackManagerConfig) {
    this.client = config.client;
    this.bucket = config.bucket;
    this.indexManager = config.indexManager;
  }

  /** Rollback uploaded objects and restore index to previous state */
  async execute(
    keysToDelete: string[],
    indexKey: string,
    previousIndexContent: string | null
  ): Promise<void> {
    await this.deleteObjects(keysToDelete);
    await this.restoreIndex(indexKey, previousIndexContent);
  }

  /** Delete uploaded objects */
  private async deleteObjects(keys: string[]): Promise<void> {
    for (const key of keys) {
      try {
        await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
        console.log(`  Rolled back: ${key}`);
      } catch (err) {
        console.error(`  Failed to rollback ${key}:`, (err as Error).message);
      }
    }
  }

  /** Restore index to previous state */
  private async restoreIndex(indexKey: string, previousContent: string | null): Promise<void> {
    if (previousContent !== null) {
      try {
        await this.indexManager.restore(indexKey, previousContent);
      } catch (err) {
        console.error(`  Failed to rollback index:`, (err as Error).message);
      }
    }
  }
}
