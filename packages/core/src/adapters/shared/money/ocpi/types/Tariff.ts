import type { TariffElement } from "./TariffElement";

export interface Tariff {
  currency: string;
  elements: TariffElement[];
}
