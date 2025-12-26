import { useState, useEffect } from "react";
import { ApiClientFactory } from "../api";
import type { ApiResponse, SignedUrlData } from "../types";

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
        const response = await ApiClientFactory.get().get<ApiResponse<SignedUrlData>>(
          `/signed-url`,
          { params: { key: pdfKey } }
        );

        if (!response.data.success || !response.data.data?.url) {
          throw new Error(response.data.error || "Failed to get signed URL");
        }

        if (!cancelled) setUrl(response.data.data.url);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load PDF");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch();
    return () => {
      cancelled = true;
    };
  }, [pdfKey]);

  return { url, loading, error };
}
