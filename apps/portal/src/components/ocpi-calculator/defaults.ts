import type { SessionFormData, TariffFormData, RecordFormData } from "./types";

export const DEFAULT_SESSION_FORM: SessionFormData = {
  country_code: "GB",
  party_id: "VCH",
  id: "session-" + Date.now(),
  start_date_time: new Date().toISOString().slice(0, 16),
  end_date_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16),
  kwh: 45.5,
  currency: "GBP",
  location_id: "LOC001",
  evse_uid: "GB*VCH*E12345",
  connector_id: "1",
  charging_periods: [
    {
      start_date_time: new Date().toISOString(),
      dimensions: [
        { type: "ENERGY", volume: 45.5 },
        { type: "TIME", volume: 1.5 },
      ],
    },
  ],
};

export const DEFAULT_TARIFF_FORM: TariffFormData = {
  country_code: "GB",
  party_id: "VCH",
  id: "TARIFF-001",
  currency: "GBP",
  elements: [
    {
      price_components: [{ type: "ENERGY", price: 0.35, step_size: 1, vat: 20 }],
    },
    {
      price_components: [{ type: "PARKING_TIME", price: 0.10, step_size: 60, vat: 20 }],
      restrictions: {
        start_time: "09:00",
        end_time: "18:00",
        day_of_week: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
      },
    },
  ],
};

export const DEFAULT_RECORD_FORM: RecordFormData = {
  start_date_time: new Date().toISOString().slice(0, 16),
  end_date_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16),
  kwh: 45.5,
  charging_periods: [
    {
      start_date_time: new Date().toISOString(),
      dimensions: [
        { type: "ENERGY", volume: 45.5 },
        { type: "TIME", volume: 1.5 },
      ],
    },
  ],
};

export const EXAMPLE_SESSION = `{
  "country_code": "GB",
  "party_id": "VCH",
  "id": "session-12345",
  "start_date_time": "2025-01-06T10:00:00Z",
  "end_date_time": "2025-01-06T12:00:00Z",
  "kwh": 45.5,
  "cdr_token": { "uid": "012345678", "type": "RFID", "contract_id": "GB-VCH-C12345678-V" },
  "auth_method": "WHITELIST",
  "location_id": "LOC001",
  "evse_uid": "GB*VCH*E12345",
  "connector_id": "1",
  "currency": "GBP",
  "charging_periods": [
    { "start_date_time": "2025-01-06T10:00:00Z", "dimensions": [{ "type": "ENERGY", "volume": 45.5 }, { "type": "TIME", "volume": 1.5 }] },
    { "start_date_time": "2025-01-06T11:30:00Z", "dimensions": [{ "type": "PARKING_TIME", "volume": 0.5 }] }
  ],
  "total_cost": { "excl_vat": 17.43, "incl_vat": 20.92 },
  "total_energy": 45.5,
  "total_time": 1.5,
  "total_parking_time": 0.5,
  "status": "COMPLETED",
  "last_updated": "2025-01-06T12:00:00Z"
}`;

export const EXAMPLE_TARIFF = `{
  "country_code": "GB",
  "party_id": "VCH",
  "id": "TARIFF-001",
  "currency": "GBP",
  "type": "REGULAR",
  "tariff_alt_text": [{ "language": "en", "text": "Standard charging tariff" }],
  "elements": [
    { "price_components": [{ "type": "ENERGY", "price": 0.35, "step_size": 1, "vat": 20 }] },
    { "price_components": [{ "type": "PARKING_TIME", "price": 0.10, "step_size": 60, "vat": 20 }], "restrictions": { "start_time": "09:00", "end_time": "18:00", "day_of_week": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] } }
  ],
  "last_updated": "2025-01-01T00:00:00Z"
}`;

export const EXAMPLE_CDR = `{
  "country_code": "GB",
  "party_id": "VCH",
  "id": "CDR-2025-001234",
  "start_date_time": "2025-01-06T10:00:00Z",
  "end_date_time": "2025-01-06T12:00:00Z",
  "session_id": "session-12345",
  "cdr_token": { "country_code": "GB", "party_id": "VCH", "uid": "012345678", "type": "RFID", "contract_id": "GB-VCH-C12345678-V" },
  "auth_method": "WHITELIST",
  "cdr_location": { "id": "LOC001", "name": "VoltCharge London Station", "address": "123 Electric Avenue", "city": "London", "postal_code": "SW1A 1AA", "country": "GBR", "evse_uid": "GB*VCH*E12345", "evse_id": "GB*VCH*E12345", "connector_id": "1", "connector_standard": "IEC_62196_T2_COMBO", "connector_format": "CABLE", "connector_power_type": "DC" },
  "currency": "GBP",
  "charging_periods": [
    { "start_date_time": "2025-01-06T10:00:00Z", "dimensions": [{ "type": "ENERGY", "volume": 45.5 }, { "type": "TIME", "volume": 1.5 }], "tariff_id": "TARIFF-001" },
    { "start_date_time": "2025-01-06T11:30:00Z", "dimensions": [{ "type": "PARKING_TIME", "volume": 0.5 }], "tariff_id": "TARIFF-001" }
  ],
  "total_cost": { "excl_vat": 16.30, "incl_vat": 19.56 },
  "total_energy": 45.5,
  "total_energy_cost": { "excl_vat": 15.93, "incl_vat": 19.11 },
  "total_time": 1.5,
  "total_parking_time": 0.5,
  "total_parking_cost": { "excl_vat": 0.05, "incl_vat": 0.06 },
  "last_updated": "2025-01-06T12:00:00Z"
}`;

export const EXAMPLE_CDR_TARIFF = EXAMPLE_TARIFF;

export const EXAMPLE_RECORD = `{
  "start_date_time": "2025-01-06T10:00:00Z",
  "end_date_time": "2025-01-06T12:00:00Z",
  "kwh": 45.5,
  "charging_periods": [
    { "start_date_time": "2025-01-06T10:00:00Z", "dimensions": [{ "type": "ENERGY", "volume": 45.5 }, { "type": "TIME", "volume": 1.5 }] },
    { "start_date_time": "2025-01-06T11:30:00Z", "dimensions": [{ "type": "PARKING_TIME", "volume": 0.5 }] }
  ],
  "total_energy": 45.5,
  "total_time": 1.5,
  "total_parking_time": 0.5
}`;
