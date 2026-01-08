import { describe, it, expect } from "vitest";
import { OcpiCostCalculator } from "./ocpi";
import type { OcpiSession, Tariff, Cdr } from "./ocpi";

describe("OcpiCostCalculator", () => {
  describe("given a simple energy-only tariff", () => {
    const tariff: Tariff = {
      currency: "GBP",
      elements: [
        {
          price_components: [
            { type: "ENERGY", price: 0.30, step_size: 1 },
          ],
        },
      ],
    };

    it("calculates cost for 50 kWh at 30p/kWh = £15.00", () => {
      const session: OcpiSession = {
        start_date_time: "2025-12-26T10:00:00Z",
        end_date_time: "2025-12-26T10:45:00Z",
        kwh: 50,
        charging_periods: [],
      };

      const breakdown = OcpiCostCalculator.calculate(session, tariff);

      expect(breakdown.energy.toPounds()).toBe(15);
      expect(breakdown.total.toPounds()).toBe(15);
    });

    it("calculates cost for 32.5 kWh at 30p/kWh (rounds to 33 kWh = £9.90)", () => {
      const session: OcpiSession = {
        start_date_time: "2025-12-26T14:00:00Z",
        end_date_time: "2025-12-26T14:30:00Z",
        kwh: 32.5,
        charging_periods: [],
      };

      const breakdown = OcpiCostCalculator.calculate(session, tariff);

      expect(breakdown.energy.toPounds()).toBe(9.90);
    });
  });

  describe("given a tariff with energy and flat fee", () => {
    const tariff: Tariff = {
      currency: "GBP",
      elements: [
        {
          price_components: [
            { type: "ENERGY", price: 0.25, step_size: 1 },
            { type: "FLAT", price: 1.00, step_size: 0 },
          ],
        },
      ],
    };

    it("adds £1 connection fee to energy cost", () => {
      const session: OcpiSession = {
        start_date_time: "2025-12-26T09:00:00Z",
        end_date_time: "2025-12-26T09:30:00Z",
        kwh: 20,
        charging_periods: [],
      };

      const breakdown = OcpiCostCalculator.calculate(session, tariff);

      expect(breakdown.energy.toPounds()).toBe(5);
      expect(breakdown.flat.toPounds()).toBe(1);
      expect(breakdown.total.toPounds()).toBe(6);
    });
  });

  describe("given a tariff with time-based pricing", () => {
    const tariff: Tariff = {
      currency: "GBP",
      elements: [
        {
          price_components: [
            { type: "ENERGY", price: 0.20, step_size: 1 },
            { type: "TIME", price: 0.10, step_size: 1 },
          ],
        },
      ],
    };

    it("charges for both energy and time (30 mins = £3)", () => {
      const session: OcpiSession = {
        start_date_time: "2025-12-26T11:00:00Z",
        end_date_time: "2025-12-26T11:30:00Z",
        kwh: 25,
        charging_periods: [],
      };

      const breakdown = OcpiCostCalculator.calculate(session, tariff);

      expect(breakdown.energy.toPounds()).toBe(5);
      expect(breakdown.time.toPounds()).toBe(3);
      expect(breakdown.total.toPounds()).toBe(8);
    });
  });

  describe("given a tariff with parking/idle fees", () => {
    const tariff: Tariff = {
      currency: "GBP",
      elements: [
        {
          price_components: [
            { type: "ENERGY", price: 0.30, step_size: 1 },
            { type: "PARKING_TIME", price: 0.20, step_size: 1 },
          ],
        },
      ],
    };

    it("charges idle fee when car remains plugged in after charging", () => {
      const session: OcpiSession = {
        start_date_time: "2025-12-26T08:00:00Z",
        end_date_time: "2025-12-26T09:00:00Z",
        kwh: 40,
        total_parking_time: 15,
        charging_periods: [],
      };

      const breakdown = OcpiCostCalculator.calculate(session, tariff);

      expect(breakdown.energy.toPounds()).toBe(12);
      expect(breakdown.parking.toPounds()).toBe(3);
      expect(breakdown.total.toPounds()).toBe(15);
    });
  });

  describe("given a tariff with VAT", () => {
    const tariff: Tariff = {
      currency: "GBP",
      elements: [
        {
          price_components: [
            { type: "ENERGY", price: 0.30, step_size: 1, vat: 20 },
          ],
        },
      ],
    };

    it("calculates 20% VAT on top of energy cost", () => {
      const session: OcpiSession = {
        start_date_time: "2025-12-26T12:00:00Z",
        end_date_time: "2025-12-26T12:45:00Z",
        kwh: 50,
        charging_periods: [],
      };

      const breakdown = OcpiCostCalculator.calculate(session, tariff);

      expect(breakdown.energy.toPounds()).toBe(15);
      expect(breakdown.vat.toPounds()).toBe(3);
      expect(breakdown.total.toPounds()).toBe(18);
    });
  });

  describe("given a complex multi-element tariff", () => {
    const tariff: Tariff = {
      currency: "GBP",
      elements: [
        {
          price_components: [
            { type: "FLAT", price: 0.50, step_size: 0, vat: 20 },
            { type: "ENERGY", price: 0.35, step_size: 1, vat: 20 },
            { type: "TIME", price: 0.05, step_size: 5, vat: 20 },
            { type: "PARKING_TIME", price: 0.25, step_size: 1, vat: 20 },
          ],
        },
      ],
    };

    it("calculates all components with VAT for a typical motorway charge", () => {
      const session: OcpiSession = {
        start_date_time: "2025-12-26T15:00:00Z",
        end_date_time: "2025-12-26T15:35:00Z",
        kwh: 45,
        total_parking_time: 5,
        charging_periods: [],
      };

      const breakdown = OcpiCostCalculator.calculate(session, tariff);

      expect(breakdown.flat.toPounds()).toBe(0.50);
      expect(breakdown.energy.toPounds()).toBe(15.75);
      expect(breakdown.time.toPounds()).toBe(1.75);
      expect(breakdown.parking.toPounds()).toBe(1.25);
      expect(breakdown.subtotal.toPounds()).toBe(19.25);
      expect(breakdown.vat.toPounds()).toBe(3.85);
      expect(breakdown.total.toPounds()).toBe(23.10);
    });
  });

  describe("given step size billing", () => {
    const tariff: Tariff = {
      currency: "GBP",
      elements: [
        {
          price_components: [
            { type: "ENERGY", price: 0.30, step_size: 5 },
          ],
        },
      ],
    };

    it("rounds up to nearest 5 kWh step", () => {
      const session: OcpiSession = {
        start_date_time: "2025-12-26T10:00:00Z",
        end_date_time: "2025-12-26T10:30:00Z",
        kwh: 12,
        charging_periods: [],
      };

      const breakdown = OcpiCostCalculator.calculate(session, tariff);

      expect(breakdown.energy.toPounds()).toBe(4.50);
    });

    it("charges exactly for whole steps", () => {
      const session: OcpiSession = {
        start_date_time: "2025-12-26T10:00:00Z",
        end_date_time: "2025-12-26T10:30:00Z",
        kwh: 15,
        charging_periods: [],
      };

      const breakdown = OcpiCostCalculator.calculate(session, tariff);

      expect(breakdown.energy.toPounds()).toBe(4.50);
    });
  });

  describe("formatting for receipts", () => {
    it("formats breakdown with £ symbol", () => {
      const tariff: Tariff = {
        currency: "GBP",
        elements: [
          {
            price_components: [
              { type: "ENERGY", price: 0.30, step_size: 1, vat: 20 },
              { type: "FLAT", price: 1.00, step_size: 0, vat: 20 },
            ],
          },
        ],
      };

      const session: OcpiSession = {
        start_date_time: "2025-12-26T10:00:00Z",
        end_date_time: "2025-12-26T10:45:00Z",
        kwh: 50,
        charging_periods: [],
      };

      const breakdown = OcpiCostCalculator.calculate(session, tariff);
      const formatted = OcpiCostCalculator.formatBreakdown(breakdown);

      expect(formatted.energy_cost).toBe("£15.00");
      expect(formatted.flat_fee).toBe("£1.00");
      expect(formatted.subtotal).toBe("£16.00");
      expect(formatted.vat_amount).toBe("£3.20");
      expect(formatted.total_amount).toBe("£19.20");
    });

    it("formats with € symbol for European chargers", () => {
      const tariff: Tariff = {
        currency: "EUR",
        elements: [
          {
            price_components: [
              { type: "ENERGY", price: 0.40, step_size: 1 },
            ],
          },
        ],
      };

      const session: OcpiSession = {
        start_date_time: "2025-12-26T10:00:00Z",
        end_date_time: "2025-12-26T10:30:00Z",
        kwh: 30,
        charging_periods: [],
      };

      const breakdown = OcpiCostCalculator.calculate(session, tariff);
      const formatted = OcpiCostCalculator.formatBreakdown(breakdown, "€");

      expect(formatted.energy_cost).toBe("€12.00");
      expect(formatted.total_amount).toBe("€12.00");
    });
  });

  describe("given charging_periods from the charger", () => {
    const tariff: Tariff = {
      currency: "GBP",
      elements: [
        {
          price_components: [
            { type: "ENERGY", price: 0.30, step_size: 1, vat: 20 },
            { type: "TIME", price: 0.05, step_size: 1, vat: 20 },
          ],
        },
      ],
    };

    it("calculates from single charging period", () => {
      const session: OcpiSession = {
        start_date_time: "2025-12-26T10:00:00Z",
        end_date_time: "2025-12-26T10:45:00Z",
        kwh: 0,
        charging_periods: [
          {
            start_date_time: "2025-12-26T10:00:00Z",
            dimensions: [
              { type: "ENERGY", volume: 45 },
              { type: "TIME", volume: 45 },
            ],
          },
        ],
      };

      const breakdown = OcpiCostCalculator.calculate(session, tariff);

      expect(breakdown.energy.toPounds()).toBe(13.50);
      expect(breakdown.time.toPounds()).toBe(2.25);
      expect(breakdown.subtotal.toPounds()).toBe(15.75);
    });

    it("sums volumes across multiple charging periods", () => {
      const session: OcpiSession = {
        start_date_time: "2025-12-26T10:00:00Z",
        end_date_time: "2025-12-26T11:30:00Z",
        kwh: 0,
        charging_periods: [
          {
            start_date_time: "2025-12-26T10:00:00Z",
            dimensions: [
              { type: "ENERGY", volume: 25 },
              { type: "TIME", volume: 30 },
            ],
          },
          {
            start_date_time: "2025-12-26T10:30:00Z",
            dimensions: [
              { type: "ENERGY", volume: 35 },
              { type: "TIME", volume: 60 },
            ],
          },
        ],
      };

      const breakdown = OcpiCostCalculator.calculate(session, tariff);

      expect(breakdown.energy.toPounds()).toBe(18);
      expect(breakdown.time.toPounds()).toBe(4.50);
    });

    it("handles periods with different dimension types", () => {
      const tariffWithParking: Tariff = {
        currency: "GBP",
        elements: [
          {
            price_components: [
              { type: "ENERGY", price: 0.35, step_size: 1 },
              { type: "TIME", price: 0.10, step_size: 1 },
              { type: "PARKING_TIME", price: 0.25, step_size: 1 },
            ],
          },
        ],
      };

      const session: OcpiSession = {
        start_date_time: "2025-12-26T14:00:00Z",
        end_date_time: "2025-12-26T15:00:00Z",
        kwh: 0,
        charging_periods: [
          {
            start_date_time: "2025-12-26T14:00:00Z",
            dimensions: [
              { type: "ENERGY", volume: 40 },
              { type: "TIME", volume: 35 },
            ],
          },
          {
            start_date_time: "2025-12-26T14:35:00Z",
            dimensions: [
              { type: "PARKING_TIME", volume: 25 },
            ],
          },
        ],
      };

      const breakdown = OcpiCostCalculator.calculate(session, tariffWithParking);

      expect(breakdown.energy.toPounds()).toBe(14);
      expect(breakdown.time.toPounds()).toBe(3.50);
      expect(breakdown.parking.toPounds()).toBe(6.25);
      expect(breakdown.total.toPounds()).toBe(23.75);
    });

    it("uses periods instead of session totals when periods exist", () => {
      const session: OcpiSession = {
        start_date_time: "2025-12-26T10:00:00Z",
        end_date_time: "2025-12-26T10:45:00Z",
        kwh: 100,
        total_energy: 100,
        total_time: 100,
        charging_periods: [
          {
            start_date_time: "2025-12-26T10:00:00Z",
            dimensions: [
              { type: "ENERGY", volume: 20 },
              { type: "TIME", volume: 15 },
            ],
          },
        ],
      };

      const breakdown = OcpiCostCalculator.calculate(session, tariff);

      expect(breakdown.energy.toPounds()).toBe(6);
      expect(breakdown.time.toPounds()).toBe(0.75);
    });
  });

  describe("given tariff restrictions", () => {
    describe("grace period (min_duration)", () => {
      const tariffWithGracePeriod: Tariff = {
        currency: "GBP",
        elements: [
          {
            price_components: [
              { type: "ENERGY", price: 0.30, step_size: 1 },
            ],
          },
          {
            price_components: [
              { type: "PARKING_TIME", price: 0.50, step_size: 1 },
            ],
            restrictions: {
              min_duration: 600,
            },
          },
        ],
      };

      it("waives parking fee within grace period", () => {
        const session: OcpiSession = {
          start_date_time: "2025-12-26T10:00:00Z",
          end_date_time: "2025-12-26T10:30:00Z",
          kwh: 40,
          total_parking_time: 8,
          charging_periods: [],
        };

        const breakdown = OcpiCostCalculator.calculate(session, tariffWithGracePeriod);

        expect(breakdown.energy.toPounds()).toBe(12);
        expect(breakdown.parking.toPounds()).toBe(0);
        expect(breakdown.total.toPounds()).toBe(12);
      });

      it("charges for parking time beyond grace period", () => {
        const session: OcpiSession = {
          start_date_time: "2025-12-26T10:00:00Z",
          end_date_time: "2025-12-26T11:00:00Z",
          kwh: 40,
          total_parking_time: 25,
          charging_periods: [],
        };

        const breakdown = OcpiCostCalculator.calculate(session, tariffWithGracePeriod);

        expect(breakdown.energy.toPounds()).toBe(12);
        expect(breakdown.parking.toPounds()).toBe(7.50);
        expect(breakdown.total.toPounds()).toBe(19.50);
      });
    });

    describe("max_duration cap", () => {
      const tariffWithMaxDuration: Tariff = {
        currency: "GBP",
        elements: [
          {
            price_components: [
              { type: "ENERGY", price: 0.30, step_size: 1 },
            ],
          },
          {
            price_components: [
              { type: "PARKING_TIME", price: 0.25, step_size: 1 },
            ],
            restrictions: {
              max_duration: 1800,
            },
          },
        ],
      };

      it("caps parking charge at max duration", () => {
        const session: OcpiSession = {
          start_date_time: "2025-12-26T10:00:00Z",
          end_date_time: "2025-12-26T12:00:00Z",
          kwh: 50,
          total_parking_time: 60,
          charging_periods: [],
        };

        const breakdown = OcpiCostCalculator.calculate(session, tariffWithMaxDuration);

        expect(breakdown.energy.toPounds()).toBe(15);
        expect(breakdown.parking.toPounds()).toBe(7.50);
        expect(breakdown.total.toPounds()).toBe(22.50);
      });
    });

    describe("day of week restrictions", () => {
      const weekendTariff: Tariff = {
        currency: "GBP",
        elements: [
          {
            price_components: [
              { type: "ENERGY", price: 0.25, step_size: 1 },
            ],
          },
          {
            price_components: [
              { type: "FLAT", price: 2.00, step_size: 0 },
            ],
            restrictions: {
              day_of_week: ["SATURDAY", "SUNDAY"],
            },
          },
        ],
      };

      it("applies weekend surcharge on Saturday", () => {
        const session: OcpiSession = {
          start_date_time: "2025-12-27T10:00:00Z",
          end_date_time: "2025-12-27T10:30:00Z",
          kwh: 40,
          charging_periods: [],
        };

        const breakdown = OcpiCostCalculator.calculate(session, weekendTariff);

        expect(breakdown.energy.toPounds()).toBe(10);
        expect(breakdown.flat.toPounds()).toBe(2);
        expect(breakdown.total.toPounds()).toBe(12);
      });

      it("skips weekend surcharge on weekday", () => {
        const session: OcpiSession = {
          start_date_time: "2025-12-26T10:00:00Z",
          end_date_time: "2025-12-26T10:30:00Z",
          kwh: 40,
          charging_periods: [],
        };

        const breakdown = OcpiCostCalculator.calculate(session, weekendTariff);

        expect(breakdown.energy.toPounds()).toBe(10);
        expect(breakdown.flat.toPounds()).toBe(0);
        expect(breakdown.total.toPounds()).toBe(10);
      });
    });

    describe("time of day restrictions", () => {
      const peakTariff: Tariff = {
        currency: "GBP",
        elements: [
          {
            price_components: [
              { type: "ENERGY", price: 0.25, step_size: 1 },
            ],
          },
          {
            price_components: [
              { type: "ENERGY", price: 0.10, step_size: 1 },
            ],
            restrictions: {
              start_time: "17:00",
              end_time: "21:00",
            },
          },
        ],
      };

      it("applies peak surcharge during rush hour", () => {
        const session: OcpiSession = {
          start_date_time: "2025-12-26T18:00:00Z",
          end_date_time: "2025-12-26T18:30:00Z",
          kwh: 30,
          charging_periods: [],
        };

        const breakdown = OcpiCostCalculator.calculate(session, peakTariff);

        expect(breakdown.energy.toPounds()).toBe(10.50);
      });

      it("skips peak surcharge outside rush hour", () => {
        const session: OcpiSession = {
          start_date_time: "2025-12-26T10:00:00Z",
          end_date_time: "2025-12-26T10:30:00Z",
          kwh: 30,
          charging_periods: [],
        };

        const breakdown = OcpiCostCalculator.calculate(session, peakTariff);

        expect(breakdown.energy.toPounds()).toBe(7.50);
      });
    });

    describe("energy-based restrictions", () => {
      const bulkDiscountTariff: Tariff = {
        currency: "GBP",
        elements: [
          {
            price_components: [
              { type: "ENERGY", price: 0.35, step_size: 1 },
            ],
          },
          {
            price_components: [
              { type: "FLAT", price: -5.00, step_size: 0 },
            ],
            restrictions: {
              min_kwh: 50,
            },
          },
        ],
      };

      it("applies bulk discount for large charge", () => {
        const session: OcpiSession = {
          start_date_time: "2025-12-26T10:00:00Z",
          end_date_time: "2025-12-26T11:00:00Z",
          kwh: 60,
          charging_periods: [],
        };

        const breakdown = OcpiCostCalculator.calculate(session, bulkDiscountTariff);

        expect(breakdown.energy.toPounds()).toBe(21);
        expect(breakdown.flat.toPounds()).toBe(-5);
        expect(breakdown.total.toPounds()).toBe(16);
      });

      it("skips bulk discount for small charge", () => {
        const session: OcpiSession = {
          start_date_time: "2025-12-26T10:00:00Z",
          end_date_time: "2025-12-26T10:30:00Z",
          kwh: 30,
          charging_periods: [],
        };

        const breakdown = OcpiCostCalculator.calculate(session, bulkDiscountTariff);

        expect(breakdown.energy.toPounds()).toBe(10.50);
        expect(breakdown.flat.toPounds()).toBe(0);
        expect(breakdown.total.toPounds()).toBe(10.50);
      });
    });

    describe("combined grace period and max duration", () => {
      const restrictedParkingTariff: Tariff = {
        currency: "GBP",
        elements: [
          {
            price_components: [
              { type: "ENERGY", price: 0.30, step_size: 1 },
            ],
          },
          {
            price_components: [
              { type: "PARKING_TIME", price: 1.00, step_size: 1 },
            ],
            restrictions: {
              min_duration: 300,
              max_duration: 1800,
            },
          },
        ],
      };

      it("applies both grace and cap to parking fees", () => {
        const session: OcpiSession = {
          start_date_time: "2025-12-26T10:00:00Z",
          end_date_time: "2025-12-26T11:30:00Z",
          kwh: 40,
          total_parking_time: 50,
          charging_periods: [],
        };

        const breakdown = OcpiCostCalculator.calculate(session, restrictedParkingTariff);

        expect(breakdown.energy.toPounds()).toBe(12);
        expect(breakdown.parking.toPounds()).toBe(30);
        expect(breakdown.total.toPounds()).toBe(42);
      });
    });
  });

  describe("real-world idle fee scenarios", () => {
    describe("Tesco supermarket charging (free charging with idle fee after grace)", () => {
      const tescoTariff: Tariff = {
        currency: "GBP",
        elements: [
          {
            price_components: [
              { type: "ENERGY", price: 0.00, step_size: 1 },
            ],
          },
          {
            price_components: [
              { type: "PARKING_TIME", price: 0.10, step_size: 1 },
            ],
            restrictions: {
              min_duration: 2700,
            },
          },
        ],
      };

      it("charges nothing when driver returns within 45 minutes", () => {
        const session: OcpiSession = {
          start_date_time: "2025-12-26T14:00:00Z",
          end_date_time: "2025-12-26T14:40:00Z",
          kwh: 8,
          total_parking_time: 40,
          charging_periods: [],
        };

        const breakdown = OcpiCostCalculator.calculate(session, tescoTariff);

        expect(breakdown.energy.toPounds()).toBe(0);
        expect(breakdown.parking.toPounds()).toBe(0);
        expect(breakdown.total.toPounds()).toBe(0);
      });

      it("charges idle fee when driver overstays their shopping trip", () => {
        const session: OcpiSession = {
          start_date_time: "2025-12-26T14:00:00Z",
          end_date_time: "2025-12-26T15:30:00Z",
          kwh: 12,
          total_parking_time: 75,
          charging_periods: [],
        };

        const breakdown = OcpiCostCalculator.calculate(session, tescoTariff);

        expect(breakdown.energy.toPounds()).toBe(0);
        expect(breakdown.parking.toPounds()).toBe(3);
        expect(breakdown.total.toPounds()).toBe(3);
      });
    });

    describe("motorway services (Gridserve-style with escalating idle fees)", () => {
      const motorwayTariff: Tariff = {
        currency: "GBP",
        elements: [
          {
            price_components: [
              { type: "FLAT", price: 0.99, step_size: 0, vat: 20 },
              { type: "ENERGY", price: 0.79, step_size: 1, vat: 20 },
            ],
          },
          {
            price_components: [
              { type: "PARKING_TIME", price: 0.50, step_size: 1, vat: 20 },
            ],
            restrictions: {
              min_duration: 600,
              max_duration: 3600,
            },
          },
        ],
      };

      it("calculates typical rapid charge with quick departure", () => {
        const session: OcpiSession = {
          start_date_time: "2025-12-26T11:00:00Z",
          end_date_time: "2025-12-26T11:35:00Z",
          kwh: 50,
          total_parking_time: 5,
          charging_periods: [],
        };

        const breakdown = OcpiCostCalculator.calculate(session, motorwayTariff);

        expect(breakdown.flat.toPounds()).toBe(0.99);
        expect(breakdown.energy.toPounds()).toBe(39.50);
        expect(breakdown.parking.toPounds()).toBe(0);
        expect(breakdown.subtotal.toPounds()).toBe(40.49);
        expect(breakdown.vat.toPounds()).toBe(8.10);
      });

      it("adds idle fee when driver has a long lunch", () => {
        const session: OcpiSession = {
          start_date_time: "2025-12-26T12:00:00Z",
          end_date_time: "2025-12-26T13:15:00Z",
          kwh: 60,
          total_parking_time: 45,
          charging_periods: [],
        };

        const breakdown = OcpiCostCalculator.calculate(session, motorwayTariff);

        expect(breakdown.energy.toPounds()).toBe(47.40);
        expect(breakdown.parking.toPounds()).toBe(17.50);
      });

      it("caps idle fee at maximum duration for abandoned vehicles", () => {
        const session: OcpiSession = {
          start_date_time: "2025-12-26T10:00:00Z",
          end_date_time: "2025-12-26T14:00:00Z",
          kwh: 80,
          total_parking_time: 180,
          charging_periods: [],
        };

        const breakdown = OcpiCostCalculator.calculate(session, motorwayTariff);

        expect(breakdown.parking.toPounds()).toBe(30);
      });
    });

    describe("workplace charging (free weekdays, paid weekends)", () => {
      const workplaceTariff: Tariff = {
        currency: "GBP",
        elements: [
          {
            price_components: [
              { type: "ENERGY", price: 0.00, step_size: 1 },
            ],
            restrictions: {
              day_of_week: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
            },
          },
          {
            price_components: [
              { type: "ENERGY", price: 0.35, step_size: 1 },
            ],
            restrictions: {
              day_of_week: ["SATURDAY", "SUNDAY"],
            },
          },
          {
            price_components: [
              { type: "PARKING_TIME", price: 0.25, step_size: 1, vat: 20 },
            ],
            restrictions: {
              day_of_week: ["SATURDAY", "SUNDAY"],
              min_duration: 1800,
            },
          },
        ],
      };

      it("provides free charging during work hours", () => {
        const session: OcpiSession = {
          start_date_time: "2025-12-29T09:00:00Z",
          end_date_time: "2025-12-29T17:00:00Z",
          kwh: 25,
          total_parking_time: 0,
          charging_periods: [],
        };

        const breakdown = OcpiCostCalculator.calculate(session, workplaceTariff);

        expect(breakdown.energy.toPounds()).toBe(0);
        expect(breakdown.parking.toPounds()).toBe(0);
        expect(breakdown.total.toPounds()).toBe(0);
      });

      it("charges for weekend use with idle fees", () => {
        const session: OcpiSession = {
          start_date_time: "2025-12-27T10:00:00Z",
          end_date_time: "2025-12-27T12:00:00Z",
          kwh: 30,
          total_parking_time: 60,
          charging_periods: [],
        };

        const breakdown = OcpiCostCalculator.calculate(session, workplaceTariff);

        expect(breakdown.energy.toPounds()).toBe(10.50);
        expect(breakdown.parking.toPounds()).toBe(7.50);
      });
    });

    describe("hotel destination charging (overnight with no idle fee)", () => {
      const hotelTariff: Tariff = {
        currency: "GBP",
        elements: [
          {
            price_components: [
              { type: "ENERGY", price: 0.45, step_size: 1, vat: 20 },
            ],
          },
          {
            price_components: [
              { type: "FLAT", price: 5.00, step_size: 0, vat: 20 },
            ],
            restrictions: {
              start_time: "18:00",
              end_time: "23:59",
            },
          },
        ],
      };

      it("adds overnight service fee for evening arrivals", () => {
        const session: OcpiSession = {
          start_date_time: "2025-12-26T19:00:00Z",
          end_date_time: "2025-12-27T07:00:00Z",
          kwh: 60,
          charging_periods: [],
        };

        const breakdown = OcpiCostCalculator.calculate(session, hotelTariff);

        expect(breakdown.energy.toPounds()).toBe(27);
        expect(breakdown.flat.toPounds()).toBe(5);
        expect(breakdown.subtotal.toPounds()).toBe(32);
      });

      it("skips overnight fee for daytime charging", () => {
        const session: OcpiSession = {
          start_date_time: "2025-12-26T10:00:00Z",
          end_date_time: "2025-12-26T14:00:00Z",
          kwh: 40,
          charging_periods: [],
        };

        const breakdown = OcpiCostCalculator.calculate(session, hotelTariff);

        expect(breakdown.energy.toPounds()).toBe(18);
        expect(breakdown.flat.toPounds()).toBe(0);
      });
    });

    describe("council on-street charging (multiple parking periods via charging_periods)", () => {
      const councilTariff: Tariff = {
        currency: "GBP",
        elements: [
          {
            price_components: [
              { type: "ENERGY", price: 0.40, step_size: 1, vat: 5 },
              { type: "TIME", price: 0.05, step_size: 1, vat: 5 },
              { type: "PARKING_TIME", price: 0.15, step_size: 1, vat: 5 },
            ],
          },
        ],
      };

      it("sums multiple parking periods from charger data", () => {
        const session: OcpiSession = {
          start_date_time: "2025-12-26T09:00:00Z",
          end_date_time: "2025-12-26T17:00:00Z",
          kwh: 0,
          charging_periods: [
            {
              start_date_time: "2025-12-26T09:00:00Z",
              dimensions: [
                { type: "ENERGY", volume: 15 },
                { type: "TIME", volume: 60 },
              ],
            },
            {
              start_date_time: "2025-12-26T10:00:00Z",
              dimensions: [
                { type: "PARKING_TIME", volume: 120 },
              ],
            },
            {
              start_date_time: "2025-12-26T12:00:00Z",
              dimensions: [
                { type: "ENERGY", volume: 10 },
                { type: "TIME", volume: 45 },
              ],
            },
            {
              start_date_time: "2025-12-26T12:45:00Z",
              dimensions: [
                { type: "PARKING_TIME", volume: 180 },
              ],
            },
          ],
        };

        const breakdown = OcpiCostCalculator.calculate(session, councilTariff);

        expect(breakdown.energy.toPounds()).toBe(10);
        expect(breakdown.time.toPounds()).toBe(5.25);
        expect(breakdown.parking.toPounds()).toBe(45);
        expect(breakdown.subtotal.toPounds()).toBe(60.25);
      });

      it("handles interleaved charging and parking periods", () => {
        const session: OcpiSession = {
          start_date_time: "2025-12-26T08:00:00Z",
          end_date_time: "2025-12-26T12:00:00Z",
          kwh: 0,
          charging_periods: [
            {
              start_date_time: "2025-12-26T08:00:00Z",
              dimensions: [
                { type: "ENERGY", volume: 20 },
                { type: "TIME", volume: 30 },
              ],
            },
            {
              start_date_time: "2025-12-26T08:30:00Z",
              dimensions: [
                { type: "PARKING_TIME", volume: 30 },
              ],
            },
            {
              start_date_time: "2025-12-26T09:00:00Z",
              dimensions: [
                { type: "ENERGY", volume: 15 },
                { type: "TIME", volume: 45 },
              ],
            },
            {
              start_date_time: "2025-12-26T09:45:00Z",
              dimensions: [
                { type: "PARKING_TIME", volume: 90 },
              ],
            },
            {
              start_date_time: "2025-12-26T11:15:00Z",
              dimensions: [
                { type: "ENERGY", volume: 5 },
                { type: "TIME", volume: 15 },
              ],
            },
          ],
        };

        const breakdown = OcpiCostCalculator.calculate(session, councilTariff);

        expect(breakdown.energy.toPounds()).toBe(16);
        expect(breakdown.time.toPounds()).toBe(4.50);
        expect(breakdown.parking.toPounds()).toBe(18);
      });
    });

    describe("fleet depot charging (tiered pricing by consumption)", () => {
      const depotTariff: Tariff = {
        currency: "GBP",
        elements: [
          {
            price_components: [
              { type: "ENERGY", price: 0.28, step_size: 1 },
            ],
          },
          {
            price_components: [
              { type: "FLAT", price: -10.00, step_size: 0 },
            ],
            restrictions: {
              min_kwh: 100,
            },
          },
          {
            price_components: [
              { type: "PARKING_TIME", price: 2.00, step_size: 1 },
            ],
            restrictions: {
              min_duration: 3600,
              max_duration: 7200,
            },
          },
        ],
      };

      it("applies fleet discount for large battery top-up", () => {
        const session: OcpiSession = {
          start_date_time: "2025-12-26T22:00:00Z",
          end_date_time: "2025-12-27T06:00:00Z",
          kwh: 150,
          total_parking_time: 0,
          charging_periods: [],
        };

        const breakdown = OcpiCostCalculator.calculate(session, depotTariff);

        expect(breakdown.energy.toPounds()).toBe(42);
        expect(breakdown.flat.toPounds()).toBe(-10);
        expect(breakdown.total.toPounds()).toBe(32);
      });

      it("charges idle fee when vehicle blocks charger during peak demand", () => {
        const session: OcpiSession = {
          start_date_time: "2025-12-26T06:00:00Z",
          end_date_time: "2025-12-26T10:00:00Z",
          kwh: 80,
          total_parking_time: 180,
          charging_periods: [],
        };

        const breakdown = OcpiCostCalculator.calculate(session, depotTariff);

        expect(breakdown.energy.toPounds()).toBe(22.40);
        expect(breakdown.parking.toPounds()).toBe(240);
        expect(breakdown.flat.toPounds()).toBe(0);
      });
    });
  });

  describe("real-world idle fee scenarios using charging_periods", () => {
    describe("Tesco supermarket with charging_periods data", () => {
      const tescoTariff: Tariff = {
        currency: "GBP",
        elements: [
          {
            price_components: [
              { type: "ENERGY", price: 0.00, step_size: 1 },
            ],
          },
          {
            price_components: [
              { type: "PARKING_TIME", price: 0.10, step_size: 1 },
            ],
            restrictions: {
              min_duration: 2700,
            },
          },
        ],
      };

      it("calculates from charging_periods when driver shops within grace", () => {
        const session: OcpiSession = {
          start_date_time: "2025-12-26T14:00:00Z",
          end_date_time: "2025-12-26T14:40:00Z",
          kwh: 0,
          charging_periods: [
            {
              start_date_time: "2025-12-26T14:00:00Z",
              dimensions: [
                { type: "ENERGY", volume: 8 },
                { type: "TIME", volume: 25 },
              ],
            },
            {
              start_date_time: "2025-12-26T14:25:00Z",
              dimensions: [
                { type: "PARKING_TIME", volume: 15 },
              ],
            },
          ],
        };

        const breakdown = OcpiCostCalculator.calculate(session, tescoTariff);

        expect(breakdown.energy.toPounds()).toBe(0);
        expect(breakdown.parking.toPounds()).toBe(0);
      });

      it("charges overstay from charging_periods data", () => {
        const session: OcpiSession = {
          start_date_time: "2025-12-26T14:00:00Z",
          end_date_time: "2025-12-26T15:30:00Z",
          kwh: 0,
          charging_periods: [
            {
              start_date_time: "2025-12-26T14:00:00Z",
              dimensions: [
                { type: "ENERGY", volume: 12 },
                { type: "TIME", volume: 30 },
              ],
            },
            {
              start_date_time: "2025-12-26T14:30:00Z",
              dimensions: [
                { type: "PARKING_TIME", volume: 60 },
              ],
            },
          ],
        };

        const breakdown = OcpiCostCalculator.calculate(session, tescoTariff);

        expect(breakdown.energy.toPounds()).toBe(0);
        expect(breakdown.parking.toPounds()).toBe(1.50);
      });
    });

    describe("motorway services with detailed charging_periods", () => {
      const motorwayTariff: Tariff = {
        currency: "GBP",
        elements: [
          {
            price_components: [
              { type: "FLAT", price: 0.99, step_size: 0, vat: 20 },
              { type: "ENERGY", price: 0.79, step_size: 1, vat: 20 },
            ],
          },
          {
            price_components: [
              { type: "PARKING_TIME", price: 0.50, step_size: 1, vat: 20 },
            ],
            restrictions: {
              min_duration: 600,
              max_duration: 3600,
            },
          },
        ],
      };

      it("handles rapid charge with quick unplug via charging_periods", () => {
        const session: OcpiSession = {
          start_date_time: "2025-12-26T11:00:00Z",
          end_date_time: "2025-12-26T11:35:00Z",
          kwh: 0,
          charging_periods: [
            {
              start_date_time: "2025-12-26T11:00:00Z",
              dimensions: [
                { type: "ENERGY", volume: 50 },
                { type: "TIME", volume: 30 },
              ],
            },
            {
              start_date_time: "2025-12-26T11:30:00Z",
              dimensions: [
                { type: "PARKING_TIME", volume: 5 },
              ],
            },
          ],
        };

        const breakdown = OcpiCostCalculator.calculate(session, motorwayTariff);

        expect(breakdown.flat.toPounds()).toBe(0.99);
        expect(breakdown.energy.toPounds()).toBe(39.50);
        expect(breakdown.parking.toPounds()).toBe(0);
      });

      it("applies grace and cap from multiple parking periods", () => {
        const session: OcpiSession = {
          start_date_time: "2025-12-26T12:00:00Z",
          end_date_time: "2025-12-26T14:30:00Z",
          kwh: 0,
          charging_periods: [
            {
              start_date_time: "2025-12-26T12:00:00Z",
              dimensions: [
                { type: "ENERGY", volume: 40 },
                { type: "TIME", volume: 25 },
              ],
            },
            {
              start_date_time: "2025-12-26T12:25:00Z",
              dimensions: [
                { type: "PARKING_TIME", volume: 35 },
              ],
            },
            {
              start_date_time: "2025-12-26T13:00:00Z",
              dimensions: [
                { type: "ENERGY", volume: 20 },
                { type: "TIME", volume: 15 },
              ],
            },
            {
              start_date_time: "2025-12-26T13:15:00Z",
              dimensions: [
                { type: "PARKING_TIME", volume: 75 },
              ],
            },
          ],
        };

        const breakdown = OcpiCostCalculator.calculate(session, motorwayTariff);

        expect(breakdown.energy.toPounds()).toBe(47.40);
       
        expect(breakdown.parking.toPounds()).toBe(30);
      });
    });

    describe("office car park with weekend pricing via charging_periods", () => {
      const officeTariff: Tariff = {
        currency: "GBP",
        elements: [
          {
            price_components: [
              { type: "ENERGY", price: 0.00, step_size: 1 },
            ],
            restrictions: {
              day_of_week: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
            },
          },
          {
            price_components: [
              { type: "ENERGY", price: 0.30, step_size: 1 },
            ],
            restrictions: {
              day_of_week: ["SATURDAY", "SUNDAY"],
            },
          },
          {
            price_components: [
              { type: "PARKING_TIME", price: 0.20, step_size: 1 },
            ],
            restrictions: {
              day_of_week: ["SATURDAY", "SUNDAY"],
              min_duration: 1800,
            },
          },
        ],
      };

      it("tracks multiple idle periods on weekend from charging_periods", () => {
        const session: OcpiSession = {
          start_date_time: "2025-12-27T09:00:00Z",
          end_date_time: "2025-12-27T14:00:00Z",
          kwh: 0,
          charging_periods: [
            {
              start_date_time: "2025-12-27T09:00:00Z",
              dimensions: [
                { type: "ENERGY", volume: 20 },
                { type: "TIME", volume: 60 },
              ],
            },
            {
              start_date_time: "2025-12-27T10:00:00Z",
              dimensions: [
                { type: "PARKING_TIME", volume: 60 },
              ],
            },
            {
              start_date_time: "2025-12-27T11:00:00Z",
              dimensions: [
                { type: "ENERGY", volume: 15 },
                { type: "TIME", volume: 45 },
              ],
            },
            {
              start_date_time: "2025-12-27T11:45:00Z",
              dimensions: [
                { type: "PARKING_TIME", volume: 135 },
              ],
            },
          ],
        };

        const breakdown = OcpiCostCalculator.calculate(session, officeTariff);

        expect(breakdown.energy.toPounds()).toBe(10.50);
       
        expect(breakdown.parking.toPounds()).toBe(33);
      });
    });

    describe("public charging hub with mixed charging patterns", () => {
      const hubTariff: Tariff = {
        currency: "GBP",
        elements: [
          {
            price_components: [
              { type: "ENERGY", price: 0.45, step_size: 1, vat: 20 },
              { type: "TIME", price: 0.08, step_size: 1, vat: 20 },
            ],
          },
          {
            price_components: [
              { type: "PARKING_TIME", price: 0.25, step_size: 1, vat: 20 },
            ],
            restrictions: {
              min_duration: 900,
            },
          },
        ],
      };

      it("handles driver who tops up, leaves, returns, and overstays", () => {
        const session: OcpiSession = {
          start_date_time: "2025-12-26T10:00:00Z",
          end_date_time: "2025-12-26T13:00:00Z",
          kwh: 0,
          charging_periods: [
            {
              start_date_time: "2025-12-26T10:00:00Z",
              dimensions: [
                { type: "ENERGY", volume: 25 },
                { type: "TIME", volume: 20 },
              ],
            },
            {
              start_date_time: "2025-12-26T10:20:00Z",
              dimensions: [
                { type: "PARKING_TIME", volume: 10 },
              ],
            },
            {
              start_date_time: "2025-12-26T10:30:00Z",
              dimensions: [
                { type: "ENERGY", volume: 30 },
                { type: "TIME", volume: 25 },
              ],
            },
            {
              start_date_time: "2025-12-26T10:55:00Z",
              dimensions: [
                { type: "PARKING_TIME", volume: 65 },
              ],
            },
            {
              start_date_time: "2025-12-26T12:00:00Z",
              dimensions: [
                { type: "ENERGY", volume: 15 },
                { type: "TIME", volume: 15 },
              ],
            },
            {
              start_date_time: "2025-12-26T12:15:00Z",
              dimensions: [
                { type: "PARKING_TIME", volume: 45 },
              ],
            },
          ],
        };

        const breakdown = OcpiCostCalculator.calculate(session, hubTariff);

        expect(breakdown.energy.toPounds()).toBe(31.50);
        expect(breakdown.time.toPounds()).toBe(4.80);
       
        expect(breakdown.parking.toPounds()).toBe(26.25);
      });

      it("handles interleaved short parking periods all within grace", () => {
        const session: OcpiSession = {
          start_date_time: "2025-12-26T08:00:00Z",
          end_date_time: "2025-12-26T08:45:00Z",
          kwh: 0,
          charging_periods: [
            {
              start_date_time: "2025-12-26T08:00:00Z",
              dimensions: [
                { type: "ENERGY", volume: 15 },
                { type: "TIME", volume: 12 },
              ],
            },
            {
              start_date_time: "2025-12-26T08:12:00Z",
              dimensions: [
                { type: "PARKING_TIME", volume: 3 },
              ],
            },
            {
              start_date_time: "2025-12-26T08:15:00Z",
              dimensions: [
                { type: "ENERGY", volume: 20 },
                { type: "TIME", volume: 18 },
              ],
            },
            {
              start_date_time: "2025-12-26T08:33:00Z",
              dimensions: [
                { type: "PARKING_TIME", volume: 7 },
              ],
            },
            {
              start_date_time: "2025-12-26T08:40:00Z",
              dimensions: [
                { type: "ENERGY", volume: 5 },
                { type: "TIME", volume: 5 },
              ],
            },
          ],
        };

        const breakdown = OcpiCostCalculator.calculate(session, hubTariff);

        expect(breakdown.energy.toPounds()).toBe(18);
        expect(breakdown.time.toPounds()).toBe(2.80);
       
        expect(breakdown.parking.toPounds()).toBe(0);
      });
    });

    describe("fleet overnight charging with multiple vehicles queued", () => {
      const fleetTariff: Tariff = {
        currency: "GBP",
        elements: [
          {
            price_components: [
              { type: "ENERGY", price: 0.22, step_size: 1 },
            ],
          },
          {
            price_components: [
              { type: "FLAT", price: -15.00, step_size: 0 },
            ],
            restrictions: {
              min_kwh: 150,
            },
          },
          {
            price_components: [
              { type: "PARKING_TIME", price: 3.00, step_size: 1 },
            ],
            restrictions: {
              min_duration: 7200,
              max_duration: 10800,
            },
          },
        ],
      };

      it("calculates overnight fleet charge with extended parking periods", () => {
        const session: OcpiSession = {
          start_date_time: "2025-12-26T20:00:00Z",
          end_date_time: "2025-12-27T08:00:00Z",
          kwh: 0,
          charging_periods: [
            {
              start_date_time: "2025-12-26T20:00:00Z",
              dimensions: [
                { type: "ENERGY", volume: 80 },
                { type: "TIME", volume: 180 },
              ],
            },
            {
              start_date_time: "2025-12-26T23:00:00Z",
              dimensions: [
                { type: "PARKING_TIME", volume: 120 },
              ],
            },
            {
              start_date_time: "2025-12-27T01:00:00Z",
              dimensions: [
                { type: "ENERGY", volume: 100 },
                { type: "TIME", volume: 240 },
              ],
            },
            {
              start_date_time: "2025-12-27T05:00:00Z",
              dimensions: [
                { type: "PARKING_TIME", volume: 180 },
              ],
            },
          ],
        };

        const breakdown = OcpiCostCalculator.calculate(session, fleetTariff);

        expect(breakdown.energy.toPounds()).toBe(39.60);
        expect(breakdown.flat.toPounds()).toBe(-15);
       
        expect(breakdown.parking.toPounds()).toBe(540);
        expect(breakdown.total.toPounds()).toBe(564.60);
      });

      it("applies grace to multiple short parking gaps between vehicles", () => {
        const session: OcpiSession = {
          start_date_time: "2025-12-26T06:00:00Z",
          end_date_time: "2025-12-26T14:00:00Z",
          kwh: 0,
          charging_periods: [
            {
              start_date_time: "2025-12-26T06:00:00Z",
              dimensions: [
                { type: "ENERGY", volume: 60 },
                { type: "TIME", volume: 90 },
              ],
            },
            {
              start_date_time: "2025-12-26T07:30:00Z",
              dimensions: [
                { type: "PARKING_TIME", volume: 30 },
              ],
            },
            {
              start_date_time: "2025-12-26T08:00:00Z",
              dimensions: [
                { type: "ENERGY", volume: 50 },
                { type: "TIME", volume: 75 },
              ],
            },
            {
              start_date_time: "2025-12-26T09:15:00Z",
              dimensions: [
                { type: "PARKING_TIME", volume: 45 },
              ],
            },
            {
              start_date_time: "2025-12-26T10:00:00Z",
              dimensions: [
                { type: "ENERGY", volume: 40 },
                { type: "TIME", volume: 60 },
              ],
            },
            {
              start_date_time: "2025-12-26T11:00:00Z",
              dimensions: [
                { type: "PARKING_TIME", volume: 180 },
              ],
            },
          ],
        };

        const breakdown = OcpiCostCalculator.calculate(session, fleetTariff);

        expect(breakdown.energy.toPounds()).toBe(33);
        expect(breakdown.flat.toPounds()).toBe(-15);
       
        expect(breakdown.parking.toPounds()).toBe(405);
      });
    });
  });

  describe("given a Charge Detail Record (CDR)", () => {
    describe("CDR with embedded tariff", () => {
      it("calculates from CDR with single embedded tariff", () => {
        const cdr: Cdr = {
          id: "CDR-001",
          start_date_time: "2025-12-26T10:00:00Z",
          end_date_time: "2025-12-26T10:45:00Z",
          currency: "GBP",
          total_cost: 18.00,
          total_energy: 50,
          total_time: 45,
          charging_periods: [
            {
              start_date_time: "2025-12-26T10:00:00Z",
              dimensions: [
                { type: "ENERGY", volume: 50 },
                { type: "TIME", volume: 45 },
              ],
            },
          ],
          tariffs: [
            {
              currency: "GBP",
              elements: [
                {
                  price_components: [
                    { type: "ENERGY", price: 0.30, step_size: 1, vat: 20 },
                  ],
                },
              ],
            },
          ],
          last_updated: "2025-12-26T10:45:00Z",
        };

        const breakdown = OcpiCostCalculator.calculateFromCdr(cdr);

        expect(breakdown.energy.toPounds()).toBe(15);
        expect(breakdown.vat.toPounds()).toBe(3);
        expect(breakdown.total.toPounds()).toBe(18);
      });

      it("calculates from CDR with multiple tariff elements", () => {
        const cdr: Cdr = {
          id: "CDR-002",
          start_date_time: "2025-12-26T14:00:00Z",
          end_date_time: "2025-12-26T15:00:00Z",
          currency: "GBP",
          total_cost: 25.00,
          total_energy: 40,
          total_time: 60,
          total_parking_time: 15,
          charging_periods: [
            {
              start_date_time: "2025-12-26T14:00:00Z",
              dimensions: [
                { type: "ENERGY", volume: 40 },
                { type: "TIME", volume: 45 },
              ],
            },
            {
              start_date_time: "2025-12-26T14:45:00Z",
              dimensions: [
                { type: "PARKING_TIME", volume: 15 },
              ],
            },
          ],
          tariffs: [
            {
              currency: "GBP",
              elements: [
                {
                  price_components: [
                    { type: "FLAT", price: 1.00, step_size: 0 },
                    { type: "ENERGY", price: 0.35, step_size: 1 },
                    { type: "PARKING_TIME", price: 0.20, step_size: 1 },
                  ],
                },
              ],
            },
          ],
          last_updated: "2025-12-26T15:00:00Z",
        };

        const breakdown = OcpiCostCalculator.calculateFromCdr(cdr);

        expect(breakdown.flat.toPounds()).toBe(1);
        expect(breakdown.energy.toPounds()).toBe(14);
        expect(breakdown.parking.toPounds()).toBe(3);
        expect(breakdown.total.toPounds()).toBe(18);
      });
    });

    describe("CDR without embedded tariff (pre-calculated costs)", () => {
      it("uses pre-calculated costs from CDR when no tariff is provided", () => {
        const cdr: Cdr = {
          id: "CDR-003",
          start_date_time: "2025-12-26T09:00:00Z",
          end_date_time: "2025-12-26T10:00:00Z",
          currency: "GBP",
          total_cost: 22.50,
          total_fixed_cost: 0.99,
          total_energy: 45,
          total_energy_cost: 17.55,
          total_time: 60,
          total_time_cost: 3.00,
          total_parking_time: 5,
          total_parking_cost: 0.96,
          charging_periods: [],
          last_updated: "2025-12-26T10:00:00Z",
        };

        const breakdown = OcpiCostCalculator.calculateFromCdr(cdr);

        expect(breakdown.flat.toPounds()).toBe(0.99);
        expect(breakdown.energy.toPounds()).toBe(17.55);
        expect(breakdown.time.toPounds()).toBe(3);
        expect(breakdown.parking.toPounds()).toBe(0.96);
        expect(breakdown.total.toPounds()).toBe(22.50);
      });

      it("handles CDR with only total_cost (minimal data)", () => {
        const cdr: Cdr = {
          id: "CDR-004",
          start_date_time: "2025-12-26T12:00:00Z",
          end_date_time: "2025-12-26T12:30:00Z",
          currency: "EUR",
          total_cost: 15.00,
          total_energy: 30,
          total_time: 30,
          charging_periods: [],
          last_updated: "2025-12-26T12:30:00Z",
        };

        const breakdown = OcpiCostCalculator.calculateFromCdr(cdr);

        expect(breakdown.energy.toPounds()).toBe(0);
        expect(breakdown.total.toPounds()).toBe(15);
      });
    });

    describe("CDR with location and token details", () => {
      it("calculates correctly with full CDR metadata", () => {
        const cdr: Cdr = {
          id: "CDR-005",
          start_date_time: "2025-12-26T18:00:00Z",
          end_date_time: "2025-12-26T19:00:00Z",
          auth_id: "AUTH-123",
          auth_method: "RFID",
          token: {
            uid: "TOKEN-456",
            type: "RFID",
            contract_id: "CONTRACT-789",
          },
          location: {
            id: "LOC-001",
            name: "Tesco Superstore",
            address: "123 High Street",
            city: "London",
            postal_code: "SW1A 1AA",
            country: "GBR",
            evse_uid: "EVSE-001",
            connector_id: "1",
          },
          meter_id: "METER-001",
          currency: "GBP",
          total_cost: 12.00,
          total_energy: 40,
          total_time: 60,
          charging_periods: [
            {
              start_date_time: "2025-12-26T18:00:00Z",
              dimensions: [
                { type: "ENERGY", volume: 40 },
              ],
            },
          ],
          tariffs: [
            {
              currency: "GBP",
              elements: [
                {
                  price_components: [
                    { type: "ENERGY", price: 0.30, step_size: 1 },
                  ],
                },
              ],
            },
          ],
          remark: "Standard charge session",
          last_updated: "2025-12-26T19:00:00Z",
        };

        const breakdown = OcpiCostCalculator.calculateFromCdr(cdr);

        expect(breakdown.energy.toPounds()).toBe(12);
        expect(breakdown.total.toPounds()).toBe(12);
      });
    });

    describe("CDR with tariff restrictions", () => {
      it("applies grace period from CDR tariff", () => {
        const cdr: Cdr = {
          id: "CDR-006",
          start_date_time: "2025-12-26T10:00:00Z",
          end_date_time: "2025-12-26T11:00:00Z",
          currency: "GBP",
          total_cost: 20.00,
          total_energy: 50,
          total_time: 60,
          charging_periods: [
            {
              start_date_time: "2025-12-26T10:00:00Z",
              dimensions: [
                { type: "ENERGY", volume: 50 },
                { type: "TIME", volume: 35 },
              ],
            },
            {
              start_date_time: "2025-12-26T10:35:00Z",
              dimensions: [
                { type: "PARKING_TIME", volume: 25 },
              ],
            },
          ],
          tariffs: [
            {
              currency: "GBP",
              elements: [
                {
                  price_components: [
                    { type: "ENERGY", price: 0.30, step_size: 1 },
                  ],
                },
                {
                  price_components: [
                    { type: "PARKING_TIME", price: 0.50, step_size: 1 },
                  ],
                  restrictions: {
                    min_duration: 600,
                  },
                },
              ],
            },
          ],
          last_updated: "2025-12-26T11:00:00Z",
        };

        const breakdown = OcpiCostCalculator.calculateFromCdr(cdr);

        expect(breakdown.energy.toPounds()).toBe(15);
       
        expect(breakdown.parking.toPounds()).toBe(7.50);
        expect(breakdown.total.toPounds()).toBe(22.50);
      });

      it("applies day-of-week restrictions from CDR tariff", () => {
        const cdr: Cdr = {
          id: "CDR-007",
          start_date_time: "2025-12-27T10:00:00Z",
          end_date_time: "2025-12-27T10:30:00Z",
          currency: "GBP",
          total_cost: 12.00,
          total_energy: 30,
          total_time: 30,
          charging_periods: [
            {
              start_date_time: "2025-12-27T10:00:00Z",
              dimensions: [
                { type: "ENERGY", volume: 30 },
              ],
            },
          ],
          tariffs: [
            {
              currency: "GBP",
              elements: [
                {
                  price_components: [
                    { type: "ENERGY", price: 0.30, step_size: 1 },
                  ],
                },
                {
                  price_components: [
                    { type: "FLAT", price: 3.00, step_size: 0 },
                  ],
                  restrictions: {
                    day_of_week: ["SATURDAY", "SUNDAY"],
                  },
                },
              ],
            },
          ],
          last_updated: "2025-12-27T10:30:00Z",
        };

        const breakdown = OcpiCostCalculator.calculateFromCdr(cdr);

        expect(breakdown.energy.toPounds()).toBe(9);
        expect(breakdown.flat.toPounds()).toBe(3);
        expect(breakdown.total.toPounds()).toBe(12);
      });
    });

    describe("real-world CDR scenarios", () => {
      it("processes motorway rapid charge CDR", () => {
        const cdr: Cdr = {
          id: "GRIDSERVE-CDR-001",
          start_date_time: "2025-12-26T11:00:00Z",
          end_date_time: "2025-12-26T11:40:00Z",
          auth_method: "APP",
          token: {
            uid: "APP-USER-123",
            type: "APP_USER",
            contract_id: "GRIDSERVE-001",
          },
          location: {
            id: "GS-M1-J21",
            name: "Gridserve Electric Forecourt - M1 J21",
            address: "Leicester Forest East Services",
            city: "Leicester",
            country: "GBR",
          },
          currency: "GBP",
          total_cost: 41.49,
          total_energy: 50,
          total_time: 40,
          charging_periods: [
            {
              start_date_time: "2025-12-26T11:00:00Z",
              dimensions: [
                { type: "ENERGY", volume: 50 },
                { type: "TIME", volume: 35 },
              ],
            },
            {
              start_date_time: "2025-12-26T11:35:00Z",
              dimensions: [
                { type: "PARKING_TIME", volume: 5 },
              ],
            },
          ],
          tariffs: [
            {
              currency: "GBP",
              elements: [
                {
                  price_components: [
                    { type: "FLAT", price: 0.99, step_size: 0, vat: 20 },
                    { type: "ENERGY", price: 0.79, step_size: 1, vat: 20 },
                  ],
                },
                {
                  price_components: [
                    { type: "PARKING_TIME", price: 0.50, step_size: 1, vat: 20 },
                  ],
                  restrictions: {
                    min_duration: 600,
                  },
                },
              ],
            },
          ],
          last_updated: "2025-12-26T11:40:00Z",
        };

        const breakdown = OcpiCostCalculator.calculateFromCdr(cdr);

        expect(breakdown.flat.toPounds()).toBe(0.99);
        expect(breakdown.energy.toPounds()).toBe(39.50);
        expect(breakdown.parking.toPounds()).toBe(0);
        expect(breakdown.subtotal.toPounds()).toBe(40.49);
      });

      it("processes supermarket free charging CDR with idle fee", () => {
        const cdr: Cdr = {
          id: "TESCO-CDR-001",
          start_date_time: "2025-12-26T14:00:00Z",
          end_date_time: "2025-12-26T15:30:00Z",
          location: {
            id: "TESCO-EXTRA-001",
            name: "Tesco Extra - Park Royal",
            address: "Park Royal Road",
            city: "London",
            country: "GBR",
          },
          currency: "GBP",
          total_cost: 3.00,
          total_energy: 12,
          total_time: 90,
          total_parking_time: 75,
          charging_periods: [
            {
              start_date_time: "2025-12-26T14:00:00Z",
              dimensions: [
                { type: "ENERGY", volume: 12 },
                { type: "TIME", volume: 15 },
              ],
            },
            {
              start_date_time: "2025-12-26T14:15:00Z",
              dimensions: [
                { type: "PARKING_TIME", volume: 75 },
              ],
            },
          ],
          tariffs: [
            {
              currency: "GBP",
              elements: [
                {
                  price_components: [
                    { type: "ENERGY", price: 0.00, step_size: 1 },
                  ],
                },
                {
                  price_components: [
                    { type: "PARKING_TIME", price: 0.10, step_size: 1 },
                  ],
                  restrictions: {
                    min_duration: 2700,
                  },
                },
              ],
            },
          ],
          last_updated: "2025-12-26T15:30:00Z",
        };

        const breakdown = OcpiCostCalculator.calculateFromCdr(cdr);

        expect(breakdown.energy.toPounds()).toBe(0);
       
        expect(breakdown.parking.toPounds()).toBe(3);
        expect(breakdown.total.toPounds()).toBe(3);
      });

      it("processes fleet depot overnight charge CDR", () => {
        const cdr: Cdr = {
          id: "FLEET-CDR-001",
          start_date_time: "2025-12-26T22:00:00Z",
          end_date_time: "2025-12-27T06:00:00Z",
          auth_method: "RFID",
          token: {
            uid: "FLEET-VAN-042",
            type: "RFID",
            contract_id: "FLEET-DEPOT-001",
          },
          location: {
            id: "DEPOT-EAST",
            name: "Eastern Distribution Centre",
            address: "Industrial Estate",
            city: "Ipswich",
            country: "GBR",
          },
          currency: "GBP",
          total_cost: 32.00,
          total_energy: 150,
          total_time: 480,
          charging_periods: [
            {
              start_date_time: "2025-12-26T22:00:00Z",
              dimensions: [
                { type: "ENERGY", volume: 150 },
                { type: "TIME", volume: 480 },
              ],
            },
          ],
          tariffs: [
            {
              currency: "GBP",
              elements: [
                {
                  price_components: [
                    { type: "ENERGY", price: 0.28, step_size: 1 },
                  ],
                },
                {
                  price_components: [
                    { type: "FLAT", price: -10.00, step_size: 0 },
                  ],
                  restrictions: {
                    min_kwh: 100,
                  },
                },
              ],
            },
          ],
          last_updated: "2025-12-27T06:00:00Z",
        };

        const breakdown = OcpiCostCalculator.calculateFromCdr(cdr);

        expect(breakdown.energy.toPounds()).toBe(42);
        expect(breakdown.flat.toPounds()).toBe(-10);
        expect(breakdown.total.toPounds()).toBe(32);
      });
    });
  });
});
