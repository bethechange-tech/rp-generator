import { describe, it, expect } from "vitest";
import { Money } from "./Money";

describe("Money", () => {
  describe("given pence values", () => {
    it("treats 1500 pence as £15.00", () => {
      expect(Money.fromPence(1500).toPence()).toBe(1500);
      expect(Money.fromPence(1500).toPounds()).toBe(15);
    });

    it("converts 15.50 to 1550p (assumes it's pounds)", () => {
      expect(Money.fromPence(15.50).toPence()).toBe(1550);
    });
  });

  describe("given pound values", () => {
    it("converts £15.50 to 1550p", () => {
      expect(Money.fromPounds(15.50).toPence()).toBe(1550);
    });

    it("treats 1500 as already pence (large whole number)", () => {
      expect(Money.fromPounds(1500).toPence()).toBe(1500);
    });

    it("converts £50 to 5000p (small whole number)", () => {
      expect(Money.fromPounds(50).toPence()).toBe(5000);
    });
  });

  describe("parsing currency strings", () => {
    it("parses £25.50 as 2550p", () => {
      expect(Money.parse("£25.50").toPence()).toBe(2550);
    });

    it("parses $100.00 as 10000p", () => {
      expect(Money.parse("$100.00").toPence()).toBe(10000);
    });

    it("parses 15.99 as 1599p", () => {
      expect(Money.parse("15.99").toPence()).toBe(1599);
    });

    it("handles refunds like -£10.00", () => {
      expect(Money.parse("-£10.00").toPence()).toBe(-1000);
    });

    it("returns zero for rubbish input", () => {
      expect(Money.parse("invalid").toPence()).toBe(0);
    });
  });

  describe("arithmetic", () => {
    it("adds £10 + £5 = £15", () => {
      const tenner = Money.fromPounds(10);
      const fiver = Money.fromPounds(5);
      expect(tenner.add(fiver).toPounds()).toBe(15);
    });

    it("subtracts £10 - £3 = £7", () => {
      const tenner = Money.fromPounds(10);
      const three = Money.fromPounds(3);
      expect(tenner.subtract(three).toPounds()).toBe(7);
    });

    it("multiplies £10 × 3 = £30", () => {
      expect(Money.fromPounds(10).multiply(3).toPounds()).toBe(30);
    });

    it("divides £10 ÷ 2 = £5", () => {
      expect(Money.fromPounds(10).divide(2).toPounds()).toBe(5);
    });
  });

  describe("VAT calculations", () => {
    it("calculates 20% VAT on £100 = £20", () => {
      expect(Money.fromPounds(100).vat().toPounds()).toBe(20);
    });

    it("calculates 5% VAT on £100 = £5", () => {
      expect(Money.fromPounds(100).vat(5).toPounds()).toBe(5);
    });

    it("adds VAT: £100 net becomes £120 gross", () => {
      expect(Money.fromPounds(100).withVat().toPounds()).toBe(120);
    });

    it("removes VAT: £12 gross becomes £10 net", () => {
      expect(Money.fromPounds(12.00).withoutVat().toPounds()).toBe(10);
    });
  });

  describe("EV charging calculations", () => {
    it("calculates kWh: £15 at 30p/kWh = 50 kWh", () => {
      const totalCost = Money.fromPounds(15);
      const ratePerKwh = Money.fromPounds(0.30);
      expect(totalCost.toKwh(ratePerKwh)).toBe(50);
    });

    it("calculates cost: 50 kWh at 30p/kWh = £15", () => {
      const ratePerKwh = Money.fromPounds(0.30);
      const cost = Money.fromKwh(50, ratePerKwh);
      expect(cost.toPounds()).toBe(15);
    });

    it("returns 0 kWh when rate is zero (avoids division by zero)", () => {
      const cost = Money.fromPounds(15);
      expect(cost.toKwh(Money.fromPence(0))).toBe(0);
    });
  });

  describe("comparing amounts", () => {
    it("knows £10 is less than £20", () => {
      const tenner = Money.fromPounds(10);
      const twenty = Money.fromPounds(20);
      expect(tenner.isLessThan(twenty)).toBe(true);
    });

    it("knows £20 is greater than £10", () => {
      const tenner = Money.fromPounds(10);
      const twenty = Money.fromPounds(20);
      expect(twenty.isGreaterThan(tenner)).toBe(true);
    });

    it("knows two tenners are equal", () => {
      expect(Money.fromPounds(10).equals(Money.fromPounds(10))).toBe(true);
    });
  });

  describe("formatting for display", () => {
    it("formats £25.50 with pound sign", () => {
      expect(Money.fromPounds(25.50).format()).toBe("£25.50");
    });

    it("formats with dollar sign when specified", () => {
      expect(Money.fromPounds(25.50).format("$")).toBe("$25.50");
    });

    it("formats refunds with minus sign", () => {
      expect(Money.parse("-£10.00").format()).toBe("-£10.00");
    });
  });
});
