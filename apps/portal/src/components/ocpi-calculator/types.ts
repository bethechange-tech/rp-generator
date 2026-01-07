export type CalculationType = "session" | "cdr" | "record";
export type InputMode = "form" | "json";
export type Step = 1 | 2 | 3;

export interface ChargingDimension {
  type: "ENERGY" | "TIME" | "PARKING_TIME" | "FLAT";
  volume: number;
}

export interface ChargingPeriod {
  start_date_time: string;
  dimensions: ChargingDimension[];
}

export interface PriceComponent {
  type: "ENERGY" | "TIME" | "PARKING_TIME" | "FLAT";
  price: number;
  step_size: number;
  vat: number;
}

export interface TariffRestriction {
  start_time?: string;
  end_time?: string;
  day_of_week?: string[];
}

export interface TariffElement {
  price_components: PriceComponent[];
  restrictions?: TariffRestriction;
}

export interface SessionFormData {
  country_code: string;
  party_id: string;
  id: string;
  start_date_time: string;
  end_date_time: string;
  kwh: number;
  currency: string;
  location_id: string;
  evse_uid: string;
  connector_id: string;
  charging_periods: ChargingPeriod[];
}

export interface TariffFormData {
  country_code: string;
  party_id: string;
  id: string;
  currency: string;
  elements: TariffElement[];
}

export interface RecordFormData {
  start_date_time: string;
  end_date_time: string;
  kwh: number;
  charging_periods: ChargingPeriod[];
}

export const TYPE_INFO = {
  session: {
    title: "OCPI Session + Tariff",
    description: "Calculate costs from a charging session and separate tariff",
    icon: "⚡",
  },
  cdr: {
    title: "OCPI CDR + Tariff",
    description: "Calculate from a Charge Detail Record with separate tariff",
    icon: "📄",
  },
  record: {
    title: "Simple Record",
    description: "Basic charge record with tariff for quick calculations",
    icon: "🔋",
  },
} as const;
