import * as sql from "sql-bricks";
import { filter } from "lodash";
import { ReceiptQuery, ReceiptMetadata } from "../../ports";
import { Money } from "../shared";
import { REQUIRED_FIELDS, OPTIONAL_FIELDS } from "../../constants";

export { REQUIRED_FIELDS, OPTIONAL_FIELDS };

/** Handles query filtering logic for receipts */
export class QueryFilter {
  /** Get the list of required search fields */
  static get requiredFields(): (keyof ReceiptQuery)[] {
    return [...REQUIRED_FIELDS];
  }

  /** Get the list of optional filter fields */
  static get optionalFields(): (keyof ReceiptQuery)[] {
    return [...OPTIONAL_FIELDS];
  }

  /** Check if query has at least one required search field */
  static hasSearchCriteria(query: ReceiptQuery): boolean {
    return REQUIRED_FIELDS.some((field) => {
      const value = query[field];
      return value !== undefined && value !== null && value !== "";
    });
  }

  /** Get which required fields are present in the query */
  static getProvidedRequiredFields(query: ReceiptQuery): (keyof ReceiptQuery)[] {
    return REQUIRED_FIELDS.filter((field) => {
      const value = query[field];
      return value !== undefined && value !== null && value !== "";
    });
  }

  /** Get which optional fields are present in the query */
  static getProvidedOptionalFields(query: ReceiptQuery): (keyof ReceiptQuery)[] {
    return OPTIONAL_FIELDS.filter((field) => {
      const value = query[field];
      return value !== undefined && value !== null && value !== "";
    });
  }

  /** Build SQL query for S3 Select */
  static buildSql(query: ReceiptQuery): string {
    let builder = sql.select("*").from("s3object s");

    if (query.session_id) builder = builder.where("s.session_id", query.session_id);
    if (query.consumer_id) builder = builder.where("s.consumer_id", query.consumer_id);
    if (query.card_last_four) builder = builder.where("s.card_last_four", query.card_last_four);
    if (query.receipt_number) builder = builder.where("s.receipt_number", query.receipt_number);

    // Amount filtering in pence (amount_min/amount_max are in pounds, convert to pence)
    if (query.amount_min !== undefined) {
      const minPence = Money.fromPounds(query.amount_min).toPence();
      builder = builder.where(sql.gte("s.amount_pence", minPence));
    }
    if (query.amount_max !== undefined) {
      const maxPence = Money.fromPounds(query.amount_max).toPence();
      builder = builder.where(sql.lte("s.amount_pence", maxPence));
    }

    return builder.toString();
  }

  /** Filter records in-memory (client-side fallback) */
  static filterRecords(records: ReceiptMetadata[], query: ReceiptQuery): ReceiptMetadata[] {
    return filter(records, (record) => this.matches(record, query));
  }

  /** Check if a single record matches the query */
  static matches(record: ReceiptMetadata, query: ReceiptQuery): boolean {
    if (query.session_id && record.session_id !== query.session_id) return false;
    if (query.consumer_id && record.consumer_id !== query.consumer_id) return false;
    if (query.card_last_four && record.card_last_four !== query.card_last_four) return false;
    if (query.receipt_number && record.receipt_number !== query.receipt_number) return false;

    if (query.amount_min !== undefined || query.amount_max !== undefined) {
      // Use amount_pence if available (new records), fallback to parsing amount string (old records)
      const amountPence = record.amount_pence ?? Money.parse(record.amount).toPence();
      const minPence = query.amount_min !== undefined ? Money.fromPounds(query.amount_min).toPence() : undefined;
      const maxPence = query.amount_max !== undefined ? Money.fromPounds(query.amount_max).toPence() : undefined;
      if (minPence !== undefined && amountPence < minPence) return false;
      if (maxPence !== undefined && amountPence > maxPence) return false;
    }

    return true;
  }
}
