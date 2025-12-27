import type { TariffDimensionType } from "./TariffDimensionType";

export interface ChargingPeriodDimension {
  type: TariffDimensionType;
  volume: number;
}

export interface ChargingPeriod {
  start_date_time: string;
  dimensions: ChargingPeriodDimension[];
}
