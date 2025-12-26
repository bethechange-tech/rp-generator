#!/usr/bin/env node
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { compact, groupBy, flatMap, size } from "lodash";
import { ReceiptMetadata, SecondaryIndexType } from "../adapters/S3ReceiptStorage";

interface RebuildConfig {
  dryRun: boolean;
  dateFrom: string;
  dateTo: string;
  endpoint: string;
  bucket: string;
}

/** Rebuilds secondary indexes (consumer/card) from date-partitioned index files */
class SecondaryIndexRebuilder {
  private client: S3Client;
  private config: RebuildConfig;
  private stats = {
    datesScanned: 0,
    receiptsProcessed: 0,
    consumerIndexes: 0,
    cardIndexes: 0,
    errors: [] as string[],
  };

  constructor(config: RebuildConfig) {
    this.config = config;
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "minioadmin",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "minioadmin",
      },
      forcePathStyle: true,
    });
  }

  /** Main entry point - orchestrates the rebuild process */
  async run(): Promise<void> {
    this.printHeader();

    const indexFiles = await this.listDateIndexFiles();
    console.log(`📂 Found ${indexFiles.length} date index files\n`);

    const receipts = await this.readAllReceipts(indexFiles);
    if (receipts.length === 0) {
      console.log("⚠️  No receipts found");
      return;
    }

    const byConsumer = groupBy(receipts, "consumer_id");
    const byCard = groupBy(receipts, "card_last_four");

    console.log(`\n🗂️  ${Object.keys(byConsumer).length} consumers, ${Object.keys(byCard).length} cards\n`);

    await this.writeSecondaryIndexes(byConsumer, SecondaryIndexType.CONSUMER, "consumer");
    await this.writeSecondaryIndexes(byCard, SecondaryIndexType.CARD, "card");

    this.printStats();
  }

  /** Prints configuration banner */
  private printHeader(): void {
    console.log("\n🔧 Secondary Index Rebuilder");
    console.log("============================");
    console.log(`Mode: ${this.config.dryRun ? "DRY RUN" : "LIVE"}`);
    console.log(`Range: ${this.config.dateFrom} → ${this.config.dateTo}`);
    console.log(`Bucket: ${this.config.bucket}\n`);
  }

  /** Lists all date-partitioned index files within the configured date range */
  private async listDateIndexFiles(): Promise<string[]> {
    const keys: string[] = [];
    let token: string | undefined;

    do {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.config.bucket,
          Prefix: "index/dt=",
          ContinuationToken: token,
        })
      );

      const contents = response.Contents || [];
      contents
        .filter((obj) => {
          const match = obj.Key?.match(/dt=(\d{4}-\d{2}-\d{2})\/index\.ndjson$/);
          return match && match[1] >= this.config.dateFrom && match[1] <= this.config.dateTo;
        })
        .forEach((obj) => keys.push(obj.Key!));

      token = response.NextContinuationToken;
    } while (token);

    return keys.sort();
  }

  /** Reads and parses all receipts from the given NDJSON index files */
  private async readAllReceipts(indexFiles: string[]): Promise<ReceiptMetadata[]> {
    const results: ReceiptMetadata[][] = [];

    for (const key of indexFiles) {
      try {
        const response = await this.client.send(
          new GetObjectCommand({ Bucket: this.config.bucket, Key: key })
        );
        const content = (await response.Body?.transformToString()) || "";
        const records = compact(content.split("\n")).map((line) => JSON.parse(line));
        results.push(records);
        this.stats.datesScanned++;
        process.stdout.write(`\r📥 Reading: ${this.stats.datesScanned}/${indexFiles.length} files`);
      } catch (err) {
        this.stats.errors.push(`Read failed: ${key}`);
      }
    }

    const receipts = flatMap(results);
    this.stats.receiptsProcessed = receipts.length;
    return receipts;
  }

  /** Writes grouped receipts to secondary index files (consumer or card) */
  private async writeSecondaryIndexes(
    grouped: Record<string, ReceiptMetadata[]>,
    indexType: SecondaryIndexType,
    label: string
  ): Promise<void> {
    const total = size(grouped);
    let count = 0;

    for (const [id, receipts] of Object.entries(grouped)) {
      const key = `index/${indexType}/${id}/receipts.ndjson`;
      count++;

      if (this.config.dryRun) {
        process.stdout.write(`\r📤 [DRY RUN] ${label}: ${count}/${total}`);
      } else {
        try {
          const content = receipts.map((r) => JSON.stringify(r)).join("\n");
          await this.client.send(
            new PutObjectCommand({
              Bucket: this.config.bucket,
              Key: key,
              Body: content,
              ContentType: "application/x-ndjson",
            })
          );
          process.stdout.write(`\r📤 Writing ${label}: ${count}/${total}`);
        } catch (err) {
          this.stats.errors.push(`Write failed: ${key}`);
        }
      }
    }

    if (indexType === SecondaryIndexType.CONSUMER) {
      this.stats.consumerIndexes = count;
    } else {
      this.stats.cardIndexes = count;
    }

    console.log();
  }

  /** Prints final statistics and exits with error code if failures occurred */
  private printStats(): void {
    console.log("\n" + "=".repeat(35));
    console.log("📊 Results");
    console.log("=".repeat(35));
    console.log(`Dates scanned:     ${this.stats.datesScanned}`);
    console.log(`Receipts:          ${this.stats.receiptsProcessed}`);
    console.log(`Consumer indexes:  ${this.stats.consumerIndexes}`);
    console.log(`Card indexes:      ${this.stats.cardIndexes}`);

    if (this.stats.errors.length > 0) {
      console.log(`\n❌ Errors: ${this.stats.errors.length}`);
      this.stats.errors.forEach((e) => console.log(`   - ${e}`));
      process.exit(1);
    } else {
      console.log("\n✅ Complete!");
    }
  }
}

/** Parses CLI arguments into RebuildConfig */
function parseArgs(): RebuildConfig {
  const args = process.argv.slice(2);
  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const config: RebuildConfig = {
    dryRun: false,
    dateFrom: thirtyDaysAgo,
    dateTo: today,
    endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
    bucket: process.env.S3_BUCKET || "receipts",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--dry-run") config.dryRun = true;
    else if (arg === "--date-from") config.dateFrom = args[++i];
    else if (arg === "--date-to") config.dateTo = args[++i];
    else if (arg === "--endpoint") config.endpoint = args[++i];
    else if (arg === "--bucket") config.bucket = args[++i];
    else if (arg === "--help") {
      console.log(`
Usage: npx ts-node src/scripts/rebuild-indexes.ts [options]

Options:
  --dry-run         Preview without writing
  --date-from DATE  Start date (default: 30 days ago)
  --date-to DATE    End date (default: today)
  --endpoint URL    S3 endpoint (default: localhost:9000)
  --bucket NAME     S3 bucket (default: receipts)
`);
      process.exit(0);
    }
  }

  return config;
}

new SecondaryIndexRebuilder(parseArgs()).run().catch((err) => {
  console.error("❌ Fatal:", err.message);
  process.exit(1);
});
