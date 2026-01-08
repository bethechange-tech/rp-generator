import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

export interface RollbackManagerConfig {
  client: S3Client;
  bucket: string;
}

/** Handles rollback operations for failed S3 transactions */
export class RollbackManager {
  private client: S3Client;
  private bucket: string;

  constructor(config: RollbackManagerConfig) {
    this.client = config.client;
    this.bucket = config.bucket;
  }

  /** Rollback uploaded objects by deleting them */
  async execute(keysToDelete: string[]): Promise<void> {
    for (const key of keysToDelete) {
      try {
        await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
        console.log(`  Rolled back: ${key}`);
      } catch (err) {
        console.error(`  Failed to rollback ${key}:`, (err as Error).message);
      }
    }
  }
}
 
