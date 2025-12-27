import { Money } from "../../Money";
import type { ChargeRecord, PriceComponent, TariffDimensionType, TariffRestriction } from "../types";
import { VolumeCalculator } from "./VolumeCalculator";

export class ComponentCostCalculator {
  static calculate(
    record: ChargeRecord,
    component: PriceComponent,
    restrictions?: TariffRestriction
  ): Money {
    const volume = this.getAdjustedVolume(record, component.type, restrictions);
    return this.calculateCost(volume, component);
  }

  private static getAdjustedVolume(
    record: ChargeRecord,
    type: TariffDimensionType,
    restrictions?: TariffRestriction
  ): number {
    const baseVolume = VolumeCalculator.getVolume(record, type);

    if (type !== "TIME" && type !== "PARKING_TIME") {
      return baseVolume;
    }

    if (!restrictions) return baseVolume;

    let volumeInMinutes = baseVolume;

    if (restrictions.min_duration !== undefined) {
      const graceMinutes = restrictions.min_duration / 60;
      volumeInMinutes = Math.max(0, volumeInMinutes - graceMinutes);
    }

    if (restrictions.max_duration !== undefined) {
      const maxMinutes = restrictions.max_duration / 60;
      volumeInMinutes = Math.min(volumeInMinutes, maxMinutes);
    }

    return volumeInMinutes;
  }

  private static calculateCost(volume: number, component: PriceComponent): Money {
    if (component.step_size <= 0) {
      return Money.fromPounds(component.price).multiply(volume);
    }

    const steps = Math.ceil(volume / component.step_size);
    const billableVolume = steps * component.step_size;
    return Money.fromPounds(component.price).multiply(billableVolume);
  }
}
