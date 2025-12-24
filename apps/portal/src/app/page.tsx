import { ReceiptSearch } from "@/components/ReceiptSearch";
import { ReceiptList } from "@/components/ReceiptList";
import { Suspense } from "react";

export default function HomePage() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <Suspense fallback={<SearchSkeleton />}>
        <ReceiptSearch />
      </Suspense>
      <Suspense fallback={<ListSkeleton />}>
        <ReceiptList />
      </Suspense>
    </div>
  );
}

function SearchSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <div className="h-10 bg-gray-200 rounded"></div>
        <div className="h-10 bg-gray-200 rounded"></div>
        <div className="h-10 bg-gray-200 rounded"></div>
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 animate-pulse">
      <div className="space-y-3 sm:space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 sm:h-20 bg-gray-200 rounded"></div>
        ))}
      </div>
    </div>
  );
}
