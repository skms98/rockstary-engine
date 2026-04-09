import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  const pl = createClient(
    process.env.PL_SUPABASE_URL!,
    process.env.PL_SUPABASE_SERVICE_KEY!
  )
  const { data, error } = await pl.rpc('get_table_columns', {
    target_table: 'all_events_on_sale',
  }).select()

  if (error) {
    // Fallback: try information_schema via raw query isn't possible with supabase-js directly
    // Instead select one row with all columns to inspect keys
    const { data: row, error: rowErr } = await pl
      .from('all_events_on_sale')
      .select('*')
      .limit(1)
    if (rowErr) return NextResponse.json({ error: rowErr.message }, { status: 500 })
    const cols = row && row.length > 0 ? Object.keys(row[0]).sort() : []
    return NextResponse.json({ columns: cols, source: 'all_events_on_sale' })
  }

  return NextResponse.json({ data })
}
