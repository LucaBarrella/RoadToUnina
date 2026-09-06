/**
 * Application Error Code enum representing standardized, machine-readable error identifiers.
 */
export enum ErrorCode {
  // Authentication & Session
  /** Request lacks valid authentication token or authorization header. (HTTP 401) */
  UNAUTHORIZED = 'UNAUTHORIZED',
  /** Provided login credentials (password or username/email) are incorrect. (HTTP 401) */
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  /** Registration failed because email address is already in use. (HTTP 400) */
  EMAIL_ALREADY_REGISTERED = 'EMAIL_ALREADY_REGISTERED',
  /** Registration failed because username is already in use. (HTTP 400) */
  USERNAME_ALREADY_TAKEN = 'USERNAME_ALREADY_TAKEN',
  /** Requested user account ID does not exist in the database. (HTTP 404) */
  USER_NOT_FOUND = 'USER_NOT_FOUND',

  // Game Lifecycle & Rules
  /** User already has an active, non-expired game session in progress. (HTTP 400) */
  ACTIVE_GAME_EXISTS = 'ACTIVE_GAME_EXISTS',
  /** Specified game session was not found or does not belong to the user. (HTTP 404) */
  GAME_NOT_FOUND = 'GAME_NOT_FOUND',
  /** Target link clicked is not present in the current article (anti-cheat violation). (HTTP 400) */
  INVALID_STEP = 'INVALID_STEP',
  /** Concurrent modification conflict during step navigation. (HTTP 409) */
  CONCURRENT_CONFLICT = 'CONCURRENT_CONFLICT',

  // Wikipedia Integration
  /** Requested Wikipedia page title is empty, malformed, or invalid. (HTTP 400) */
  INVALID_WIKI_TITLE = 'INVALID_WIKI_TITLE',
  /** Upstream Wikipedia REST/Action API returned an error or failed to respond. (HTTP 502) */
  WIKI_API_ERROR = 'WIKI_API_ERROR',
  /** Wikipedia article with the requested title does not exist. (HTTP 404) */
  WIKI_PAGE_NOT_FOUND = 'WIKI_PAGE_NOT_FOUND',

  // Transport & Middleware
  /** Origin header is not allowed by CORS security policy. (HTTP 403) */
  CORS_NOT_ALLOWED = 'CORS_NOT_ALLOWED',
  /** Request body, query, or path parameters failed Zod schema validation. (HTTP 400) */
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  /** Request payload exceeds allowed body-parser byte limits. (HTTP 413) */
  PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE',
  /** Request body contains syntactically invalid JSON. (HTTP 400) */
  MALFORMED_JSON = 'MALFORMED_JSON',
  /** Requested API route or endpoint does not exist. (HTTP 404) */
  NOT_FOUND = 'NOT_FOUND',
  /** Unexpected internal server error or unhandled exception. (HTTP 500) */
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
}
