/** S3 index key builder for date-partitioned receipts with sharding */
export class IndexKey {
  private static readonly PREFIX = "index/dt=";

  readonly date: string;
  readonly prefix: string;

  private constructor(date: string) {
    this.date = date;
    this.prefix = `${IndexKey.PREFIX}${date}/`;
  }

  /** Create index key from date string */
  static fromDate(date: string): IndexKey {
    return new IndexKey(date);
  }

  /** Parse date from a part file key */
  static parseDate(key: string): string | null {
    if (!key.startsWith(this.PREFIX)) return null;
    const afterPrefix = key.slice(this.PREFIX.length);
    const slashIndex = afterPrefix.indexOf("/");
    if (slashIndex === -1) return null;
    return afterPrefix.slice(0, slashIndex);
  }

  /** Check if a key is a valid part file */
  static isPartFile(key: string): boolean {
    return key.includes("/part-") && key.endsWith(".ndjson.gz");
  }

  /** Calculate shard from card_last_four */
  static getShard(cardLastFour: string): string {
    return String(parseInt(cardLastFour, 10) % 100).padStart(2, "0");
  }

  toString(): string {
    return this.prefix;
  }
}
