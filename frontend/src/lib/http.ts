// ─── HTTP Client (lib/http.ts) ────────────────────────────────────────────────
// Single Axios instance. Injects JWT from localStorage automatically.
// Redirects to /login on 401 so every caller stays clean.
// ─────────────────────────────────────────────────────────────────────────────

import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

export const http = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// ── Request interceptor: attach Bearer token ──────────────────────────────────
http.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: unwrap ApiResponse<T> and handle 401 ───────────────
http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("accessToken");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);
