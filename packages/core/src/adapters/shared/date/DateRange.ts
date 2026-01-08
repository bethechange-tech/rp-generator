/** Utility class for date range operations */
export class DateRange {
  private static readonly ONE_DAY_MS = 24 * 60 * 60 * 1000;
  private static readonly DEFAULT_DAYS = 365;
  private static readonly MAX_DAYS = 365;

  readonly start: Date;
  readonly end: Date;

  constructor(from?: string, to?: string) {
    this.end = DateRange.parseEnd(to);
    this.start = DateRange.clampStart(DateRange.parseStart(from, this.end), this.end);
  }

  private static parseEnd(to?: string): Date {
    return to ? new Date(to) : new Date();
  }

  private static parseStart(from: string | undefined, end: Date): Date {
    if (from) return new Date(from);
    return new Date(end.getTime() - this.DEFAULT_DAYS * this.ONE_DAY_MS);
  }

  private static clampStart(start: Date, end: Date): Date {
    const maxStart = new Date(end.getTime() - this.MAX_DAYS * this.ONE_DAY_MS);
    return start < maxStart ? maxStart : start;
  }

  /** Get array of date strings (YYYY-MM-DD) */
  toArray(): string[] {
    const dates: string[] = [];
    const endDateStr = DateRange.format(this.end);
    for (let d = new Date(this.start); DateRange.format(d) <= endDateStr; d.setDate(d.getDate() + 1)) {
      dates.push(DateRange.format(d));
    }
    return dates;
  }

  /** Format date as YYYY-MM-DD */
  private static format(date: Date): string {
    return date.toISOString().split("T")[0];
  }

  /** Number of days in range */
  get days(): number {
    return Math.ceil((this.end.getTime() - this.start.getTime()) / DateRange.ONE_DAY_MS) + 1;
  }

  /** Create from query parameters */
  static from(dateFrom?: string, dateTo?: string): DateRange {
    return new DateRange(dateFrom, dateTo);
  }
}
