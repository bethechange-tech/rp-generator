import { describe, it, expect } from "vitest";
import { IndexKey } from "./IndexKey";

describe("IndexKey", () => {
  describe("creating keys from dates", () => {
    it("builds S3 path from date string", () => {
      const key = IndexKey.fromDate("2025-12-26");

      expect(key.key).toBe("index/dt=2025-12-26/index.ndjson");
      expect(key.date).toBe("2025-12-26");
    });

    it("converts to string for S3 operations", () => {
      const key = IndexKey.fromDate("2025-12-25");

      expect(key.toString()).toBe("index/dt=2025-12-25/index.ndjson");
    });
  });

  describe("parsing dates from keys", () => {
    it("extracts date from valid S3 key", () => {
      const date = IndexKey.parseDate("index/dt=2025-12-26/index.ndjson");

      expect(date).toBe("2025-12-26");
    });

    it("returns null for keys with wrong prefix", () => {
      const date = IndexKey.parseDate("receipts/dt=2025-12-26/index.ndjson");

      expect(date).toBeNull();
    });

    it("returns null for keys with wrong suffix", () => {
      const date = IndexKey.parseDate("index/dt=2025-12-26/data.json");

      expect(date).toBeNull();
    });

    it("returns null for completely invalid keys", () => {
      expect(IndexKey.parseDate("random-file.txt")).toBeNull();
      expect(IndexKey.parseDate("")).toBeNull();
    });
  });

  describe("round-trip conversion", () => {
    it("can create a key and parse it back to the original date", () => {
      const originalDate = "2025-12-24";
      const key = IndexKey.fromDate(originalDate);
      const parsedDate = IndexKey.parseDate(key.toString());

      expect(parsedDate).toBe(originalDate);
    });
  });
});
