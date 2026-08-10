import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema } from 'zod';

/**
 * Valid request property targets for schema parsing.
 */
export type ValidationSource = 'body' | 'query' | 'params';

/**
 * Factory creating an Express middleware to validate request data against a Zod schema.
 * Parses and replaces `req[source]` with sanitized/coerced data, or forwards a `ZodError` to `next()`.
 *
 * @template T - The parsed schema output type.
 * @param {ZodSchema<T>} schema - Zod validation schema to parse and validate incoming data.
 * @param {ValidationSource} [source='body'] - Request object property to validate ('body', 'query', or 'params').
 * @returns {RequestHandler} Express request handler middleware function.
 *
 * @example
 * router.post('/login', validateMiddleware(loginSchema, 'body'), authController.login);
 */
export const validateMiddleware = <T>(
  schema: ZodSchema<T>,
  source: ValidationSource = 'body'
): RequestHandler => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated: T = await schema.parseAsync(req[source]);
      req[source] = validated;
      next();
    } catch (error) {
      next(error);
    }
  };
};
