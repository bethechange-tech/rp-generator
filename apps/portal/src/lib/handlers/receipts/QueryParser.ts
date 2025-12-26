import { NextRequest } from "next/server";
import type { ReceiptQuery } from "@ev-receipt/core";

export class QueryParser {
  static parse(request: NextRequest): ReceiptQuery {
    const searchParams = request.nextUrl.searchParams;
    const query: ReceiptQuery = {};

    const sessionId = searchParams.get("session_id");
    if (sessionId) query.session_id = sessionId;

    const consumerId = searchParams.get("consumer_id");
    if (consumerId) query.consumer_id = consumerId;

    const cardLastFour = searchParams.get("card_last_four");
    if (cardLastFour) query.card_last_four = cardLastFour;

    const receiptNumber = searchParams.get("receipt_number");
    if (receiptNumber) query.receipt_number = receiptNumber;

    const dateFrom = searchParams.get("date_from");
    if (dateFrom) query.date_from = dateFrom;

    const dateTo = searchParams.get("date_to");
    if (dateTo) query.date_to = dateTo;

    const amountMin = searchParams.get("amount_min");
    if (amountMin) query.amount_min = parseFloat(amountMin);

    const amountMax = searchParams.get("amount_max");
    if (amountMax) query.amount_max = parseFloat(amountMax);

    const limit = searchParams.get("limit");
    if (limit) query.limit = parseInt(limit, 10);

    const cursor = searchParams.get("cursor");
    if (cursor) query.cursor = cursor;

    return query;
  }

  static applyDefaults(query: ReceiptQuery): ReceiptQuery {
    return query;
  }
}
