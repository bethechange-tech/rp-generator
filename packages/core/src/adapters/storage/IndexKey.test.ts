import { describe, it, expect } from "vitest";
import { IndexKey } from "./IndexKey";

describe("IndexKey", () => {
  describe("creating keys from dates", () => {
    it("builds S3 prefix from date string", () => {
      const key = IndexKey.fromDate("2025-12-26");

      expect(key.prefix).toBe("index/dt=2025-12-26/");
      expect(key.date).toBe("2025-12-26");
    });

    it("converts to prefix string for S3 list operations", () => {
      const key = IndexKey.fromDate("2025-12-25");

      expect(key.toString()).toBe("index/dt=2025-12-25/");
    });
  });

  describe("parsing dates from keys", () => {
    it("extracts date from sharded part file key with hour", () => {
      const date = IndexKey.parseDate("index/dt=2025-12-26/hr=14/shard=34/part-abc123.ndjson.gz");

      expect(date).toBe("2025-12-26");
    });

    it("returns null for keys with wrong prefix", () => {
      const date = IndexKey.parseDate("receipts/dt=2025-12-26/hr=14/shard=34/part-abc.ndjson.gz");

      expect(date).toBeNull();
    });

    it("returns null for completely invalid keys", () => {
      expect(IndexKey.parseDate("random-file.txt")).toBeNull();
      expect(IndexKey.parseDate("")).toBeNull();
    });
  });

  describe("isPartFile", () => {
    it("recognizes valid part files with hour and shard", () => {
      expect(IndexKey.isPartFile("index/dt=2025-12-26/hr=14/shard=34/part-abc123.ndjson.gz")).toBe(true);
    });

    it("rejects non-part files", () => {
      expect(IndexKey.isPartFile("index/dt=2025-12-26/hr=14/shard=34/data.json")).toBe(false);
      expect(IndexKey.isPartFile("index/dt=2025-12-26/index.ndjson")).toBe(false);
    });
  });

  describe("getShard", () => {
    it("calculates shard from card_last_four", () => {
      expect(IndexKey.getShard("1234")).toBe("34"); // 1234 % 100 = 34
      expect(IndexKey.getShard("5000")).toBe("00"); // 5000 % 100 = 0
      expect(IndexKey.getShard("9999")).toBe("99"); // 9999 % 100 = 99
    });
  });
});
