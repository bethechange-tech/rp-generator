/** Pagination cursor for receipt queries */
export class Cursor {
  private static readonly SEPARATOR = ":";

  readonly date: string;
  readonly sessionId: string;

  private constructor(date: string, sessionId: string) {
    this.date = date;
    this.sessionId = sessionId;
  }

  /** Parse cursor string into Cursor object */
  static parse(cursor?: string): Cursor | null {
    if (!cursor) return null;

    const [date, ...sessionParts] = cursor.split(this.SEPARATOR);
    const sessionId = sessionParts.join(this.SEPARATOR);

    if (!date || !sessionId) return null;
    return new Cursor(date, sessionId);
  }

  /** Create cursor from date and session ID */
  static from(date: string, sessionId: string): Cursor {
    return new Cursor(date, sessionId);
  }

  /** Serialize cursor to string */
  toString(): string {
    return `${this.date}${Cursor.SEPARATOR}${this.sessionId}`;
  }
}
