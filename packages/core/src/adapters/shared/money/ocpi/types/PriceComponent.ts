import type { TariffDimensionType } from "./TariffDimensionType";

export interface PriceComponent {
  type: TariffDimensionType;
  price: number;
  step_size: number;
  vat?: number;
}
