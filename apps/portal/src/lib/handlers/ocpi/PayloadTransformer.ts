import type { ChargeRecord, Cdr } from "@ev-receipt/core";
import type { OcpiPrice } from "./types";

/**
 * Transforms OCPI payloads to internal formats
 */
export class PayloadTransformer {
  /**
   * Extracts numeric value from OCPI Price object or number
   * Returns value in pounds (decimal format)
   */
  static extractNumericCost(value: number | OcpiPrice | undefined): number {
    if (value === undefined) return 0;
    if (typeof value === "number") return value;
    return value.incl_vat ?? value.excl_vat;
  }

  /**
   * Transforms OCPI Session/CDR payload to ChargeRecord format
   */
  static toChargeRecord(payload: Record<string, unknown>): ChargeRecord {
    return {
      start_date_time: payload.start_date_time as string,
      end_date_time: payload.end_date_time as string,
      kwh: payload.kwh as number | undefined,
      charging_periods: (payload.charging_periods as any[]) ?? [],
      total_cost: this.extractNumericCost(payload.total_cost as any),
      total_energy: payload.total_energy as number | undefined,
      total_time: payload.total_time as number | undefined,
      total_parking_time: payload.total_parking_time as number | undefined,
    };
  }

  /**
   * Transforms OCPI CDR payload to Cdr format for calculateFromCdr
   */
  static toCdr(payload: Record<string, unknown>): Cdr {
    return {
      id: payload.id as string,
      start_date_time: payload.start_date_time as string,
      end_date_time: payload.end_date_time as string,
      currency: payload.currency as string,
      charging_periods: (payload.charging_periods as any[]) ?? [],
      tariffs: payload.tariffs as any[] | undefined,
      total_cost: this.extractNumericCost(payload.total_cost as any),
      total_fixed_cost: this.extractNumericCost(payload.total_fixed_cost as any),
      total_energy: payload.total_energy as number,
      total_energy_cost: this.extractNumericCost(payload.total_energy_cost as any),
      total_time: payload.total_time as number,
      total_time_cost: this.extractNumericCost(payload.total_time_cost as any),
      total_parking_time: payload.total_parking_time as number | undefined,
      total_parking_cost: this.extractNumericCost(payload.total_parking_cost as any),
      total_reservation_cost: this.extractNumericCost(payload.total_reservation_cost as any),
      last_updated: payload.last_updated as string,
    };
  }
}
