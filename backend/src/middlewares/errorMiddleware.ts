import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

/**
 * Standardized structure for field-level validation errors.
 */
export interface ValidationErrorDetail {
  /**
   * Dot-separated path to the invalid field (e.g. 'body.email' or 'password').
   */
  field: string;

  /**
   * Human-readable description of why validation failed.
   */
  message: string;
}

/**
 * Interface representing standard HTTP error payloads recognized by body-parsers.
 */
export interface HttpErrorLike {
  /**
   * Identifier string for body-parser error types (e.g., 'entity.too.large').
   */
  type?: string;

  /**
   * HTTP status code (e.g., 413, 400).
   */
  status?: number;
}

/**
 * Custom application error class representing operational HTTP errors.
 * Extends the native JavaScript Error with an explicit HTTP status code.
 */
export class AppError extends Error {
  /**
   * HTTP status code corresponding to the error (e.g., 400, 401, 403, 404, 409, 500, 502).
   */
  public readonly statusCode: number;

  /**
   * Constructs a new AppError instance.
   *
   * @param {string} message - Descriptive error message explaining the failure cause.
   * @param {number} [statusCode=500] - HTTP status code. Defaults to 500.
   *
   * @example
   * throw new AppError('Resource not found', 404);
   */
  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Type guard checking if an unknown error object matches the HttpErrorLike payload-too-large pattern.
 *
 * @param {unknown} err - The error object to inspect.
 * @returns {boolean} True if the error indicates a payload size limit violation.
 */
function isPayloadTooLargeError(err: unknown): boolean {
  if (typeof err === 'object' && err !== null) {
    const candidate = err as HttpErrorLike;
    return candidate.type === 'entity.too.large' || candidate.status === 413;
  }
  return false;
}

/**
 * Type guard checking if an error is a malformed JSON body parse error.
 *
 * @param {unknown} err - The error object to inspect.
 * @returns {boolean} True if the error is a syntax error during JSON payload parsing.
 */
function isMalformedJsonError(err: unknown): boolean {
  return err instanceof SyntaxError && 'body' in err;
}

/**
 * Centralized Express error handler middleware.
 * Intercepts AppErrors, Zod validation errors, JSON syntax errors, payload size errors,
 * and unknown exceptions, returning a uniform JSON response.
 *
 * @param {unknown} err - Error caught by Express or passed via `next(err)`.
 * @param {Request} _req - Express Request object.
 * @param {Response} res - Express Response object used to send the JSON error.
 * @param {NextFunction} _next - Express NextFunction callback (required 4-arg signature).
 * @returns {void}
 *
 * @example
 * app.use(errorMiddleware);
 */
export const errorMiddleware = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
    });
    return;
  }

  if (err instanceof ZodError) {
    const details: ValidationErrorDetail[] = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));

    res.status(400).json({
      error: 'Validation Error',
      details,
    });
    return;
  }

  if (isPayloadTooLargeError(err)) {
    res.status(413).json({
      error: 'Payload Too Large: Request body exceeds size limits',
    });
    return;
  }

  if (isMalformedJsonError(err)) {
    res.status(400).json({
      error: 'Malformed JSON payload',
    });
    return;
  }

  console.error('Unhandled Application Error:', err);

  res.status(500).json({
    error: 'Internal Server Error',
  });
};
