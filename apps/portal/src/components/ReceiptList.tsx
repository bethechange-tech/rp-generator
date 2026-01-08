"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { ReceiptMetadata } from "@ev-receipt/core";
import { useReceipts } from "@/lib/hooks";
import { Card, LoadingState, ErrorState, EmptyState, DocumentIcon, ChevronRightIcon, Spinner, SearchIcon } from "./ui";

export function ReceiptList() {
  const searchParams = useSearchParams();
  const { data, loading, loadMore, loadingMore, hasSearchCriteria } = useReceipts(searchParams.toString());

  if (!hasSearchCriteria) {
    return (
      <Card className="p-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="bg-gray-100 p-4 rounded-full">
            <SearchIcon className="w-8 h-8 text-gray-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Enter search criteria</h3>
            <p className="text-sm text-gray-500 mt-1">Use the search form above to find receipts</p>
          </div>
        </div>
      </Card>
    );
  }

  if (loading) return <LoadingState message="Loading receipts..." />;
  if (!data?.success) return <ErrorState title="Error loading receipts" message={data?.error || "Unknown error"} />;
  if (data.data?.records.length === 0) {
    return <EmptyState title="No receipts found" message={`Scanned ${data.data.pagination.total_count === 0 ? data.data.scanned_dates.length : 0} days with no matching results`} />;
  }

  const { records, pagination, scanned_dates } = data.data!;

  return (
    <Card className="overflow-hidden">
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
          <DocumentIcon className="w-5 h-5 text-primary-500" />
          Receipts
        </h2>
        <span className="text-xs sm:text-sm text-gray-500">
          Showing {records.length} of {pagination.total_count} • {scanned_dates.length} days scanned
        </span>
      </div>

      <div className="divide-y divide-gray-100">
        {records.map((receipt, idx) => (
          <ReceiptRow key={`${receipt.session_id}-${idx}`} receipt={receipt} />
        ))}
      </div>

      {/* Pagination Footer */}
      {pagination.has_more && (
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="w-full sm:w-auto px-6 py-2.5 sm:py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 active:bg-primary-700 transition font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingMore ? (
              <>
                <Spinner className="h-4 w-4" />
                Loading...
              </>
            ) : (
              <>
                Load More
                <span className="text-primary-200 text-sm">
                  ({pagination.total_count - records.length} remaining)
                </span>
              </>
            )}
          </button>
        </div>
      )}
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
            <div className="flex items-center gap-2">
              <p className="font-semibold text-gray-900 truncate">{receipt.receipt_number}</p>
              <AgeBadge date={receipt.payment_date} />
            </div>
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
            <div className="flex items-center gap-2">
              <p className="font-semibold text-gray-900">{receipt.receipt_number}</p>
              <AgeBadge date={receipt.payment_date} />
            </div>
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

function getAgeBadge(dateString: string): { label: string; className: string } | null {
  const receiptDate = new Date(dateString);
  const today = new Date();
  const diffDays = Math.floor((today.getTime() - receiptDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    // Future date
    return { label: "Upcoming", className: "bg-blue-100 text-blue-700" };
  }
  if (diffDays <= 7) {
    return { label: "Recent", className: "bg-green-100 text-green-700" };
  }
  if (receiptDate.getMonth() === today.getMonth() && receiptDate.getFullYear() === today.getFullYear()) {
    return { label: "This month", className: "bg-yellow-100 text-yellow-700" };
  }
  return null; // No badge for older receipts
}

function AgeBadge({ date }: { date: string }) {
  const badge = getAgeBadge(date);
  if (!badge) return null;
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${badge.className}`}>
      {badge.label}
    </span>
  );
}
