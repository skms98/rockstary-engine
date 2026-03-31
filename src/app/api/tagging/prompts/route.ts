import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAuthClient(authToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${authToken}` } } }
  )
}

export async function GET(request: NextRequest) {
  try {
    const authToken = request.headers.get('authorization')?.replace('Bearer ', '') || ''
    const db = getAuthClient(authToken)

    const { data: { user }, error: authError } = await db.auth.getUser(authToken)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await db
      .from('tagging_prompts')
      .select('*')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authToken = request.headers.get('authorization')?.replace('Bearer ', '') || ''
    const db = getAuthClient(authToken)

    const { data: { user }, error: authError } = await db.auth.getUser(authToken)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { prompt_key, prompt_text } = await request.json()
    if (!prompt_key || prompt_text === undefined) {
      return NextResponse.json({ error: 'prompt_key and prompt_text are required' }, { status: 400 })
    }

    const { data, error } = await db
      .from('tagging_prompts')
      .update({
        prompt_text,
        updated_by: user.email || user.id,
        updated_at: new Date().toISOString()
      })
      .eq('prompt_key', prompt_key)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
