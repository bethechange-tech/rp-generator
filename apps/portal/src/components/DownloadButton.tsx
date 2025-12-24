"use client";

import { useDownload } from "@/lib/hooks";
import { DownloadIcon, Spinner } from "./ui";

interface DownloadButtonProps {
  pdfKey: string;
}

export function DownloadButton({ pdfKey }: DownloadButtonProps) {
  const { download, loading } = useDownload(pdfKey);

  return (
    <button
      onClick={download}
      disabled={loading}
      className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 active:bg-primary-700 transition font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
    >
      {loading ? (
        <>
          <Spinner className="h-4 w-4" />
          <span className="hidden sm:inline">Preparing...</span>
          <span className="sm:hidden">Loading...</span>
        </>
      ) : (
        <>
          <DownloadIcon />
          <span className="hidden sm:inline">Download PDF</span>
          <span className="sm:hidden">Download</span>
        </>
      )}
    </button>
  );
}
