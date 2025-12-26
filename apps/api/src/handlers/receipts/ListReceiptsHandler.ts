import { Request, Response } from "express";
import type { ReceiptQuery } from "@ev-receipt/core";
import { QueryServiceFactory } from "../../config";
import type { ListReceiptsResponse } from "./types";

export class ListReceiptsHandler {
  static parseQuery(req: Request): ReceiptQuery {
    return {
      session_id: req.query.session_id as string | undefined,
      consumer_id: req.query.consumer_id as string | undefined,
      card_last_four: req.query.card_last_four as string | undefined,
      receipt_number: req.query.receipt_number as string | undefined,
      date_from: req.query.date_from as string | undefined,
      date_to: req.query.date_to as string | undefined,
      amount_min: req.query.amount_min
        ? parseFloat(req.query.amount_min as string)
        : undefined,
      amount_max: req.query.amount_max
        ? parseFloat(req.query.amount_max as string)
        : undefined,
      limit: req.query.limit
        ? parseInt(req.query.limit as string, 10)
        : undefined,
      cursor: req.query.cursor as string | undefined,
    };
  }

  static buildResponse(result: {
    records: unknown[];
    total_count: number;
    page_size: number;
    has_more: boolean;
    next_cursor?: string;
    scanned_dates: string[];
  }): ListReceiptsResponse {
    return {
      success: true,
      data: {
        records: result.records,
        pagination: {
          total_count: result.total_count,
          page_size: result.page_size,
          has_more: result.has_more,
          next_cursor: result.next_cursor,
        },
        scanned_dates: result.scanned_dates,
      },
    };
  }

  static async handle(req: Request, res: Response): Promise<void> {
    const query = this.parseQuery(req);
    const result = await QueryServiceFactory.get().query(query);
    const response = this.buildResponse(result);

    res.json(response);
  }
}
