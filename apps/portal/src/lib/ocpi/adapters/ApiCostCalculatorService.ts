import type { CalculateCostRequest, CostBreakdownResponse } from "../domain/schemas";
import type { ICostCalculatorService } from "../ports/ICostCalculatorService";

/**
 * Adapter: API Cost Calculator Service
 * 
 * Implements the ICostCalculatorService port by making HTTP requests
 * to the Next.js API route.
 */
export class ApiCostCalculatorService implements ICostCalculatorService {
  private readonly baseUrl: string;

  constructor(baseUrl: string = "") {
    this.baseUrl = baseUrl;
  }

  async calculate(request: CalculateCostRequest): Promise<CostBreakdownResponse> {
    const response = await fetch(`${this.baseUrl}/api/ocpi/calculate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        response.status,
        errorData.message || "Failed to calculate cost",
        errorData.details
      );
    }

    return response.json();
  }
}

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, string[]>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Singleton instance for client-side use
let instance: ApiCostCalculatorService | null = null;

export function getCostCalculatorService(): ICostCalculatorService {
  if (!instance) {
    instance = new ApiCostCalculatorService();
  }
  return instance;
}
