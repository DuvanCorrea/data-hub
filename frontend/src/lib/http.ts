// ─── HTTP Client (lib/http.ts) ────────────────────────────────────────────────
// Single Axios instance. Injects JWT from localStorage automatically.
// Redirects to /login on 401 so every caller stays clean.
//
// PROXY RULE: baseURL must be "" (empty) so every /api/* request goes through
// the Vite dev-server proxy → http://backend:8080.
// Do NOT set VITE_API_BASE_URL or VITE_API_URL — it would bypass the proxy
// and cause direct cross-origin requests to the backend.
// ─────────────────────────────────────────────────────────────────────────────

import axios from "axios";

// Always empty → Vite proxy handles /api/*
const BASE_URL = "";

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
