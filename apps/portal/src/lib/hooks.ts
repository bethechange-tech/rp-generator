import { useState, useEffect, useCallback } from "react";
import api from "./api";
import type { ApiResponse, QueryData, SignedUrlData } from "./types";

/**
 * Hook for fetching receipts based on search params
 */
export function useReceipts(searchParams: string) {
  const [data, setData] = useState<ApiResponse<QueryData> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      setLoading(true);
      try {
        const response = await api.get<ApiResponse<QueryData>>(`/receipts?${searchParams}`);
        if (!cancelled) setData(response.data);
      } catch (error) {
        if (!cancelled) {
          setData({
            success: false,
            error: error instanceof Error ? error.message : "Failed to fetch",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, [searchParams]);

  return { data, loading };
}

/**
 * Hook for fetching signed PDF URL
 */
export function useSignedUrl(pdfKey: string) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      setLoading(true);
      setError(null);

      try {
        const response = await api.get<ApiResponse<SignedUrlData>>(`/signed-url`, {
          params: { key: pdfKey },
        });

        if (!response.data.success || !response.data.data?.url) {
          throw new Error(response.data.error || "Failed to get signed URL");
        }

        if (!cancelled) setUrl(response.data.data.url);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load PDF");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, [pdfKey]);

  return { url, loading, error };
}

/**
 * Hook for downloading PDF with signed URL
 */
export function useDownload(pdfKey: string) {
  const [loading, setLoading] = useState(false);

  const download = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<ApiResponse<SignedUrlData>>(`/signed-url`, {
        params: { key: pdfKey },
      });

      if (!response.data.success || !response.data.data?.url) {
        throw new Error(response.data.error || "Failed to get download link");
      }

      // Trigger download
      const link = document.createElement("a");
      link.href = response.data.data.url;
      link.download = pdfKey.split("/").pop() || "receipt.pdf";
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      alert("Failed to download PDF. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [pdfKey]);

  return { download, loading };
}
