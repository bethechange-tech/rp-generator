export interface ReceiptData {
  receipt_number: string;
  payment_date: string;
  consumer_name?: string;
  card_last_four: string;
  amount: string;
  items?: Array<{ description: string; amount: string }>;
}

export interface ReceiptMetadata {
  session_id: string;
  consumer_id: string;
  receipt_number: string;
  payment_date: string;
  card_last_four: string;
  amount: string;
  amount_pence?: number;  // Numeric amount in pence for SQL filtering (optional for backward compat)
  pdf_key: string;
  metadata_key: string;
  created_at: string;
}

export interface ReceiptUploadResult {
  pdf_key: string;
  metadata_key: string;
  index_key: string;
}

export interface StorageConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export interface ReceiptQuery {
  session_id?: string;
  consumer_id?: string;
  card_last_four?: string;
  date_from?: string;
  date_to?: string;
  amount_min?: number;
  amount_max?: number;
  receipt_number?: string;
  limit?: number;
  cursor?: string;
}

export interface QueryResult {
  records: ReceiptMetadata[];
  scanned_dates: string[];
  total_count: number;
  next_cursor?: string;
  has_more: boolean;
  page_size: number;
}

export interface QueryServiceConfig extends StorageConfig {
  enableCache?: boolean;
  cacheSize?: number;
  cacheTtlSeconds?: number;
  maxConcurrency?: number;
}
