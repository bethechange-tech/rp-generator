import { describe, it, expect, vi } from "vitest";
import { ParallelScanner } from "./ParallelScanner";

describe("ParallelScanner", () => {
  describe("scanning items in parallel", () => {
    it("processes all items and returns results", async () => {
      const scanner = new ParallelScanner<number>(3);
      const items = [1, 2, 3, 4, 5];

      const results = await scanner.scan(items, async (n) => n * 2);

      expect(results).toEqual([2, 4, 6, 8, 10]);
    });

    it("handles empty arrays without errors", async () => {
      const scanner = new ParallelScanner<string>();

      const results = await scanner.scan([], async (s) => s.toUpperCase());

      expect(results).toEqual([]);
    });

    it("processes items in batches of specified concurrency", async () => {
      const scanner = new ParallelScanner<number>(2);
      const callOrder: number[] = [];

      await scanner.scan([1, 2, 3, 4], async (n) => {
        callOrder.push(n);
        return n;
      });

      // First batch [1,2] then [3,4]
      expect(callOrder).toEqual([1, 2, 3, 4]);
    });

    it("respects custom batch size over default concurrency", async () => {
      const scanner = new ParallelScanner<number>(10);
      const handler = vi.fn().mockResolvedValue("done");

      await scanner.scan([1, 2, 3, 4, 5, 6], handler, 2);

      // 6 items with batch size 2 = 3 batches
      expect(handler).toHaveBeenCalledTimes(6);
    });
  });

  describe("scanning and flattening results", () => {
    it("flattens array results from each item", async () => {
      const scanner = new ParallelScanner<string>(2);
      const items = ["ab", "cd"];

      const results = await scanner.scanAndFlatten(items, async (s) => s.split(""));

      expect(results).toEqual(["a", "b", "c", "d"]);
    });

    it("handles items that return empty arrays", async () => {
      const scanner = new ParallelScanner<number>(3);

      const results = await scanner.scanAndFlatten([1, 2, 3], async (n) =>
        n === 2 ? [] : [n]
      );

      expect(results).toEqual([1, 3]);
    });

    it("works like scanning dates to find receipts", async () => {
      const scanner = new ParallelScanner<string>(5);
      const mockReceipts: Record<string, string[]> = {
        "2025-12-24": ["receipt-1", "receipt-2"],
        "2025-12-25": ["receipt-3"],
        "2025-12-26": [],
      };

      const results = await scanner.scanAndFlatten(
        Object.keys(mockReceipts),
        async (date) => mockReceipts[date]
      );

      expect(results).toEqual(["receipt-1", "receipt-2", "receipt-3"]);
    });
  });

  describe("error handling", () => {
    it("propagates errors from failed handlers", async () => {
      const scanner = new ParallelScanner<number>(2);

      await expect(
        scanner.scan([1, 2, 3], async (n) => {
          if (n === 2) throw new Error("Blew up on 2");
          return n;
        })
      ).rejects.toThrow("Blew up on 2");
    });
  });

  describe("concurrency defaults", () => {
    it("defaults to 5 concurrent tasks", async () => {
      const scanner = new ParallelScanner<number>();
      let maxConcurrent = 0;
      let currentConcurrent = 0;

      await scanner.scan([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], async (n) => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        await new Promise((r) => setTimeout(r, 10));
        currentConcurrent--;
        return n;
      });

      expect(maxConcurrent).toBe(5);
    });
  });
});
