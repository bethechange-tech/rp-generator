import { NextRequest, NextResponse } from "next/server";
import { OcpiCostCalculator, type Tariff, type CostBreakdown } from "@ev-receipt/core";
import { CalculateCostRequestSchema } from "@/lib/ocpi/domain/schemas";
import { PayloadTransformer } from "./PayloadTransformer";
import { ResponseBuilder } from "./ResponseBuilder";

/**
 * Handler for OCPI cost calculation requests
 * 
 * Supports three calculation types:
 * - session: Calculate from OCPI session + tariff
 * - record: Calculate from simplified charge record + tariff  
 * - cdr: Calculate from OCPI CDR with embedded tariffs
 */
export class CalculateCostHandler {
  /**
   * Handle POST request for cost calculation
   */
  static async handle(request: NextRequest): Promise<NextResponse> {
    try {
      const body = await request.json();

      // Validate request body
      const validatedRequest = CalculateCostRequestSchema.parse(body);

      let breakdown: CostBreakdown;
      let sessionPayload: Record<string, unknown>;
      let tariffPayload: Record<string, unknown> | undefined;

      if (validatedRequest.type === "session") {
        // Calculate from session and tariff
        sessionPayload = validatedRequest.session as Record<string, unknown>;
        tariffPayload = validatedRequest.tariff as Record<string, unknown>;
        const chargeRecord = PayloadTransformer.toChargeRecord(sessionPayload);
        breakdown = OcpiCostCalculator.calculate(
          chargeRecord,
          validatedRequest.tariff as Tariff
        );
      } else if (validatedRequest.type === "record") {
        // Calculate from simplified charge record and tariff
        sessionPayload = validatedRequest.record as Record<string, unknown>;
        tariffPayload = validatedRequest.tariff as Record<string, unknown>;
        const chargeRecord = PayloadTransformer.toChargeRecord(sessionPayload);
        breakdown = OcpiCostCalculator.calculate(
          chargeRecord,
          validatedRequest.tariff as Tariff
        );
      } else {
        // Calculate from CDR (may include tariffs or use totals)
        sessionPayload = validatedRequest.cdr as Record<string, unknown>;
        tariffPayload = (sessionPayload.tariffs as Record<string, unknown>[])?.[0];
        const cdr = PayloadTransformer.toCdr(sessionPayload);
        breakdown = OcpiCostCalculator.calculateFromCdr(cdr);
      }

      const response = ResponseBuilder.success(breakdown, sessionPayload, tariffPayload);
      return NextResponse.json(response);
    } catch (error) {
      const { response, status } = ResponseBuilder.error(error);
      return NextResponse.json(response, { status });
    }
  }
}
