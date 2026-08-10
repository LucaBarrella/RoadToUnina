/**
 * User profile entity representation returned by the auth services.
 */
export interface UserProfile {
  /** Unique user identifier (UUID v4) */
  id: string;
  /** Primary user email address */
  email: string;
  /** Public display username */
  username: string;
  /** ISO timestamp of account creation date */
  createdAt: string;
}

/**
 * Authentication response model payload containing JWT credentials.
 */
export interface AuthResponse {
  /** User profile payload */
  user: UserProfile;
  /** Bearer access token string */
  token: string;
}

/**
 * Data transfer object for user account registration.
 */
export interface RegisterDTO {
  /** Target account email */
  email: string;
  /** Desired public username */
  username: string;
  /** Plaintext security password */
  password: string;
}

/**
 * Data transfer object for user account authentication.
 */
export interface LoginDTO {
  /** User login identifier (email or username) */
  login: string;
  /** User security password */
  password: string;
}

/**
 * Execution status for speedrun game sessions.
 */
export type GameStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';

/**
 * Individual navigation step recorded during an active speedrun game session.
 */
export interface GameStep {
  /** Step unique identifier */
  id: string;
  /** Parent game session identifier */
  gameId: string;
  /** Title of the Wikipedia page visited */
  pageTitle: string;
  /** Incremental order index of this navigation step */
  stepOrder: number;
  /** ISO timestamp when the step was taken */
  createdAt: string;
}

/**
 * Wikipedia speedrun game session state entity.
 */
export interface Game {
  /** Unique game session identifier */
  id: string;
  /** Owner user identifier */
  userId: string;
  /** Initial starting Wikipedia article title */
  startPageTitle: string;
  /** Current active Wikipedia article title */
  currentPageTitle: string;
  /** Required end goal Wikipedia article title */
  targetPageTitle: string;
  /** Current game progress status */
  status: GameStatus;
  /** Cumulative count of link clicks performed */
  clickCount: number;
  /** ISO timestamp when the session commenced */
  startTime: string;
  /** ISO timestamp when the session completed or was abandoned */
  endTime?: string;
  /** Sequential list of steps recorded for this game session */
  steps?: GameStep[];
}

/**
 * Sanitized Wikipedia page content and metadata structure.
 */
export interface WikiArticleContent {
  /** Title of the article */
  title: string;
  /** Canonical Wikipedia page title */
  canonicalTitle: string;
  /** Cleaned and sanitized HTML content string */
  htmlContent: string;
  /** List of valid internal Wikipedia article link titles */
  validLinks: string[];
  /** Flag indicating whether current article matches target goal */
  isTarget: boolean;
}

/**
 * Response payload representing active game session state and current Wikipedia article content.
 */
export interface ActiveGameResponse {
  /** Active game entity metadata */
  game: Game;
  /** Renderable current Wikipedia article content */
  currentArticle: WikiArticleContent;
}

/**
 * Historic record of a successfully completed Wikipedia speedrun.
 */
export interface CompletedGame {
  /** Completed game session identifier */
  id: string;
  /** Owner user information summary */
  user: {
    username: string;
  };
  /** Starting article title */
  startPageTitle: string;
  /** Target goal article title */
  targetPageTitle: string;
  /** Total clicks consumed */
  clickCount: number;
  /** Total time duration in seconds */
  durationSeconds: number;
  /** ISO timestamp of completion */
  completedAt: string;
  /** Sequential list of navigation step titles and orders */
  steps: {
    pageTitle: string;
    stepOrder: number;
  }[];
}

/**
 * Global leaderboard ranking entry summary.
 */
export interface LeaderboardEntry {
  /** Leaderboard rank position (1-indexed) */
  rank: number;
  /** Player identity details */
  user: {
    id: string;
    username: string;
  };
  /** Lowest recorded click count across completed runs */
  bestClickCount: number;
  /** Lowest recorded duration in seconds for best click run */
  bestDurationSeconds: number;
  /** Total number of completed speedrun games */
  completedGamesCount: number;
}

/**
 * Standard API error response schema returned by backend endpoints.
 */
export interface ApiErrorResponse {
  /** Human-readable error message */
  message: string;
  /** HTTP status code */
  statusCode?: number;
  /** Detailed error validation objects or array stack */
  errors?: unknown;
}

