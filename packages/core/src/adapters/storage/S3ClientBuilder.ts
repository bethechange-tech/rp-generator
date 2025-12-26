import { S3Client } from "@aws-sdk/client-s3";
import { StorageConfig } from "../../ports";

/** S3-specific client configuration */
export interface S3ClientConfig extends StorageConfig {}

/** Builder for creating configured S3 clients */
export class S3ClientBuilder {
  private config: Partial<S3ClientConfig> = {};

  endpoint(endpoint: string): this {
    this.config.endpoint = endpoint;
    return this;
  }

  region(region: string): this {
    this.config.region = region;
    return this;
  }

  credentials(accessKeyId: string, secretAccessKey: string): this {
    this.config.accessKeyId = accessKeyId;
    this.config.secretAccessKey = secretAccessKey;
    return this;
  }

  build(): S3Client {
    this.validate();

    return new S3Client({
      endpoint: this.config.endpoint,
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKeyId!,
        secretAccessKey: this.config.secretAccessKey!,
      },
      forcePathStyle: true,
    });
  }

  private validate(): void {
    const required: (keyof S3ClientConfig)[] = ["endpoint", "region", "accessKeyId", "secretAccessKey"];
    const missing = required.filter((key) => !this.config[key]);

    if (missing.length > 0) {
      throw new Error(`S3ClientBuilder missing required fields: ${missing.join(", ")}`);
    }
  }

  /** Create from config object */
  static fromConfig(config: S3ClientConfig): S3Client {
    return new S3ClientBuilder()
      .endpoint(config.endpoint)
      .region(config.region)
      .credentials(config.accessKeyId, config.secretAccessKey)
      .build();
  }

  /** Create local MinIO client */
  static local(): S3Client {
    return new S3ClientBuilder()
      .endpoint("http://localhost:9000")
      .region("us-east-1")
      .credentials("minioadmin", "minioadmin")
      .build();
  }
}
