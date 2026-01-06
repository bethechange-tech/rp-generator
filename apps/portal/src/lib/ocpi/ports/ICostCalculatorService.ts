import type { CalculateCostRequest, CostBreakdownResponse } from "../domain/schemas";

/**
 * Port: Cost Calculator Service
 * 
 * This interface defines the contract for calculating OCPI costs.
 * Following hexagonal architecture, this is a primary/driving port
 * that will be implemented by adapters.
 */
export interface ICostCalculatorService {
  /**
   * Calculate cost breakdown for a session or CDR
   */
  calculate(request: CalculateCostRequest): Promise<CostBreakdownResponse>;
}

/**
 * Result type for operations that can fail
 */
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Application-level error types
 */
export enum ErrorCode {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  CALCULATION_ERROR = "CALCULATION_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

export interface AppError {
  code: ErrorCode;
  message: string;
  details?: Record<string, string[]>;
}
