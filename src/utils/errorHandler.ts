import { Express, Request, Response, NextFunction } from 'express';

// Define a custom error class for app-specific errors
export class AppError extends Error {
  constructor(public message: string, public statusCode: number = 500) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// Global error handler middleware
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  let statusCode = 500;
  if (err instanceof AppError) {
    statusCode = err.statusCode;
  }
  res.status(statusCode).json({
    status: 'error',
    message: err.message || 'Something went wrong on our end.'
  });
};

// Async wrapper to avoid try-catch blocks everywhere
export const catchAsync = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
};
