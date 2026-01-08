import { describe, it, expect } from "vitest";
import { DateRange } from "./DateRange";

describe("DateRange", () => {
  describe("default behavior", () => {
    it("defaults to 365 days ending today when no params given", () => {
      const range = DateRange.from();
      expect(range.days).toBe(366);
    });

    it("uses provided date range", () => {
      const range = DateRange.from("2025-01-01", "2025-01-10");
      expect(range.days).toBe(10);
      expect(range.toArray()).toHaveLength(10);
      expect(range.toArray()[0]).toBe("2025-01-01");
      expect(range.toArray()[9]).toBe("2025-01-10");
    });
  });

  describe("max 1-year limit", () => {
    it("clamps start date when range exceeds 365 days", () => {
      const range = DateRange.from("2020-01-01", "2025-12-31");
      expect(range.days).toBeLessThanOrEqual(366);
    });

    it("allows exactly 365 days", () => {
      const range = DateRange.from("2025-01-01", "2025-12-31");
      expect(range.days).toBe(365);
    });

    it("allows ranges under 365 days", () => {
      const range = DateRange.from("2025-06-01", "2025-12-31");
      expect(range.days).toBe(214);
    });

    it("clamps 2-year range to 1 year", () => {
      const range = DateRange.from("2024-01-01", "2025-12-31");
      const dates = range.toArray();
      expect(dates.length).toBeLessThanOrEqual(366);
      expect(dates[dates.length - 1]).toBe("2025-12-31");
    });

    it("preserves end date when clamping", () => {
      const range = DateRange.from("2020-01-01", "2025-06-15");
      const dates = range.toArray();
      expect(dates[dates.length - 1]).toBe("2025-06-15");
    });
  });

  describe("toArray", () => {
    it("returns consecutive dates", () => {
      const range = DateRange.from("2025-12-24", "2025-12-26");
      expect(range.toArray()).toEqual(["2025-12-24", "2025-12-25", "2025-12-26"]);
    });
  });
});
