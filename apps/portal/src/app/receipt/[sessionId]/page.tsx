import Link from "next/link";
import { PdfViewer } from "@/components/PdfViewer";
import { DownloadButton } from "@/components/DownloadButton";

interface PageProps {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ pdf_key?: string }>;
}

export default async function ReceiptPage({ params, searchParams }: PageProps) {
  const { sessionId } = await params;
  const { pdf_key } = await searchParams;

  if (!pdf_key) {
    return (
      <div className="text-center py-8 sm:py-12 px-4">
        <p className="text-gray-500">No PDF key provided</p>
        <Link href="/" className="text-primary-500 hover:underline mt-2 inline-block">
          ← Back to receipts
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href="/"
            className="p-2 hover:bg-gray-100 rounded-lg transition shrink-0"
          >
            <svg
              className="w-5 h-5 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">Receipt Details</h1>
            <p className="text-xs sm:text-sm text-gray-500 truncate">Session: {decodeURIComponent(sessionId)}</p>
          </div>
        </div>

        <div className="ml-10 sm:ml-0">
          <DownloadButton pdfKey={pdf_key} />
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <PdfViewer pdfKey={pdf_key} />
      </div>
    </div>
  );
}
