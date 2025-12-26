/**
 * Utility class for handling monetary values.
 * Stores amounts in pence (smallest currency unit) to avoid floating point issues.
 */
export class Money {
  private readonly pence: number;

  private constructor(pence: number) {
    this.pence = Math.round(pence);
  }

  /** Create Money from pence (integer) */
  static fromPence(pence: number): Money {
    return new Money(pence);
  }

  /** Create Money from pounds (decimal) */
  static fromPounds(pounds: number): Money {
    return new Money(pounds * 100);
  }

  /**
   * Parse a currency string (e.g., "£25.50", "$100.00", "25.50")
   * Strips currency symbols and converts to pence
   */
  static parse(amount: string): Money {
    const cleaned = amount.replace(/[^0-9.,-]/g, "");
    // Handle negative amounts
    const isNegative = amount.includes("-") || cleaned.startsWith("-");
    const numericValue = parseFloat(cleaned.replace("-", ""));
    
    if (isNaN(numericValue)) {
      return new Money(0);
    }
    
    const pence = Math.round(numericValue * 100);
    return new Money(isNegative ? -pence : pence);
  }

  /** Get value in pence (integer) */
  toPence(): number {
    return this.pence;
  }

  /** Get value in pounds (decimal) */
  toPounds(): number {
    return this.pence / 100;
  }

  /** Format as currency string with symbol */
  format(symbol: string = "£"): string {
    const pounds = Math.abs(this.pence) / 100;
    const formatted = pounds.toFixed(2);
    return this.pence < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
  }

  /** Add two Money values */
  add(other: Money): Money {
    return new Money(this.pence + other.pence);
  }

  /** Subtract Money value */
  subtract(other: Money): Money {
    return new Money(this.pence - other.pence);
  }

  /** Multiply by a factor */
  multiply(factor: number): Money {
    return new Money(this.pence * factor);
  }

  /** Check if equal to another Money value */
  equals(other: Money): boolean {
    return this.pence === other.pence;
  }

  /** Check if greater than another Money value */
  isGreaterThan(other: Money): boolean {
    return this.pence > other.pence;
  }

  /** Check if less than another Money value */
  isLessThan(other: Money): boolean {
    return this.pence < other.pence;
  }

  /** Check if greater than or equal to another Money value */
  isGreaterThanOrEqual(other: Money): boolean {
    return this.pence >= other.pence;
  }

  /** Check if less than or equal to another Money value */
  isLessThanOrEqual(other: Money): boolean {
    return this.pence <= other.pence;
  }

  /** Check if zero */
  isZero(): boolean {
    return this.pence === 0;
  }

  /** Check if positive */
  isPositive(): boolean {
    return this.pence > 0;
  }

  /** Check if negative */
  isNegative(): boolean {
    return this.pence < 0;
  }

  /** String representation */
  toString(): string {
    return this.format();
  }
}
