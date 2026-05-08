import { createClient } from '@supabase/supabase-js'

if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.warn('[supabase] Warning: VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY not set')
}

// Use service role key — bypasses RLS for backend writes
export const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)
