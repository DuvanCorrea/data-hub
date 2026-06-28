// ─── Auth Context (modules/auth/AuthContext.tsx) ───────────────────────────────
// Provides user session state across the whole app via React context.
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { UserProfile } from "@/contracts/api.types";
import { authService } from "./auth.service";

interface AuthContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refresh: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = async () => {
    if (!authService.isAuthenticated()) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const profile = await authService.me();
      setUser(profile);
    } catch {
      authService.logout();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    window.location.href = "/login";
  };

  useEffect(() => { refresh(); }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
