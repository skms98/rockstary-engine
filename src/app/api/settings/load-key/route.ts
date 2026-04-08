import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const ALLOWED_EMAIL = 'samir.badawy@platinumlist.net'
const ALGO = 'aes-256-gcm'

function getSecret(): Buffer {
  const secret = process.env.KEY_ENCRYPTION_SECRET
  if (!secret || secret.length !== 64) throw new Error('KEY_ENCRYPTION_SECRET must be a 64-char hex string (32 bytes)')
  return Buffer.from(secret, 'hex')
}

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    if (user.email !== ALLOWED_EMAIL) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
    )
    const { data, error: dbError } = await adminClient
      .from('user_api_keys')
      .select('encrypted_key, iv, auth_tag')
      .eq('user_id', user.id)
      .single()

    if (dbError || !data) return NextResponse.json({ key: null })

    // Decrypt
    const decipher = crypto.createDecipheriv(ALGO, getSecret(), Buffer.from(data.iv, 'hex'))
    decipher.setAuthTag(Buffer.from(data.auth_tag, 'hex'))
    let decrypted = decipher.update(data.encrypted_key, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return NextResponse.json({ key: decrypted })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
