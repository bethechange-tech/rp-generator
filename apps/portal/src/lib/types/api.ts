import type { ReceiptMetadata } from "@ev-receipt/core";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginationInfo {
  total_count: number;
  page_size: number;
  has_more: boolean;
  next_cursor?: string;
}

export interface QueryData {
  records: ReceiptMetadata[];
  scanned_dates: string[];
  pagination: PaginationInfo;
}

export interface SignedUrlData {
  url: string;
  expires_in: number;
  pdf_key: string;
}

export type { ReceiptMetadata };
