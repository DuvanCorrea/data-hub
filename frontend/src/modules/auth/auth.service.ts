// ─── Auth Service (modules/auth/auth.service.ts) ──────────────────────────────
// Responsible for all auth-related API calls.
// ─────────────────────────────────────────────────────────────────────────────

import { http } from "@/lib/http";
import type { ApiResponse, AuthResponse, LoginRequest, UserProfile } from "@/contracts/api.types";

export const authService = {
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const res = await http.post<ApiResponse<AuthResponse>>("/api/auth/login", credentials);
    return res.data.data;
  },

  async me(): Promise<UserProfile> {
    const res = await http.get<ApiResponse<UserProfile>>("/api/auth/me");
    return res.data.data;
  },

  logout(): void {
    localStorage.removeItem("accessToken");
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem("accessToken");
  },
};
