import Decimal from "decimal.js";

/**
 * Utility class for handling monetary values with precision.
 * Uses decimal.js to avoid floating point issues.
 * Stores amounts in pence (smallest currency unit).
 */
export class Money {
  private readonly pence: Decimal;

  private constructor(pence: Decimal) {
    this.pence = pence.round();
  }

  /**
   * Create Money from pence.
   * Auto-detects: if value has decimals, assumes it's pounds and converts.
   */
  static fromPence(pence: number): Money {
    const value = new Decimal(pence);
    if (!value.isInteger()) {
      return new Money(value.times(100));
    }
    return new Money(value);
  }

  /**
   * Create Money from pounds.
   * Auto-detects: if value > 100 and is a whole number, assumes it's already pence.
   */
  static fromPounds(pounds: number): Money {
    const value = new Decimal(pounds);
    if (value.isInteger() && value.abs().greaterThan(100)) {
      return new Money(value);
    }
    return new Money(value.times(100));
  }

  /**
   * Parse a currency string (e.g., "£25.50", "$100.00", "25.50")
   * Strips currency symbols and converts to pence
   */
  static parse(amount: string): Money {
    const cleaned = amount.replace(/[^0-9.,-]/g, "");
    const isNegative = amount.includes("-") || cleaned.startsWith("-");
    
    try {
      const numericValue = new Decimal(cleaned.replace("-", "") || "0");
      const pence = numericValue.times(100);
      return new Money(isNegative ? pence.negated() : pence);
    } catch {
      return new Money(new Decimal(0));
    }
  }

  /** Get value in pence (integer) */
  toPence(): number {
    return this.pence.toNumber();
  }

  /** Get value in pounds (decimal) */
  toPounds(): number {
    return this.pence.dividedBy(100).toNumber();
  }

  /** Format as currency string with symbol */
  format(symbol: string = "£"): string {
    const pounds = this.pence.abs().dividedBy(100);
    const formatted = pounds.toFixed(2);
    return this.pence.isNegative() ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
  }

  /** Add two Money values */
  add(other: Money): Money {
    return new Money(this.pence.plus(other.pence));
  }

  /** Subtract Money value */
  subtract(other: Money): Money {
    return new Money(this.pence.minus(other.pence));
  }

  /** Multiply by a factor */
  multiply(factor: number): Money {
    return new Money(this.pence.times(factor));
  }

  /** Divide by a factor */
  divide(factor: number): Money {
    return new Money(this.pence.dividedBy(factor));
  }

  /** Calculate VAT amount (default 20%) */
  vat(rate: number = 20): Money {
    return new Money(this.pence.times(rate).dividedBy(100));
  }

  /** Add VAT to this amount (default 20%) */
  withVat(rate: number = 20): Money {
    return this.add(this.vat(rate));
  }

  /** Get net amount (remove VAT from gross, default 20%) */
  withoutVat(rate: number = 20): Money {
    return new Money(this.pence.times(100).dividedBy(100 + rate));
  }

  /** Calculate kWh from cost and rate per kWh */
  toKwh(ratePerKwh: Money): number {
    if (ratePerKwh.isZero()) return 0;
    return this.pence.dividedBy(ratePerKwh.pence).toDecimalPlaces(3).toNumber();
  }

  /** Calculate cost from kWh and rate per kWh */
  static fromKwh(kwh: number, ratePerKwh: Money): Money {
    return ratePerKwh.multiply(kwh);
  }

  /** Check if equal to another Money value */
  equals(other: Money): boolean {
    return this.pence.equals(other.pence);
  }

  /** Check if greater than another Money value */
  isGreaterThan(other: Money): boolean {
    return this.pence.greaterThan(other.pence);
  }

  /** Check if less than another Money value */
  isLessThan(other: Money): boolean {
    return this.pence.lessThan(other.pence);
  }

  /** Check if greater than or equal to another Money value */
  isGreaterThanOrEqual(other: Money): boolean {
    return this.pence.greaterThanOrEqualTo(other.pence);
  }

  /** Check if less than or equal to another Money value */
  isLessThanOrEqual(other: Money): boolean {
    return this.pence.lessThanOrEqualTo(other.pence);
  }

  /** Check if zero */
  isZero(): boolean {
    return this.pence.isZero();
  }

  /** Check if positive */
  isPositive(): boolean {
    return this.pence.isPositive() && !this.pence.isZero();
  }

  /** Check if negative */
  isNegative(): boolean {
    return this.pence.isNegative();
  }

  /** String representation */
  toString(): string {
    return this.format();
  }
}
