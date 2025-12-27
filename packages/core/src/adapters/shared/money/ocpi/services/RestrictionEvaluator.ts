import type { ChargeRecord, DayOfWeek, TariffElement } from "../types";
import { VolumeCalculator } from "./VolumeCalculator";

const DAY_MAP: DayOfWeek[] = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

export class RestrictionEvaluator {
  static isApplicable(record: ChargeRecord, element: TariffElement): boolean {
    const restrictions = element.restrictions;
    
    if (!restrictions) return true;

    const recordStart = new Date(record.start_date_time);

    if (!this.checkDayOfWeek(recordStart, restrictions.day_of_week)) {
      return false;
    }

    if (!this.checkTimeOfDay(recordStart, restrictions.start_time, restrictions.end_time)) {
      return false;
    }

    if (!this.checkDateRange(recordStart, restrictions.start_date, restrictions.end_date)) {
      return false;
    }

    if (!this.checkEnergyBounds(record, restrictions.min_kwh, restrictions.max_kwh)) {
      return false;
    }

    return true;
  }

  private static checkDayOfWeek(
    recordStart: Date,
    allowedDays?: DayOfWeek[]
  ): boolean {
    if (!allowedDays || allowedDays.length === 0) return true;

    const day = DAY_MAP[recordStart.getDay()];
    return allowedDays.includes(day);
  }

  private static checkTimeOfDay(
    recordStart: Date,
    startTime?: string,
    endTime?: string
  ): boolean {
    if (!startTime && !endTime) return true;

    const time = this.getTimeString(recordStart);

    if (startTime && time < startTime) return false;
    if (endTime && time >= endTime) return false;

    return true;
  }

  private static checkDateRange(
    recordStart: Date,
    startDate?: string,
    endDate?: string
  ): boolean {
    if (!startDate && !endDate) return true;

    const date = this.getDateString(recordStart);

    if (startDate && date < startDate) return false;
    if (endDate && date > endDate) return false;

    return true;
  }

  private static checkEnergyBounds(
    record: ChargeRecord,
    minKwh?: number,
    maxKwh?: number
  ): boolean {
    const energy = VolumeCalculator.getVolume(record, "ENERGY");

    if (minKwh !== undefined && energy < minKwh) return false;
    if (maxKwh !== undefined && energy > maxKwh) return false;

    return true;
  }

  private static getTimeString(date: Date): string {
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  private static getDateString(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}
