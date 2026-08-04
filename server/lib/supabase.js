import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('[supabase] Warning: SUPABASE_URL or SUPABASE_SERVICE_KEY not set')
}

// Use service role key — bypasses RLS for backend writes.
// Never expose SUPABASE_SERVICE_KEY to the frontend.
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  realtime: {
    transport: WebSocket,
  },
})
