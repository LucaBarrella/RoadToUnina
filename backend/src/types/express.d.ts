import { UserProfile } from '../services/authService';

/**
 * Global Declaration Merging for Express Request.
 * Extends Express's Request interface to include the authenticated `user` payload on `req.user`.
 */
declare global {
  namespace Express {
    /**
     * Extended Request interface containing the authenticated JWT user payload.
     */
    interface Request {
      /**
       * Authenticated user details attached by authMiddleware.
       */
      user?: {
        /**
         * Unique identifier of the user.
         */
        id: string;

        /**
         * Public username of the user.
         */
        username: string;
      };
    }
  }
}

export {};
