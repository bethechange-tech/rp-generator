import { Request, Response, NextFunction, RequestHandler } from "express";

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404);
    this.name = "NotFoundError";
  }
}

export const catchAsync = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): RequestHandler => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

interface ErrorWithStatus extends Error {
  status?: number;
  statusCode?: number;
  errors?: Array<{ path: string; message: string }>;
}

export const globalErrorHandler = (
  err: ErrorWithStatus,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = err.statusCode || err.status || 500;
  
  console.error(`[Error] ${err.name}: ${err.message}`);

  res.status(statusCode).json({
    success: false,
    error: err.message,
    ...(err.errors && { details: err.errors }),
  });
};
