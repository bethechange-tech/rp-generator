import { useState, useCallback } from "react";
import { ApiClientFactory } from "../api";
import type { ApiResponse, SignedUrlData } from "../types";

export function useDownload(pdfKey: string) {
  const [loading, setLoading] = useState(false);

  const download = useCallback(async () => {
    setLoading(true);
    try {
      const response = await ApiClientFactory.get().get<ApiResponse<SignedUrlData>>(
        `/signed-url`,
        { params: { key: pdfKey } }
      );

      if (!response.data.success || !response.data.data?.url) {
        throw new Error(response.data.error || "Failed to get download link");
      }

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
