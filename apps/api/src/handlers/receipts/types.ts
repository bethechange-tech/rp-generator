import type { ReceiptData } from "@ev-receipt/core";

export interface CreateReceiptBody {
  session_id: string;
  consumer_id: string;
  company_ref?: string;
  receipt: Partial<ReceiptData> &
    Omit<
      ReceiptData,
      | "company_name"
      | "company_tagline"
      | "company_logo_svg"
      | "company_website"
      | "support_email"
      | "support_phone"
    >;
}

export interface ListReceiptsResponse {
  success: true;
  data: {
    records: unknown[];
    pagination: {
      total_count: number;
      page_size: number;
      has_more: boolean;
      next_cursor?: string;
    };
    scanned_dates: string[];
  };
}

export interface CreateReceiptResponse {
  success: true;
  data: {
    session_id: string;
    pdf_key: string;
    metadata_key: string;
    index_key: string;
    signed_url: string;
  };
}

export interface GetReceiptUrlResponse {
  success: true;
  data: {
    url: string;
    expires_in: number;
  };
}
