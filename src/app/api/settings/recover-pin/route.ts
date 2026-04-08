import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ALLOWED_EMAIL = 'samir.badawy@platinumlist.net'

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 400 })

    // Verify the token against Supabase — only the app's own Supabase project
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    if (user.email !== ALLOWED_EMAIL) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const pin = process.env.SETTINGS_PIN || '4545'
    return NextResponse.json({ pin })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
