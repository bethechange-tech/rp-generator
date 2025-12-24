import { NextRequest, NextResponse } from "next/server";
import { getQueryService } from "@/lib/s3";
import type { ReceiptQuery } from "@ev-receipt/core";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Build query from URL params
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

    // Pagination params
    const limit = searchParams.get("limit");
    if (limit) query.limit = parseInt(limit, 10);

    const cursor = searchParams.get("cursor");
    if (cursor) query.cursor = cursor;

    // Default to last 7 days if no date range provided
    if (!dateFrom && !dateTo) {
      const today = new Date();
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      query.date_from = weekAgo.toISOString().split("T")[0];
      query.date_to = today.toISOString().split("T")[0];
    }

    const queryService = getQueryService();
    const result = await queryService.query(query);

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error("Query error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to query receipts",
      },
      { status: 500 }
    );
  }
}
