import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function createPLClient() {
  return createClient(
    process.env.PL_SUPABASE_URL!,
    process.env.PL_SUPABASE_SERVICE_KEY!
  )
}

function getRSClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
    const rs = getRSClient(token)
    const pl = createPLClient()
    const sp = req.nextUrl.searchParams
    const page = parseInt(sp.get('page') || '1', 10)
    const perPage = 50
    const search = sp.get('search') || ''
    const filterType = sp.get('filter') || '' // 'categories' | 'tags' | ''
    const excludedRaw = sp.get('excluded') || ''
    const excluded = new Set(excludedRaw ? excludedRaw.split(',').map(s => s.trim()).filter(Boolean) : [])

    // ── Load authorized taxonomy ──────────────────────────────
    const { data: taxonomy, error: taxErr } = await rs
      .from('tagging_taxonomy')
      .select('type, name, is_selectable')

    if (taxErr) return NextResponse.json({ error: taxErr.message }, { status: 500 })

    const authCats = new Set<string>(
      (taxonomy || [])
        .filter(t => t.type === 'category' && t.is_selectable !== false)
        .map(t => (t.name as string).trim())
    )
    const authTags = new Set<string>(
      (taxonomy || [])
        .filter(t => t.type === 'tag')
        .map(t => (t.name as string).trim())
    )

    // ── Scan events in batches ────────────────────────────────
    const BATCH = 1000
    const allIssues: object[] = []
    let from = 0

    while (true) {
      let q = pl
        .from('hourly_sql_export')
        .select(
          'event_id, event_name_en, event_name_ar, all_categories, marketing_tags, ' +
          'status, url, country, city, event_start_datetime, event_end_datetime, is_attraction'
        )
        .range(from, from + BATCH - 1)
        .order('added_datetime', { ascending: false })

      if (search) q = q.ilike('event_name_en', `%${search}%`)

      const { data: batch, error } = await q
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      if (!batch || batch.length === 0) break

      for (const ev of batch) {
        if (excluded.has(String(ev.event_id))) continue

        const catIssues: string[] = []
        const tagIssues: string[] = []

        // Check categories — all_categories is semicolon-separated
        if (ev.all_categories) {
          String(ev.all_categories)
            .split(';')
            .map(s => s.trim())
            .filter(Boolean)
            .forEach(c => { if (!authCats.has(c)) catIssues.push(c) })
        }

        // Check marketing tags — array or comma-separated
        if (ev.marketing_tags) {
          const tags: string[] = Array.isArray(ev.marketing_tags)
            ? ev.marketing_tags
            : String(ev.marketing_tags).split(',').map(s => s.trim()).filter(Boolean)
          tags.forEach(t => { if (!authTags.has(t)) tagIssues.push(t) })
        }

        const hasCatIssue = catIssues.length > 0
        const hasTagIssue = tagIssues.length > 0
        const shouldInclude =
          (filterType === 'categories' && hasCatIssue) ||
          (filterType === 'tags' && hasTagIssue) ||
          (!filterType && (hasCatIssue || hasTagIssue))

        if (shouldInclude) {
          allIssues.push({ ...ev, cat_issues: catIssues, tag_issues: tagIssues })
        }
      }

      // Stop after 5000 events to keep response time reasonable
      from += BATCH
      if (from >= 5000) break
    }

    const start = (page - 1) * perPage
    const pageItems = allIssues.slice(start, start + perPage)

    return NextResponse.json({
      events: pageItems,
      total: allIssues.length,
      page,
      pages: Math.ceil(allIssues.length / perPage),
      taxonomy: { categories: authCats.size, tags: authTags.size },
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
