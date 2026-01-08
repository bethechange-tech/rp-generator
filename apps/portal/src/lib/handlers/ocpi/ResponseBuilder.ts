import { ZodError } from "zod";
import type { CostBreakdown } from "@ev-receipt/core";
import { OcpiCostCalculator } from "@ev-receipt/core";
import { BreakdownExtractor } from "./BreakdownExtractor";
import type {
  DetailedCostResponse,
  CalculateErrorResponse,
  CostBreakdownDetails,
} from "./types";

/**
 * Builds API responses for the OCPI calculate endpoint
 */
export class ResponseBuilder {
  /**
   * Build a successful cost breakdown response
   */
  static success(
    breakdown: CostBreakdown,
    sessionPayload: Record<string, unknown>,
    tariffPayload?: Record<string, unknown>
  ): DetailedCostResponse {
    const formatted = OcpiCostCalculator.formatBreakdown(breakdown);

   
    const sessionDetails = BreakdownExtractor.extractSessionDetails(sessionPayload);
    const energyDetails = BreakdownExtractor.extractEnergyDetails(sessionPayload, tariffPayload);
    const parkingDetails = BreakdownExtractor.extractParkingDetails(sessionPayload, tariffPayload);
    const tariffApplied = BreakdownExtractor.extractTariffDetails(tariffPayload);
    const explanations = BreakdownExtractor.generateExplanations(
      sessionDetails,
      energyDetails,
      parkingDetails,
      tariffApplied
    );

    const details: CostBreakdownDetails = {
      session: sessionDetails,
      energy: energyDetails,
      parking: parkingDetails,
      tariffApplied,
      explanations,
    };

    return {
      energy: breakdown.energy.toPounds().toFixed(2),
      time: breakdown.time.toPounds().toFixed(2),
      parking: breakdown.parking.toPounds().toFixed(2),
      flat: breakdown.flat.toPounds().toFixed(2),
      subtotal: breakdown.subtotal.toPounds().toFixed(2),
      vat: breakdown.vat.toPounds().toFixed(2),
      total: breakdown.total.toPounds().toFixed(2),
      formatted,
      details,
    };
  }

  /**
   * Build an error response from an error object
   */
  static error(error: unknown): { response: CalculateErrorResponse; status: number } {
    console.error("[OCPI Calculate Error]", error);

    if (error instanceof ZodError) {
      const details: Record<string, string[]> = {};
      for (const issue of error.issues) {
        const path = issue.path.join(".");
        if (!details[path]) {
          details[path] = [];
        }
        details[path].push(issue.message);
      }

      return {
        response: {
          code: "VALIDATION_ERROR",
          message: "Invalid request payload",
          details,
        },
        status: 400,
      };
    }

    if (error instanceof SyntaxError) {
      return {
        response: {
          code: "PARSE_ERROR",
          message: "Invalid JSON in request body",
        },
        status: 400,
      };
    }

    if (error instanceof Error) {
      return {
        response: {
          code: "CALCULATION_ERROR",
          message: error.message,
        },
        status: 500,
      };
    }

    return {
      response: {
        code: "UNKNOWN_ERROR",
        message: "An unexpected error occurred",
      },
      status: 500,
    };
  }
}
