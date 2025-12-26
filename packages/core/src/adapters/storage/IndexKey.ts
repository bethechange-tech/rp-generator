/** S3 index key builder for date-partitioned receipts */
export class IndexKey {
  private static readonly PREFIX = "index/dt=";
  private static readonly SUFFIX = "/index.ndjson";

  readonly date: string;
  readonly key: string;

  private constructor(date: string) {
    this.date = date;
    this.key = `${IndexKey.PREFIX}${date}${IndexKey.SUFFIX}`;
  }

  /** Create index key from date string */
  static fromDate(date: string): IndexKey {
    return new IndexKey(date);
  }

  /** Parse index key back to date */
  static parseDate(key: string): string | null {
    if (!key.startsWith(this.PREFIX) || !key.endsWith(this.SUFFIX)) return null;
    return key.slice(this.PREFIX.length, -this.SUFFIX.length);
  }

  toString(): string {
    return this.key;
  }
}
