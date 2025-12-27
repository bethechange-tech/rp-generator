import type { CostBreakdown } from "../types";

export interface CostFormatter {
  format(breakdown: CostBreakdown, symbol?: string): Record<string, string>;
}
