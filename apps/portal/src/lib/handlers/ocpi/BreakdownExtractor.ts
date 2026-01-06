import type {
  SessionDetails,
  EnergyDetails,
  ParkingDetails,
  TariffApplied,
  TariffElement,
} from "./types";

/**
 * Extracts detailed breakdown information from OCPI payloads
 */
export class BreakdownExtractor {
  /**
   * Format duration from minutes to human readable
   */
  static formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours === 0) return `${mins} minutes`;
    if (mins === 0) return `${hours} hour${hours > 1 ? "s" : ""}`;
    return `${hours}h ${mins}m`;
  }

  /**
   * Get day of week from date
   */
  static getDayOfWeek(date: Date): string {
    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    return days[date.getDay()];
  }

  /**
   * Get time of day category
   */
  static getTimeOfDay(date: Date): string {
    const hour = date.getHours();
    if (hour >= 5 && hour < 12) return "Morning";
    if (hour >= 12 && hour < 17) return "Afternoon";
    if (hour >= 17 && hour < 21) return "Evening";
    return "Night";
  }

  /**
   * Format time as HH:MM
   */
  static formatTime(date: Date): string {
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /**
   * Format date as DD/MM/YYYY
   */
  static formatDate(date: Date): string {
    return date.toLocaleDateString("en-GB");
  }

  /**
   * Extract session details from payload
   */
  static extractSessionDetails(
    payload: Record<string, unknown>
  ): SessionDetails {
    const startDate = new Date(payload.start_date_time as string);
    const endDate = new Date(
      (payload.end_date_time as string) || Date.now()
    );
    const durationMs = endDate.getTime() - startDate.getTime();
    const durationMinutes = durationMs / (1000 * 60);

    return {
      startTime: this.formatTime(startDate),
      endTime: this.formatTime(endDate),
      durationMinutes: Math.round(durationMinutes),
      durationFormatted: this.formatDuration(durationMinutes),
      dayOfWeek: this.getDayOfWeek(startDate),
      timeOfDay: this.getTimeOfDay(startDate),
      date: this.formatDate(startDate),
    };
  }

  /**
   * Extract energy details from payload and tariff
   */
  static extractEnergyDetails(
    payload: Record<string, unknown>,
    tariff?: Record<string, unknown>
  ): EnergyDetails {
    const totalKwh =
      (payload.total_energy as number) || (payload.kwh as number) || 0;

    // Find energy price from tariff
    let pricePerKwh = 0;
    if (tariff?.elements) {
      const elements = tariff.elements as TariffElement[];
      for (const element of elements) {
        const energyComponent = element.price_components.find(
          (pc) => pc.type === "ENERGY"
        );
        if (energyComponent) {
          pricePerKwh = energyComponent.price;
          break;
        }
      }
    }

    const energyCost = totalKwh * pricePerKwh;

    return {
      totalKwh: Math.round(totalKwh * 100) / 100,
      pricePerKwh,
      calculation: `${totalKwh.toFixed(2)} kWh × £${pricePerKwh.toFixed(2)}/kWh = £${energyCost.toFixed(2)}`,
    };
  }

  /**
   * Extract parking details from payload and tariff
   */
  static extractParkingDetails(
    payload: Record<string, unknown>,
    tariff?: Record<string, unknown>
  ): ParkingDetails {
    const totalParkingTime = (payload.total_parking_time as number) || 0;
    const totalMinutes = totalParkingTime * 60;

    // Find parking price from tariff
    let pricePerHour = 0;
    const applicableRestrictions: string[] = [];

    if (tariff?.elements) {
      const elements = tariff.elements as TariffElement[];
      for (const element of elements) {
        const parkingComponent = element.price_components.find(
          (pc) => pc.type === "PARKING_TIME"
        );
        if (parkingComponent) {
          pricePerHour = parkingComponent.price * 60;

          // Check restrictions
          if (element.restrictions) {
            const r = element.restrictions;
            if (r.start_time && r.end_time) {
              applicableRestrictions.push(
                `Time window: ${r.start_time} - ${r.end_time}`
              );
            }
            if (r.day_of_week && r.day_of_week.length > 0) {
              applicableRestrictions.push(`Days: ${r.day_of_week.join(", ")}`);
            }
            if (r.min_duration) {
              applicableRestrictions.push(
                `Minimum duration: ${r.min_duration} seconds`
              );
            }
          }
          break;
        }
      }
    }

    const parkingCost = totalParkingTime * pricePerHour;

    return {
      totalMinutes: Math.round(totalMinutes),
      totalHours: Math.round(totalParkingTime * 100) / 100,
      pricePerHour,
      calculation:
        totalParkingTime > 0
          ? `${totalParkingTime.toFixed(2)} hours × £${pricePerHour.toFixed(2)}/hour = £${parkingCost.toFixed(2)}`
          : "No parking time recorded",
      applicableRestrictions,
    };
  }

  /**
   * Extract tariff details
   */
  static extractTariffDetails(tariff?: Record<string, unknown>): TariffApplied {
    const currency = (tariff?.currency as string) || "GBP";
    const elements: TariffApplied["elements"] = [];

    if (tariff?.elements) {
      const tariffElements = tariff.elements as TariffElement[];
      for (const element of tariffElements) {
        for (const pc of element.price_components) {
          const restrictions: string[] = [];
          if (element.restrictions) {
            const r = element.restrictions;
            if (r.start_time) restrictions.push(`From ${r.start_time}`);
            if (r.end_time) restrictions.push(`Until ${r.end_time}`);
            if (r.day_of_week)
              restrictions.push(`On ${r.day_of_week.join(", ")}`);
          }

          elements.push({
            type: pc.type,
            price: pc.price,
            stepSize: pc.step_size,
            vat: pc.vat ?? 20,
            restrictions: restrictions.length > 0 ? restrictions : undefined,
          });
        }
      }
    }

    return { currency, elements };
  }

  /**
   * Generate explanations for the cost breakdown
   */
  static generateExplanations(
    session: SessionDetails,
    energy: EnergyDetails,
    parking: ParkingDetails,
    tariff: TariffApplied
  ): string[] {
    const explanations: string[] = [];

    // Session timing explanation
    explanations.push(
      `Charging session on ${session.dayOfWeek}, ${session.date} (${session.timeOfDay.toLowerCase()} session)`
    );
    explanations.push(
      `Duration: ${session.durationFormatted} (${session.startTime} to ${session.endTime})`
    );

    // Energy explanation
    if (energy.totalKwh > 0) {
      explanations.push(
        `Energy consumed: ${energy.totalKwh} kWh at £${energy.pricePerKwh.toFixed(2)} per kWh`
      );
    }

    // Parking explanation
    if (parking.totalMinutes > 0) {
      explanations.push(
        `Parking time: ${this.formatDuration(parking.totalMinutes)} at £${parking.pricePerHour.toFixed(2)} per hour`
      );
      if (parking.applicableRestrictions.length > 0) {
        explanations.push(
          `Parking restrictions applied: ${parking.applicableRestrictions.join("; ")}`
        );
      }
    } else {
      explanations.push("No additional parking charges applied");
    }

    // VAT explanation
    const vatRate = tariff.elements.find((e) => e.vat)?.vat ?? 20;
    explanations.push(
      `VAT applied at ${vatRate}% (standard UK rate for EV charging)`
    );

    return explanations;
  }
}
