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
    const { token, key } = await request.json()
    if (!token || !key) return NextResponse.json({ error: 'Missing token or key' }, { status: 400 })
    if (!key.startsWith('sk-')) return NextResponse.json({ error: 'Invalid API key format' }, { status: 400 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    if (user.email !== ALLOWED_EMAIL) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    // Encrypt with AES-256-GCM
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(ALGO, getSecret(), iv)
    let encrypted = cipher.update(key, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    const authTag = cipher.getAuthTag().toString('hex')

    // Upsert into Supabase (service role needed for server-side write bypassing RLS)
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
    )
    const { error: dbError } = await adminClient
      .from('user_api_keys')
      .upsert({ user_id: user.id, encrypted_key: encrypted, iv: iv.toString('hex'), auth_tag: authTag, updated_at: new Date().toISOString() })

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
