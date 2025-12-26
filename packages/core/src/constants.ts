import type { ReceiptQuery } from "./ports";

/** Primary searchable fields - at least one required to execute a query */
export const REQUIRED_FIELDS: (keyof ReceiptQuery)[] = [
  "session_id",
  "consumer_id", 
  "receipt_number",
  "date_from",
  "card_last_four",
];

/** Optional filter fields - enhance results but don't trigger search alone */
export const OPTIONAL_FIELDS: (keyof ReceiptQuery)[] = [
  "date_to",
  "amount_min",
  "amount_max",
  "limit",
  "cursor",
];
