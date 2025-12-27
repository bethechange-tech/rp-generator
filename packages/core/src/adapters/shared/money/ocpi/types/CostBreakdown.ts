import type { Money } from "../../Money";

export interface CostBreakdown {
  energy: Money;
  time: Money;
  parking: Money;
  flat: Money;
  subtotal: Money;
  vat: Money;
  total: Money;
}
