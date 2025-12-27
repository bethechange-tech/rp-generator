import type { ChargeRecord, CostBreakdown, Tariff } from "../types";

export interface CostCalculator {
  calculate(record: ChargeRecord, tariff: Tariff): CostBreakdown;
}
