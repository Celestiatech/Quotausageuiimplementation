import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  avatar?: string;
  plan: 'free' | 'pro' | 'coach';
  createdAt: string;
  quotaUsed: number;
  quotaTotal: number;
  quotaResetTime: string;
  hireBalance: number;
  hireSpent: number;
  hirePurchased: number;
  dailyHireUsed: number;
  dailyHireCap: number;
  dailyHireResetTime: string;
  phone?: string;
  currentCity?: string;
  addressLine?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  resumeFileName?: string;
  onboardingCompleted?: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isBootstrapping: boolean;
  login: (email: string, password: string, role?: 'user' | 'admin') => Promise<void>;
  logout: () => void;
  signup: (name: string, email: string, password: string) => Promise<void>;
  incrementQuota: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const SESSION_KEY = 'user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      const storedUser = localStorage.getItem(SESSION_KEY);
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        const serverUser = (data?.data?.user || data?.user) as User | undefined;
        if (serverUser) {
          setUser(serverUser);
          localStorage.setItem(SESSION_KEY, JSON.stringify(serverUser));
        }
      } catch {
        // Keep local session fallback when API is unreachable.
      } finally {
        setIsBootstrapping(false);
      }
    };
    bootstrap();
  }, []);

  const login = async (email: string, password: string, role: 'user' | 'admin' = 'user') => {
    if (user && user.role !== role) {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
      setUser(null);
      localStorage.removeItem(SESSION_KEY);
    }
    const endpoint = role === 'admin' ? '/api/auth/admin/login' : '/api/auth/login';
    const payload = role === 'admin'
      ? { email, password }
      : { email, password, role };
    const res = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data?.success) {
      throw new Error(data?.message || 'Invalid email or password');
    }
    const sessionUser = (data?.data?.user || data?.user) as User;
    setUser(sessionUser);
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
  };

  const signup = async (name: string, email: string, password: string) => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok || !data?.success) {
      throw new Error(data?.message || 'Failed to create account');
    }
    const sessionUser = (data?.data?.user || data?.user) as User;
    setUser(sessionUser);
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
  };

  const logout = () => {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
  };

  const incrementQuota = () => {
    if (!user) return;
    if (user.dailyHireUsed >= user.dailyHireCap) return;
    if (user.hireBalance <= 0) return;
    const updatedUser: User = {
      ...user,
      quotaUsed: user.quotaUsed + 1,
      dailyHireUsed: user.dailyHireUsed + 1,
      hireBalance: Math.max(0, user.hireBalance - 1),
      hireSpent: user.hireSpent + 1,
    };
    setUser(updatedUser);
    localStorage.setItem(SESSION_KEY, JSON.stringify(updatedUser));
  };

  const refreshUser = async () => {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();
    const serverUser = (data?.data?.user || data?.user) as User | undefined;
    if (!serverUser) return;
    setUser(serverUser);
    localStorage.setItem(SESSION_KEY, JSON.stringify(serverUser));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        isBootstrapping,
        login,
        logout,
        signup,
        incrementQuota,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    return {
      user: null,
      isAuthenticated: false,
      isAdmin: false,
      isBootstrapping: true,
      login: async () => {},
      logout: () => {},
      signup: async () => {},
      incrementQuota: () => {},
      refreshUser: async () => {}
    };
  }
  return context;
}
