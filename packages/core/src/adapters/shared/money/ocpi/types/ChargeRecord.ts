import type { ChargingPeriod } from "./ChargingPeriod";

export interface ChargeRecord {
  start_date_time: string;
  end_date_time: string;
  kwh?: number;
  charging_periods: ChargingPeriod[];
  total_cost?: number;
  total_energy?: number;
  total_time?: number;
  total_parking_time?: number;
}
