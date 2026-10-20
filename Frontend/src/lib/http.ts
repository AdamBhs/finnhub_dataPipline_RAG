import axios from 'axios'

/** Base URL for the backend API, configured via `.env` (see `.env.example`). */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

/**
 * Shared axios instance. All API calls should go through this client so the
 * base URL, headers, and interceptors live in one place.
 */
export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Example: attach an auth token once the backend needs one.
// http.interceptors.request.use((config) => {
//   const token = localStorage.getItem('token')
//   if (token) config.headers.Authorization = `Bearer ${token}`
//   return config
// })
