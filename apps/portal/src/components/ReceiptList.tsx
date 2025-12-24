"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { ReceiptMetadata } from "@ev-receipt/core";
import { useReceipts } from "@/lib/hooks";
import { Card, LoadingState, ErrorState, EmptyState, DocumentIcon, ChevronRightIcon } from "./ui";

export function ReceiptList() {
  const searchParams = useSearchParams();
  const { data, loading } = useReceipts(searchParams.toString());

  if (loading) return <LoadingState message="Loading receipts..." />;
  if (!data?.success) return <ErrorState title="Error loading receipts" message={data?.error || "Unknown error"} />;
  if (data.data?.count === 0) {
    return <EmptyState title="No receipts found" message={`Scanned ${data.data.scanned_dates.length} days with no matching results`} />;
  }

  return (
    <Card className="overflow-hidden">
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
          <DocumentIcon className="w-5 h-5 text-primary-500" />
          Receipts
        </h2>
        <span className="text-xs sm:text-sm text-gray-500">
          {data.data?.count} found • {data.data?.scanned_dates.length} days scanned
        </span>
      </div>

      <div className="divide-y divide-gray-100">
        {data.data?.records.map((receipt) => (
          <ReceiptRow key={receipt.session_id} receipt={receipt} />
        ))}
      </div>
    </Card>
  );
}

function ReceiptRow({ receipt }: { receipt: ReceiptMetadata }) {
  const href = `/receipt/${encodeURIComponent(receipt.session_id)}?pdf_key=${encodeURIComponent(receipt.pdf_key)}`;

  return (
    <Link href={href} className="block px-4 sm:px-6 py-3 sm:py-4 hover:bg-gray-50 transition active:bg-gray-100">
      {/* Mobile Layout */}
      <div className="flex sm:hidden items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="bg-primary-50 p-2 rounded-lg shrink-0">
            <DocumentIcon className="w-5 h-5 text-primary-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900 truncate">{receipt.receipt_number}</p>
            <p className="text-xs text-gray-500 truncate">Session: {receipt.session_id}</p>
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
              <span>•••• {receipt.card_last_four}</span>
              <span>•</span>
              <span>{formatDate(receipt.payment_date)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-semibold text-gray-900 text-sm">{receipt.amount}</span>
          <ChevronRightIcon className="w-4 h-4 text-gray-400" />
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden sm:flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-primary-50 p-3 rounded-lg">
            <DocumentIcon className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">{receipt.receipt_number}</p>
            <p className="text-sm text-gray-500">Session: {receipt.session_id}</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="font-semibold text-gray-900">{receipt.amount}</p>
            <p className="text-sm text-gray-500">•••• {receipt.card_last_four}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-700">{formatDate(receipt.payment_date)}</p>
            <p className="text-sm text-gray-500">{receipt.consumer_id}</p>
          </div>
          <ChevronRightIcon className="w-5 h-5 text-gray-400" />
        </div>
      </div>
    </Link>
  );
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
