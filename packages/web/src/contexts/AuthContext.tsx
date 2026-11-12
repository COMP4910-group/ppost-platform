import React, { createContext, useContext, useState, useEffect } from 'react';

export interface AuthUser {
  id: number;
  username: string;
  email: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session from localStorage on mount
    try {
      const stored = localStorage.getItem('user');
      const token  = localStorage.getItem('access_token');
      if (stored && token) setUser(JSON.parse(stored));
    } catch {
      localStorage.removeItem('user');
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
    setLoading(false);

    // Listen for login event fired after a successful Django auth call
    const onLogin = (e: Event) => {
      const detail = (e as CustomEvent<AuthUser>).detail;
      setUser(detail);
    };
    window.addEventListener('auth:login', onLogin);
    return () => window.removeEventListener('auth:login', onLogin);
  }, []);

  const signOut = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

/**
 * Call this right after storing tokens in localStorage so the AuthContext
 * updates immediately without a page refresh.
 */
export const dispatchAuthLogin = (user: AuthUser) => {
  window.dispatchEvent(new CustomEvent('auth:login', { detail: user }));
};
