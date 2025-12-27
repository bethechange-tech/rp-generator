import type { PriceComponent } from "./PriceComponent";
import type { TariffRestriction } from "./TariffRestriction";

export interface TariffElement {
  price_components: PriceComponent[];
  restrictions?: TariffRestriction;
}
