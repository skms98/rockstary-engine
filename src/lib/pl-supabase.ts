// @ts-nocheck
import { createClient } from '@supabase/supabase-js'

// Client-side PL Supabase client — singleton with unique storageKey to avoid GoTrueClient conflicts
const plUrl = process.env.NEXT_PUBLIC_PL_SUPABASE_URL
const plKey = process.env.NEXT_PUBLIC_PL_SUPABASE_ANON_KEY

export const plSupabase = createClient(plUrl, plKey, {
  auth: { storageKey: 'platinumlist-supabase' }
})

// Server-side only PL Supabase client — memoized singleton, no browser auth
let _plServerClient = null

export function createPLClient() {
  if (_plServerClient) return _plServerClient
  const url = process.env.PL_SUPABASE_URL
  const key = process.env.PL_SUPABASE_SERVICE_KEY

  if (!url || !key) {
    throw new Error('PL Supabase credentials not configured')
  }

  _plServerClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
  return _plServerClient
}
