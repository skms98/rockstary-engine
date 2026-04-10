import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Singleton — one GoTrueClient per browser context
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { storageKey: 'rockstary-supabase' }
})

// Return singleton instead of creating a new client each call
export function createServerClient() {
  return supabase
}
