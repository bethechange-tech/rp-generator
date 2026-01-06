import type { CostBreakdown } from "@ev-receipt/core";

/** OCPI Price object format */
export type OcpiPrice = { excl_vat: number; incl_vat?: number };

/** Charging period dimension */
export interface ChargingDimension {
  type: string;
  volume: number;
}

/** Charging period from OCPI */
export interface ChargingPeriod {
  start_date_time: string;
  dimensions: ChargingDimension[];
  tariff_id?: string;
}

/** Tariff restriction from OCPI */
export interface TariffRestriction {
  start_time?: string;
  end_time?: string;
  start_date?: string;
  end_date?: string;
  min_kwh?: number;
  max_kwh?: number;
  min_duration?: number;
  max_duration?: number;
  day_of_week?: string[];
  reservation?: string;
}

/** Price component from tariff */
export interface PriceComponent {
  type: string;
  price: number;
  step_size: number;
  vat?: number;
}

/** Tariff element */
export interface TariffElement {
  price_components: PriceComponent[];
  restrictions?: TariffRestriction;
}

/** Session details for breakdown */
export interface SessionDetails {
  startTime: string;
  endTime: string;
  durationMinutes: number;
  durationFormatted: string;
  dayOfWeek: string;
  timeOfDay: string;
  date: string;
}

/** Energy details for breakdown */
export interface EnergyDetails {
  totalKwh: number;
  pricePerKwh: number;
  calculation: string;
}

/** Parking details for breakdown */
export interface ParkingDetails {
  totalMinutes: number;
  totalHours: number;
  pricePerHour: number;
  calculation: string;
  applicableRestrictions: string[];
}

/** Tariff applied element */
export interface TariffAppliedElement {
  type: string;
  price: number;
  stepSize: number;
  vat: number;
  restrictions?: string[];
}

/** Tariff applied details */
export interface TariffApplied {
  currency: string;
  elements: TariffAppliedElement[];
}

/** Cost breakdown details */
export interface CostBreakdownDetails {
  session: SessionDetails;
  energy: EnergyDetails;
  parking: ParkingDetails;
  tariffApplied: TariffApplied;
  explanations: string[];
}

/** Formatted cost values - from OcpiCostCalculator.formatBreakdown */
export type FormattedCosts = Record<string, string>;

/** Detailed cost response */
export interface DetailedCostResponse {
  energy: string;
  time: string;
  parking: string;
  flat: string;
  subtotal: string;
  vat: string;
  total: string;
  formatted: FormattedCosts;
  details: CostBreakdownDetails;
}

/** Error response */
export interface CalculateErrorResponse {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

/** Calculate response type */
export type CalculateResponse = DetailedCostResponse | CalculateErrorResponse;
