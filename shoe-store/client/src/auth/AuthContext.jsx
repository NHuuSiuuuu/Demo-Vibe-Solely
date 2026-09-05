import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiClient } from '../api/client.js';

const TOKEN_STORAGE_KEY = 'shoe_store_token';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!token) {
      setUser(null);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      return;
    }

    localStorage.setItem(TOKEN_STORAGE_KEY, token);

    if (user) {
      return;
    }

    let cancelled = false;
    apiClient
      .get('/api/auth/me', { token })
      .then((data) => {
        if (!cancelled) {
          setUser(data.user);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setToken(null);
          setUser(null);
          localStorage.removeItem(TOKEN_STORAGE_KEY);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, user]);

  async function login(credentials) {
    const data = await apiClient.post('/api/auth/login', credentials);
    localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  async function register(details) {
    const data = await apiClient.post('/api/auth/register', details);
    localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }

  const value = useMemo(
    () => ({
      user,
      token,
      login,
      register,
      logout,
      isAdmin: user?.role === 'admin'
    }),
    [user, token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
