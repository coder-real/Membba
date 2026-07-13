// Central API base URL.
// • Set VITE_API_URL in Vercel → Settings → Environment Variables for production.
// • For local dev, add VITE_API_URL=http://localhost:3001 to your .env.local file.
if (!import.meta.env.VITE_API_URL) {
  console.warn('[api] VITE_API_URL is not set — API calls will fail in production.')
}

const API_BASE = import.meta.env.VITE_API_URL

export default API_BASE

