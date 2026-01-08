import { useState, useEffect, useCallback } from "react";
import { REQUIRED_FIELDS } from "@ev-receipt/core/constants";
import { ApiClientFactory } from "../api";
import type { ApiResponse, QueryData } from "../types";

export function useReceipts(searchParams: string) {
  const [data, setData] = useState<ApiResponse<QueryData> | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

 
  const params = new URLSearchParams(searchParams);
  const hasSearchCriteria = REQUIRED_FIELDS.some((field) => {
    const value = params.get(field);
    return value !== null && value !== "";
  });

  useEffect(() => {
   
    if (!hasSearchCriteria) {
      setData(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetch() {
      setLoading(true);
      try {
        const response = await ApiClientFactory.get().get<ApiResponse<QueryData>>(
          `/receipts?${searchParams}`
        );
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
    return () => {
      cancelled = true;
    };
  }, [searchParams, hasSearchCriteria]);

  const loadMore = useCallback(async () => {
    if (!data?.data?.pagination.next_cursor || loadingMore) return;

    setLoadingMore(true);
    try {
      const cursor = encodeURIComponent(data.data.pagination.next_cursor);
      const separator = searchParams ? "&" : "";
      const response = await ApiClientFactory.get().get<ApiResponse<QueryData>>(
        `/receipts?${searchParams}${separator}cursor=${cursor}`
      );

      if (response.data.success && response.data.data) {
        setData((prev) => {
          if (!prev?.data) return response.data;
          return {
            ...response.data,
            data: {
              ...response.data.data!,
              records: [...prev.data.records, ...response.data.data!.records],
            },
          };
        });
      }
    } catch (error) {
      console.error("Failed to load more:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [data?.data?.pagination.next_cursor, searchParams, loadingMore]);

  return { data, loading, loadMore, loadingMore, hasSearchCriteria };
}
