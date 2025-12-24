"use client";

import { useSignedUrl } from "@/lib/hooks";
import { Spinner, Card, WarningIcon } from "./ui";

interface PdfViewerProps {
  pdfKey: string;
}

export function PdfViewer({ pdfKey }: PdfViewerProps) {
  const { url, loading, error } = useSignedUrl(pdfKey);

  if (loading) {
    return (
      <div className="p-8 sm:p-12 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <Spinner />
          <span className="text-sm sm:text-base">Generating secure link...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 sm:p-12 text-center">
        <div className="inline-flex flex-col items-center gap-3">
          <div className="bg-red-50 p-3 rounded-full">
            <WarningIcon className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <p className="font-medium text-gray-900">Failed to load PDF</p>
            <p className="text-sm text-gray-500 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <iframe
      src={url || ""}
      className="w-full h-[calc(100vh-200px)] sm:h-[calc(100vh-180px)] min-h-[400px] max-h-[800px] border-0"
      title="Receipt PDF"
    />
  );
}

