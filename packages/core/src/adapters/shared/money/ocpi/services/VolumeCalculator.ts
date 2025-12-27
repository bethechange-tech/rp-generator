import type { ChargeRecord, ChargingPeriod, TariffDimensionType } from "../types";

export class VolumeCalculator {
  static getVolume(record: ChargeRecord, type: TariffDimensionType): number {
    if (type === "FLAT") {
      return 1;
    }

    if (record.charging_periods.length > 0) {
      return this.getVolumeFromPeriods(record.charging_periods, type);
    }

    switch (type) {
      case "ENERGY":
        return record.total_energy ?? record.kwh ?? 0;
      case "TIME":
        return record.total_time ?? this.calculateDurationMinutes(record);
      case "PARKING_TIME":
        return record.total_parking_time ?? 0;
      default:
        return 0;
    }
  }

  private static getVolumeFromPeriods(
    periods: ChargingPeriod[],
    type: TariffDimensionType
  ): number {
    let total = 0;
    for (const period of periods) {
      for (const dimension of period.dimensions) {
        if (dimension.type === type) {
          total += dimension.volume;
        }
      }
    }
    return total;
  }

  private static calculateDurationMinutes(record: ChargeRecord): number {
    const start = new Date(record.start_date_time);
    const end = new Date(record.end_date_time);
    return (end.getTime() - start.getTime()) / (1000 * 60);
  }
}
