import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile, LoginDTO, RegisterDTO } from '../types';
import { authApi } from '../api';

/**
 * Shape of the authentication context state and action handlers.
 */
interface AuthContextType {
  /** Authenticated user profile or null if anonymous */
  user: UserProfile | null;
  /** JWT access token or null if logged out */
  token: string | null;
  /** Flag indicating whether profile authentication check is in progress */
  loading: boolean;
  /** Authenticates user with credentials */
  login: (data: LoginDTO) => Promise<void>;
  /** Registers new user account */
  register: (data: RegisterDTO) => Promise<void>;
  /** Clears token and signs out user */
  logout: () => void;
  /** Re-evaluates profile data from API server */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Context provider component managing authentication state and token persistence.
 *
 * @param children - React child nodes to wrap.
 * @example
 * ```tsx
 * <AuthProvider>
 *   <AppRoutes />
 * </AuthProvider>
 * ```
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState<boolean>(true);

  const refreshProfile = useCallback(async () => {
    const existingToken = localStorage.getItem('token');
    if (!existingToken) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const profile = await authApi.getProfile();
      setUser(profile);
    } catch {
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const login = async (data: LoginDTO) => {
    const res = await authApi.login(data);
    localStorage.setItem('token', res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const register = async (data: RegisterDTO) => {
    const res = await authApi.register(data);
    localStorage.setItem('token', res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Custom hook to consume the nearest AuthProvider context.
 *
 * @returns AuthContextType containing auth state and methods.
 * @throws Error if called outside an AuthProvider hierarchy.
 * @example
 * ```tsx
 * const { user, logout } = useAuth();
 * ```
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

