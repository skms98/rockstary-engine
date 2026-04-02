import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function createPLClient() {
  return createClient(
    process.env.PL_SUPABASE_URL!,
    process.env.PL_SUPABASE_SERVICE_KEY!
  )
}

export async function GET(req: NextRequest) {
  try {
    const pl = createPLClient()
    const url = req.nextUrl.searchParams

    const page = parseInt(url.get('page') || '1', 10)
    const limit = 50
    const offset = (page - 1) * limit

    const search = url.get('search') || ''
    const country = url.get('country') || ''
    const city = url.get('city') || ''
    const active = url.get('active') // 'true' | 'false' | null

    // ---------- countries list (for dropdown) ----------
    if (url.get('countries') === '1') {
      const { data, error } = await pl
        .from('event_relational_db')
        .select('country')
        .not('country', 'is', null)
        .order('country')

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      const unique = [...new Set((data || []).map((r: { country: string }) => r.country).filter(Boolean))]
      return NextResponse.json({ countries: unique })
    }

    // ---------- events list ----------
    let query = pl
      .from('event_relational_db')
      .select(
        'event_id, event_name_en, event_start_datetime, country, city, venue, min_price, currency, status, is_active, url, event_organiser',
        { count: 'exact' }
      )

    if (search) query = query.ilike('event_name_en', `%${search}%`)
    if (country) query = query.eq('country', country)
    if (city) query = query.ilike('city', `%${city}%`)
    if (active === 'true') query = query.eq('is_active', true)
    if (active === 'false') query = query.eq('is_active', false)

    query = query.order('event_start_datetime', { ascending: false })
    query = query.range(offset, offset + limit - 1)

    const { data, count, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ events: data, total: count })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
