import { createClient } from '@supabase/supabase-js'

// Server-side only PL Supabase client - uses env vars without NEXT_PUBLIC_ prefix
// These are stored securely in Vercel Environment Variables and never exposed to the browser
export function createPLClient() {
  const url = process.env.PL_SUPABASE_URL
  const key = process.env.PL_SUPABASE_SERVICE_KEY

  if (!url || !key) {
    throw new Error('PL Supabase credentials not configured')
  }

  return createClient(url, key)
}
