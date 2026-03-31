import { createClient } from '@supabase/supabase-js'

// Client-side PL Supabase client — uses NEXT_PUBLIC_ env vars for browser access
const plUrl = process.env.NEXT_PUBLIC_PL_SUPABASE_URL!
const plKey = process.env.NEXT_PUBLIC_PL_SUPABASE_ANON_KEY!

export const plSupabase = createClient(plUrl, plKey)

// Server-side only PL Supabase client — uses env vars without NEXT_PUBLIC_ prefix
// These are stored securely in Vercel Environment Variables and never exposed to the browser
export function createPLClient() {
  const url = process.env.PL_SUPABASE_URL
  const key = process.env.PL_SUPABASE_SERVICE_KEY

  if (!url || !key) {
    throw new Error('PL Supabase credentials not configured')
  }

  return createClient(url, key)
}
