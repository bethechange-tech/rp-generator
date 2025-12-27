import { Money } from "../Money";
import type { CostCalculator, CostFormatter } from "./ports";
import type { Cdr, ChargeRecord, CostBreakdown, OcpiSession, Tariff } from "./types";
import { ComponentCostCalculator } from "./services/ComponentCostCalculator";
import { RestrictionEvaluator } from "./services/RestrictionEvaluator";

export class OcpiCostCalculator implements CostCalculator, CostFormatter {
    private static readonly ZERO = Money.fromPence(0);

    private static readonly COST_ACCUMULATORS: Record<string, keyof Pick<CostBreakdown, 'energy' | 'time' | 'parking' | 'flat'>> = {
        ENERGY: 'energy',
        TIME: 'time',
        PARKING_TIME: 'parking',
        FLAT: 'flat',
    };

    public calculate(record: ChargeRecord, tariff: Tariff): CostBreakdown {
        const costs: Record<string, Money> = {
            energy: OcpiCostCalculator.ZERO,
            time: OcpiCostCalculator.ZERO,
            parking: OcpiCostCalculator.ZERO,
            flat: OcpiCostCalculator.ZERO,
            vat: OcpiCostCalculator.ZERO,
        };

        const applicableElements = tariff.elements.filter(
            element => RestrictionEvaluator.isApplicable(record, element)
        );

        for (const element of applicableElements) {
            for (const component of element.price_components) {
                const cost = ComponentCostCalculator.calculate(record, component, element.restrictions);
                const vat = component.vat ? cost.vat(component.vat) : OcpiCostCalculator.ZERO;

                const key = OcpiCostCalculator.COST_ACCUMULATORS[component.type];
                costs[key] = costs[key].add(cost);
                costs.vat = costs.vat.add(vat);
            }
        }

        const subtotal = costs.energy.add(costs.time).add(costs.parking).add(costs.flat);

        return {
            energy: costs.energy,
            time: costs.time,
            parking: costs.parking,
            flat: costs.flat,
            subtotal,
            vat: costs.vat,
            total: subtotal.add(costs.vat),
        };
    }

    public format(breakdown: CostBreakdown, symbol: string = "£"): Record<string, string> {
        return {
            energy_cost: breakdown.energy.format(symbol),
            time_cost: breakdown.time.format(symbol),
            parking_cost: breakdown.parking.format(symbol),
            flat_fee: breakdown.flat.format(symbol),
            subtotal: breakdown.subtotal.format(symbol),
            vat_amount: breakdown.vat.format(symbol),
            total_amount: breakdown.total.format(symbol),
        };
    }

    static calculate(record: ChargeRecord | OcpiSession | Cdr, tariff: Tariff): CostBreakdown {
        return new OcpiCostCalculator().calculate(record as ChargeRecord, tariff);
    }

    static calculateFromCdr(cdr: Cdr): CostBreakdown {
        if (!cdr.tariffs || cdr.tariffs.length === 0) {
            return {
                energy: Money.fromPounds(cdr.total_energy_cost ?? 0),
                time: Money.fromPounds(cdr.total_time_cost ?? 0),
                parking: Money.fromPounds(cdr.total_parking_cost ?? 0),
                flat: Money.fromPounds(cdr.total_fixed_cost ?? 0),
                subtotal: Money.fromPounds(cdr.total_cost),
                vat: Money.fromPence(0),
                total: Money.fromPounds(cdr.total_cost),
            };
        }

        let combined: CostBreakdown = {
            energy: Money.fromPence(0),
            time: Money.fromPence(0),
            parking: Money.fromPence(0),
            flat: Money.fromPence(0),
            subtotal: Money.fromPence(0),
            vat: Money.fromPence(0),
            total: Money.fromPence(0),
        };

        for (const tariff of cdr.tariffs) {
            const breakdown = OcpiCostCalculator.calculate(cdr, tariff);
            combined = {
                energy: combined.energy.add(breakdown.energy),
                time: combined.time.add(breakdown.time),
                parking: combined.parking.add(breakdown.parking),
                flat: combined.flat.add(breakdown.flat),
                subtotal: combined.subtotal.add(breakdown.subtotal),
                vat: combined.vat.add(breakdown.vat),
                total: combined.total.add(breakdown.total),
            };
        }

        return combined;
    }

    static formatBreakdown(breakdown: CostBreakdown, symbol: string = "£"): Record<string, string> {
        return new OcpiCostCalculator().format(breakdown, symbol);
    }
}
