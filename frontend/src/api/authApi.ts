import { apiClient } from './client';
import { AuthResponse, LoginDTO, RegisterDTO, UserProfile } from '../types';

/**
 * API client module for user authentication and account management endpoints.
 */
export const authApi = {
  /**
   * Authenticates a user with email/username and password.
   *
   * @param data - The login DTO containing credentials.
   * @returns AuthResponse containing the user profile and JWT access token.
   */
  async login(data: LoginDTO): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/login', data);
    return response.data;
  },

  /**
   * Registers a new user account with email, username, and password.
   *
   * @param data - The registration DTO.
   * @returns AuthResponse containing created user profile and JWT access token.
   */
  async register(data: RegisterDTO): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/register', data);
    return response.data;
  },

  /**
   * Retrieves profile information for the currently authenticated user.
   *
   * @returns UserProfile object for the authenticated session.
   */
  async getProfile(): Promise<UserProfile> {
    const response = await apiClient.get<UserProfile>('/auth/me');
    return response.data;
  },
};

export default authApi;

