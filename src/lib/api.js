// Central API base URL.
//
// In local development, leave VITE_API_URL empty and Vite will proxy relative
// /api/* requests to the Express server using vite.config.js.
//
// In production, either:
//   1. set VITE_API_URL to your backend origin, e.g. https://membba-server.onrender.com, or
//   2. leave it empty if your host rewrites /api/* to the backend, e.g. vercel.json.
//
// Always use `${API_BASE}/api/...` in pages. When API_BASE is an empty string,
// fetch('/api/...') stays same-origin and works with the local/prod rewrite proxy.
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export default API_BASE
