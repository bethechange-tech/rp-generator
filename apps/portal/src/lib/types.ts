import type { ReceiptMetadata } from "@ev-receipt/core";

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface QueryData {
  records: ReceiptMetadata[];
  scanned_dates: string[];
  count: number;
}

export interface SignedUrlData {
  url: string;
  expires_in: number;
  pdf_key: string;
}

// Re-export for convenience
export type { ReceiptMetadata };
