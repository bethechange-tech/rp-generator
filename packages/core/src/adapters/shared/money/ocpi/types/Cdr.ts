import type { ChargingPeriod } from "./ChargingPeriod";
import type { Tariff } from "./Tariff";

export interface CdrToken {
  uid: string;
  type: string;
  contract_id: string;
}

export interface CdrLocation {
  id: string;
  name?: string;
  address: string;
  city: string;
  postal_code?: string;
  country: string;
  coordinates?: {
    latitude: string;
    longitude: string;
  };
  evse_uid?: string;
  connector_id?: string;
}

export interface Cdr {
  id: string;
  start_date_time: string;
  end_date_time: string;
  auth_id?: string;
  auth_method?: string;
  token?: CdrToken;
  location?: CdrLocation;
  meter_id?: string;
  currency: string;
  tariffs?: Tariff[];
  charging_periods: ChargingPeriod[];
  total_cost: number;
  total_fixed_cost?: number;
  total_energy: number;
  total_energy_cost?: number;
  total_time: number;
  total_time_cost?: number;
  total_parking_time?: number;
  total_parking_cost?: number;
  total_reservation_cost?: number;
  remark?: string;
  last_updated: string;
}
