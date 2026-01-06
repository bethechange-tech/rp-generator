"use client";

import { useState, useCallback } from "react";
import { ZodError } from "zod";
import { CalculateCostRequestSchema, type CalculateCostRequest, type CostBreakdownResponse } from "../domain/schemas";
import { getCostCalculatorService, ApiError } from "../adapters/ApiCostCalculatorService";
import { ErrorCode, type AppError, type Result } from "../ports/ICostCalculatorService";

interface UseCostCalculatorState {
  result: CostBreakdownResponse | null;
  error: AppError | null;
  isLoading: boolean;
}

interface UseCostCalculatorReturn extends UseCostCalculatorState {
  calculate: (request: unknown) => Promise<Result<CostBreakdownResponse, AppError>>;
  reset: () => void;
}

/**
 * Hook for calculating OCPI costs
 * 
 * Provides validation, error handling, and loading states
 */
export function useCostCalculator(): UseCostCalculatorReturn {
  const [state, setState] = useState<UseCostCalculatorState>({
    result: null,
    error: null,
    isLoading: false,
  });

  const calculate = useCallback(async (request: unknown): Promise<Result<CostBreakdownResponse, AppError>> => {
    setState({ result: null, error: null, isLoading: true });

    try {
      // Validate request
      const validatedRequest = CalculateCostRequestSchema.parse(request);

      // Call service
      const service = getCostCalculatorService();
      const result = await service.calculate(validatedRequest as CalculateCostRequest);

      setState({ result, error: null, isLoading: false });
      return { success: true, data: result };
    } catch (err) {
      const appError = mapToAppError(err);
      setState({ result: null, error: appError, isLoading: false });
      return { success: false, error: appError };
    }
  }, []);

  const reset = useCallback(() => {
    setState({ result: null, error: null, isLoading: false });
  }, []);

  return {
    ...state,
    calculate,
    reset,
  };
}

/**
 * Maps various error types to a consistent AppError format
 */
function mapToAppError(err: unknown): AppError {
  if (err instanceof ZodError) {
    const details: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const path = issue.path.join(".");
      if (!details[path]) {
        details[path] = [];
      }
      details[path].push(issue.message);
    }
    return {
      code: ErrorCode.VALIDATION_ERROR,
      message: "Validation failed. Please check your input.",
      details,
    };
  }

  if (err instanceof ApiError) {
    return {
      code: err.status >= 400 && err.status < 500 
        ? ErrorCode.VALIDATION_ERROR 
        : ErrorCode.NETWORK_ERROR,
      message: err.message,
      details: err.details,
    };
  }

  if (err instanceof Error) {
    if (err.message.includes("fetch") || err.message.includes("network")) {
      return {
        code: ErrorCode.NETWORK_ERROR,
        message: "Network error. Please check your connection and try again.",
      };
    }
    return {
      code: ErrorCode.UNKNOWN_ERROR,
      message: err.message,
    };
  }

  return {
    code: ErrorCode.UNKNOWN_ERROR,
    message: "An unexpected error occurred. Please try again.",
  };
}
