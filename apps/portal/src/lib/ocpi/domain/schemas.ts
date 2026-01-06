import { z } from "zod";

// ============================================================================
// OCPI 2.2.1 Compliant Schemas
// Supports actual OCPI payloads with flexible validation
// ============================================================================

// Flexible datetime - accepts ISO 8601 with or without timezone
const DateTimeSchema = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: "Must be a valid datetime string" }
);

// Flexible time format - HH:MM or HH:MM:SS
const TimeSchema = z.string().regex(
  /^\d{2}:\d{2}(:\d{2})?$/,
  "Must be in HH:MM or HH:MM:SS format"
);

// ============================================================================
// Enums - OCPI 2.2.1 Specification
// ============================================================================

export const TariffDimensionTypeSchema = z.enum([
  "ENERGY",
  "FLAT", 
  "PARKING_TIME",
  "TIME",
  "RESERVATION", // OCPI 2.2.1 addition
]);

export const DayOfWeekSchema = z.enum([
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
]);

export const AuthMethodSchema = z.enum([
  "AUTH_REQUEST",
  "COMMAND",
  "WHITELIST",
]);

export const TokenTypeSchema = z.enum([
  "AD_HOC_USER",
  "APP_USER",
  "OTHER",
  "RFID",
]);

export const SessionStatusSchema = z.enum([
  "ACTIVE",
  "COMPLETED",
  "INVALID",
  "PENDING",
  "RESERVATION",
]);

export const ConnectorTypeSchema = z.enum([
  "CHADEMO",
  "CHAOJI",
  "DOMESTIC_A",
  "DOMESTIC_B",
  "DOMESTIC_C",
  "DOMESTIC_D",
  "DOMESTIC_E",
  "DOMESTIC_F",
  "DOMESTIC_G",
  "DOMESTIC_H",
  "DOMESTIC_I",
  "DOMESTIC_J",
  "DOMESTIC_K",
  "DOMESTIC_L",
  "DOMESTIC_M",
  "DOMESTIC_N",
  "DOMESTIC_O",
  "GBT_AC",
  "GBT_DC",
  "IEC_60309_2_single_16",
  "IEC_60309_2_three_16",
  "IEC_60309_2_three_32",
  "IEC_60309_2_three_64",
  "IEC_62196_T1",
  "IEC_62196_T1_COMBO",
  "IEC_62196_T2",
  "IEC_62196_T2_COMBO",
  "IEC_62196_T3A",
  "IEC_62196_T3C",
  "NEMA_5_20",
  "NEMA_6_30",
  "NEMA_6_50",
  "NEMA_10_30",
  "NEMA_10_50",
  "NEMA_14_30",
  "NEMA_14_50",
  "PANTOGRAPH_BOTTOM_UP",
  "PANTOGRAPH_TOP_DOWN",
  "TESLA_R",
  "TESLA_S",
]).or(z.string()); // Allow unknown connector types

export const PowerTypeSchema = z.enum([
  "AC_1_PHASE",
  "AC_2_PHASE",
  "AC_2_PHASE_SPLIT",
  "AC_3_PHASE",
  "DC",
]).or(z.string());

export const TariffTypeSchema = z.enum([
  "AD_HOC_PAYMENT",
  "PROFILE_CHEAP",
  "PROFILE_FAST",
  "PROFILE_GREEN",
  "REGULAR",
]).or(z.string());

export const ReservationRestrictionTypeSchema = z.enum([
  "RESERVATION",
  "RESERVATION_EXPIRES",
]).or(z.string());

// ============================================================================
// OCPI Price/Tariff Components
// ============================================================================

export const TariffRestrictionSchema = z.object({
  start_time: TimeSchema.optional(),
  end_time: TimeSchema.optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  min_kwh: z.number().optional(),
  max_kwh: z.number().optional(),
  min_current: z.number().optional(),
  max_current: z.number().optional(),
  min_power: z.number().optional(),
  max_power: z.number().optional(),
  min_duration: z.number().optional(),
  max_duration: z.number().optional(),
  day_of_week: z.array(DayOfWeekSchema).optional(),
  reservation: ReservationRestrictionTypeSchema.optional(),
}).passthrough(); // Allow additional fields

export const PriceComponentSchema = z.object({
  type: TariffDimensionTypeSchema,
  price: z.number(),
  step_size: z.number().positive("Step size must be positive"),
  vat: z.number().optional(),
}).passthrough();

export const TariffElementSchema = z.object({
  price_components: z.array(PriceComponentSchema).min(1, "At least one price component is required"),
  restrictions: TariffRestrictionSchema.optional(),
}).passthrough();

export const DisplayTextSchema = z.object({
  language: z.string(),
  text: z.string(),
}).passthrough();

export const PriceSchema = z.object({
  excl_vat: z.number(),
  incl_vat: z.number().optional(),
}).passthrough();

export const EnergyMixSchema = z.object({
  is_green_energy: z.boolean(),
  energy_sources: z.array(z.object({
    source: z.string(),
    percentage: z.number(),
  })).optional(),
  environ_impact: z.array(z.object({
    category: z.string(),
    amount: z.number(),
  })).optional(),
  supplier_name: z.string().optional(),
  energy_product_name: z.string().optional(),
}).passthrough();

// Full OCPI Tariff schema
export const TariffSchema = z.object({
  country_code: z.string().optional(),
  party_id: z.string().optional(),
  id: z.string().optional(),
  currency: z.string().min(1, "Currency is required"),
  type: TariffTypeSchema.optional(),
  tariff_alt_text: z.array(DisplayTextSchema).optional(),
  tariff_alt_url: z.string().url().optional().or(z.string()),
  min_price: PriceSchema.optional(),
  max_price: PriceSchema.optional(),
  elements: z.array(TariffElementSchema).min(1, "At least one tariff element is required"),
  start_date_time: DateTimeSchema.optional(),
  end_date_time: DateTimeSchema.optional(),
  energy_mix: EnergyMixSchema.optional(),
  last_updated: DateTimeSchema.optional(),
}).passthrough();

// ============================================================================
// Charging Period (used in both Session and CDR)
// ============================================================================

export const ChargingPeriodDimensionSchema = z.object({
  type: TariffDimensionTypeSchema,
  volume: z.number(),
}).passthrough();

export const ChargingPeriodSchema = z.object({
  start_date_time: DateTimeSchema,
  dimensions: z.array(ChargingPeriodDimensionSchema).min(1, "At least one dimension is required"),
  tariff_id: z.string().optional(),
}).passthrough();

// ============================================================================
// OCPI Session (Charging Session)
// ============================================================================

export const GeoLocationSchema = z.object({
  latitude: z.string(),
  longitude: z.string(),
}).passthrough();

export const ConnectorSchema = z.object({
  id: z.string(),
  standard: ConnectorTypeSchema.optional(),
  format: z.string().optional(),
  power_type: PowerTypeSchema.optional(),
  max_voltage: z.number().optional(),
  max_amperage: z.number().optional(),
  max_electric_power: z.number().optional(),
  tariff_ids: z.array(z.string()).optional(),
  terms_and_conditions: z.string().optional(),
  last_updated: DateTimeSchema.optional(),
}).passthrough();

export const EVSESchema = z.object({
  uid: z.string(),
  evse_id: z.string().optional(),
  status: z.string().optional(),
  status_schedule: z.array(z.any()).optional(),
  capabilities: z.array(z.string()).optional(),
  connectors: z.array(ConnectorSchema).optional(),
  floor_level: z.string().optional(),
  coordinates: GeoLocationSchema.optional(),
  physical_reference: z.string().optional(),
  directions: z.array(DisplayTextSchema).optional(),
  parking_restrictions: z.array(z.string()).optional(),
  images: z.array(z.any()).optional(),
  last_updated: DateTimeSchema.optional(),
}).passthrough();

export const CdrTokenSchema = z.object({
  country_code: z.string().optional(),
  party_id: z.string().optional(),
  uid: z.string(),
  type: TokenTypeSchema.or(z.string()),
  contract_id: z.string(),
  visual_number: z.string().optional(),
  issuer: z.string().optional(),
  group_id: z.string().optional(),
  valid: z.boolean().optional(),
  whitelist: z.string().optional(),
  language: z.string().optional(),
  default_profile_type: z.string().optional(),
  energy_contract: z.any().optional(),
  last_updated: DateTimeSchema.optional(),
}).passthrough();

export const CdrLocationSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  address: z.string(),
  city: z.string(),
  postal_code: z.string().optional(),
  state: z.string().optional(),
  country: z.string(),
  coordinates: GeoLocationSchema.optional(),
  evse_uid: z.string().optional(),
  evse_id: z.string().optional(),
  connector_id: z.string().optional(),
  connector_standard: ConnectorTypeSchema.optional(),
  connector_format: z.string().optional(),
  connector_power_type: PowerTypeSchema.optional(),
}).passthrough();

// Full OCPI Session schema
export const OcpiSessionSchema = z.object({
  country_code: z.string().optional(),
  party_id: z.string().optional(),
  id: z.string().optional(),
  start_date_time: DateTimeSchema,
  end_date_time: DateTimeSchema.optional(),
  kwh: z.number(),
  cdr_token: CdrTokenSchema.optional(),
  auth_method: AuthMethodSchema.or(z.string()).optional(),
  authorization_reference: z.string().optional(),
  location_id: z.string().optional(),
  evse_uid: z.string().optional(),
  connector_id: z.string().optional(),
  meter_id: z.string().optional(),
  currency: z.string().optional(),
  charging_periods: z.array(ChargingPeriodSchema).default([]),
  total_cost: z.union([z.number(), PriceSchema]).optional(),
  total_energy: z.number().optional(),
  total_time: z.number().optional(),
  total_parking_time: z.number().optional(),
  status: SessionStatusSchema.or(z.string()).optional(),
  last_updated: DateTimeSchema.optional(),
}).passthrough();

// ============================================================================
// OCPI CDR (Charge Detail Record)
// ============================================================================

export const SignedDataSchema = z.object({
  encoding_method: z.string(),
  encoding_method_version: z.number().optional(),
  public_key: z.string().optional(),
  signed_values: z.array(z.object({
    nature: z.string(),
    plain_data: z.string(),
    signed_data: z.string(),
  })).optional(),
  url: z.string().optional(),
}).passthrough();

// Full OCPI CDR schema
export const CdrSchema = z.object({
  country_code: z.string().optional(),
  party_id: z.string().optional(),
  id: z.string(),
  start_date_time: DateTimeSchema,
  end_date_time: DateTimeSchema,
  session_id: z.string().optional(),
  cdr_token: CdrTokenSchema.optional(),
  auth_method: AuthMethodSchema.or(z.string()).optional(),
  authorization_reference: z.string().optional(),
  cdr_location: CdrLocationSchema.optional(),
  location: CdrLocationSchema.optional(), // Alternative field name
  meter_id: z.string().optional(),
  currency: z.string(),
  tariffs: z.array(TariffSchema).optional(),
  charging_periods: z.array(ChargingPeriodSchema).default([]),
  signed_data: SignedDataSchema.optional(),
  total_cost: z.union([z.number(), PriceSchema]),
  total_fixed_cost: z.union([z.number(), PriceSchema]).optional(),
  total_energy: z.number(),
  total_energy_cost: z.union([z.number(), PriceSchema]).optional(),
  total_time: z.number(),
  total_time_cost: z.union([z.number(), PriceSchema]).optional(),
  total_parking_time: z.number().optional(),
  total_parking_cost: z.union([z.number(), PriceSchema]).optional(),
  total_reservation_cost: z.union([z.number(), PriceSchema]).optional(),
  remark: z.string().optional(),
  invoice_reference_id: z.string().optional(),
  credit: z.boolean().optional(),
  credit_reference_id: z.string().optional(),
  home_charging_compensation: z.boolean().optional(),
  last_updated: DateTimeSchema,
}).passthrough();

// ============================================================================
// Charge Record (simplified interface for calculations)
// ============================================================================

export const ChargeRecordSchema = z.object({
  start_date_time: DateTimeSchema,
  end_date_time: DateTimeSchema,
  kwh: z.number().optional(),
  charging_periods: z.array(ChargingPeriodSchema).default([]),
  total_cost: z.number().optional(),
  total_energy: z.number().optional(),
  total_time: z.number().optional(),
  total_parking_time: z.number().optional(),
}).passthrough();

// ============================================================================
// Request Schemas - Flexible input acceptance
// ============================================================================

export const CalculateCostRequestSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("session"),
    session: OcpiSessionSchema,
    tariff: TariffSchema,
  }),
  z.object({
    type: z.literal("cdr"),
    cdr: CdrSchema,
  }),
  z.object({
    type: z.literal("record"),
    record: ChargeRecordSchema,
    tariff: TariffSchema,
  }),
]);

// ============================================================================
// Type Exports
// ============================================================================

export type TariffDimensionType = z.infer<typeof TariffDimensionTypeSchema>;
export type DayOfWeek = z.infer<typeof DayOfWeekSchema>;
export type TariffRestriction = z.infer<typeof TariffRestrictionSchema>;
export type PriceComponent = z.infer<typeof PriceComponentSchema>;
export type TariffElement = z.infer<typeof TariffElementSchema>;
export type Tariff = z.infer<typeof TariffSchema>;
export type ChargingPeriodDimension = z.infer<typeof ChargingPeriodDimensionSchema>;
export type ChargingPeriod = z.infer<typeof ChargingPeriodSchema>;
export type OcpiSession = z.infer<typeof OcpiSessionSchema>;
export type CdrToken = z.infer<typeof CdrTokenSchema>;
export type CdrLocation = z.infer<typeof CdrLocationSchema>;
export type Cdr = z.infer<typeof CdrSchema>;
export type ChargeRecord = z.infer<typeof ChargeRecordSchema>;
export type CalculateCostRequest = z.infer<typeof CalculateCostRequestSchema>;

// Response type (serialized from Money objects)
export interface SessionDetails {
  startTime: string;
  endTime: string;
  durationMinutes: number;
  durationFormatted: string;
  dayOfWeek: string;
  timeOfDay: string;
  date: string;
}

export interface EnergyDetails {
  totalKwh: number;
  pricePerKwh: number;
  calculation: string;
}

export interface ParkingDetails {
  totalMinutes: number;
  totalHours: number;
  pricePerHour: number;
  calculation: string;
  applicableRestrictions: string[];
}

export interface TariffAppliedElement {
  type: string;
  price: number;
  stepSize: number;
  vat: number;
  restrictions?: string[];
}

export interface TariffApplied {
  currency: string;
  elements: TariffAppliedElement[];
}

export interface CostBreakdownDetails {
  session: SessionDetails;
  energy: EnergyDetails;
  parking: ParkingDetails;
  tariffApplied: TariffApplied;
  explanations: string[];
}

export interface CostBreakdownResponse {
  energy: string;
  time: string;
  parking: string;
  flat: string;
  subtotal: string;
  vat: string;
  total: string;
  formatted: {
    energy_cost: string;
    time_cost: string;
    parking_cost: string;
    flat_fee: string;
    subtotal: string;
    vat_amount: string;
    total_amount: string;
  };
  details?: CostBreakdownDetails;
}
