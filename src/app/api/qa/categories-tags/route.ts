import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

interface EventRow {
  event_id: number
  event_name_en: string
  all_categories: string | null
  marketing_tags: string[] | string | null
  status: string | null
  url: string | null
  country: string | null
  city: string | null
  event_start_datetime: string | null
  is_attraction: boolean | null
}

interface ParsedEvent {
  ev: EventRow
  cats: string[]
  tags: string[]
}

interface AIResult {
  index: number
  wrong_categories?: string[]
  wrong_tags?: string[]
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = (searchParams.get('mode') || 'both') as 'categories' | 'tags' | 'both'
  const search = searchParams.get('search') || ''
  const excluded = searchParams.get('excluded')?.split(',').filter(Boolean) ?? []
  const max = Math.min(parseInt(searchParams.get('max') || '100'), 300)

  const pl = createClient(
    process.env.PL_SUPABASE_URL!,
    process.env.PL_SUPABASE_SERVICE_KEY!
  )
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  try {
    let query = pl
      .from('hourly_sql_export')
      .select('event_id,event_name_en,all_categories,marketing_tags,status,url,country,city,event_start_datetime,is_attraction')
      .limit(max)

    if (search) query = (query as any).ilike('event_name_en', `%${search}%`)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const rows = (data as EventRow[]).filter(
      (ev) => !excluded.includes(String(ev.event_id))
    )

    // Parse categories and tags per event
    const parsed: ParsedEvent[] = rows
      .map((ev) => {
        const cats =
          ev.all_categories
            ?.split(';')
            .map((s) => s.trim())
            .filter(Boolean) ?? []

        let tags: string[] = []
        if (Array.isArray(ev.marketing_tags)) {
          tags = (ev.marketing_tags as string[]).map((s) => String(s).trim()).filter(Boolean)
        } else if (typeof ev.marketing_tags === 'string') {
          tags = ev.marketing_tags.split(',').map((s) => s.trim()).filter(Boolean)
        }

        return { ev, cats, tags }
      })
      .filter((r) => {
        if (mode === 'categories') return r.cats.length > 0
        if (mode === 'tags') return r.tags.length > 0
        return r.cats.length > 0 || r.tags.length > 0
      })

    // AI batch evaluation — 25 events per call
    const BATCH = 25
    const issues: object[] = []

    for (let i = 0; i < parsed.length; i += BATCH) {
      const batch = parsed.slice(i, i + BATCH)

      const lines = batch
        .map((r, idx) => {
          const label = `${idx}. "${r.ev.event_name_en}" (${r.ev.is_attraction ? 'Attraction' : 'Event'}, ${r.ev.country ?? ''})`
          const catPart = mode !== 'tags' ? `Categories: [${r.cats.join('; ')}]` : ''
          const tagPart = mode !== 'categories' ? `Tags: [${r.tags.join(', ')}]` : ''
          return [label, catPart, tagPart].filter(Boolean).join(' | ')
        })
        .join('\n')

      const checkWhat =
        mode === 'categories' ? 'categories' : mode === 'tags' ? 'tags' : 'categories and tags'

      const prompt = `You are a QA auditor for a UAE event ticketing platform. Review these events/attractions and their applied ${checkWhat}.

Your job: identify labels that are CLEARLY WRONG or MISLEADING for the event type.

Rules:
- Flag only obvious semantic mismatches. Example: "Comedy Shows" on Swan Lake (a ballet) is WRONG. "Music" on a marathon race is WRONG.
- A label is wrong if it describes a fundamentally different type of activity or genre.
- If a label could plausibly apply, do NOT flag it.
- Wrong categories go in "wrong_categories", wrong tags in "wrong_tags".
- Only include an entry in your response if there is at least one wrong label.
- Return ONLY a valid JSON array, no explanation, no markdown.

Events:
${lines}

Response format (only events with issues, empty array [] if none):
[{"index":0,"wrong_categories":["Wrong Cat"],"wrong_tags":["wrong-tag"]}]`

      try {
        const res = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }],
        })

        const rawText = res.content[0].type === 'text' ? res.content[0].text.trim() : '[]'
        const jsonMatch = rawText.match(/\[[\s\S]*\]/)
        if (!jsonMatch) continue

        const results: AIResult[] = JSON.parse(jsonMatch[0])

        for (const r of results) {
          const item = batch[r.index]
          if (!item) continue
          const wrongCats = r.wrong_categories ?? []
          const wrongTags = r.wrong_tags ?? []
          if (wrongCats.length || wrongTags.length) {
            issues.push({
              event_id: item.ev.event_id,
              event_name: item.ev.event_name_en,
              status: item.ev.status,
              url: item.ev.url,
              country: item.ev.country,
              city: item.ev.city,
              start_date: item.ev.event_start_datetime,
              is_attraction: item.ev.is_attraction,
              applied_categories: item.cats,
              applied_tags: item.tags,
              wrong_categories: wrongCats,
              wrong_tags: wrongTags,
            })
          }
        }
      } catch {
        // skip bad AI batch, continue
      }
    }

    return NextResponse.json({
      events: issues,
      total: issues.length,
      scanned: parsed.length,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
