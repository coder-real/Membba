import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

// Preferred current name: VITE_SUPABASE_PUBLISHABLE_KEY.
// Fallback is kept so older .env files that used VITE_SUPABASE_ANON_KEY still work.
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    'Supabase env vars not set. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to your .env file.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey)
