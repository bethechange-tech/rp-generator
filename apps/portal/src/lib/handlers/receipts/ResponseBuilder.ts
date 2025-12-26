import type { QueryResult } from "@ev-receipt/core";

export interface ReceiptsSuccessResponse {
  success: true;
  data: {
    records: QueryResult["records"];
    scanned_dates: QueryResult["scanned_dates"];
    pagination: {
      total_count: number;
      page_size: number;
      has_more: boolean;
      next_cursor?: string;
    };
  };
}

export interface ReceiptsErrorResponse {
  success: false;
  error: string;
}

export type ReceiptsResponse = ReceiptsSuccessResponse | ReceiptsErrorResponse;

export class ResponseBuilder {
  static success(result: QueryResult): ReceiptsSuccessResponse {
    return {
      success: true,
      data: {
        records: result.records,
        scanned_dates: result.scanned_dates,
        pagination: {
          total_count: result.total_count,
          page_size: result.page_size,
          has_more: result.has_more,
          next_cursor: result.next_cursor,
        },
      },
    };
  }

  static error(error: unknown): ReceiptsErrorResponse {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to query receipts",
    };
  }
}
