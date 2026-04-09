import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function createPLClient() {
  return createClient(
    process.env.PL_SUPABASE_URL!,
    process.env.PL_SUPABASE_SERVICE_KEY!
  )
}

// Active = live or upcoming; Inactive = past / removed
const ACTIVE_STATUSES = [
  'on sale',
  'on sale and hidden in the event guide',
  'coming soon',
  'pre-register',
  'approved',
  'sold out',
]
const INACTIVE_STATUSES = ['event ended', 'cancelled', 'declined', 'pending']

export async function GET(req: NextRequest) {
  try {
    const pl = createPLClient()
    const sp = req.nextUrl.searchParams
    const page       = parseInt(sp.get('page') || '1', 10)
    const limit      = 50
    const offset     = (page - 1) * limit
    const search     = sp.get('search') || ''
    const searchId   = sp.get('id') || ''
    const searchUrl  = sp.get('url') || ''
    const country    = sp.get('country') || ''
    const city       = sp.get('city') || ''
    const active     = sp.get('active')      // 'true' | 'false' | null
    const typeFilter = sp.get('type') || ''  // 'event' | 'attraction' | ''

    // ── Countries dropdown ───────────────────────────────────────
    // PostgREST caps at 1000 rows per request, so paginate to get all distinct countries
    if (sp.get('countries') === '1') {
      const allCountries = new Set<string>()
      const batchSize = 1000
      let from = 0
      while (true) {
        const { data, error } = await pl
          .from('hourly_sql_export')
          .select('country')
          .not('country', 'is', null)
          .order('country')
          .range(from, from + batchSize - 1)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        if (!data || data.length === 0) break
        ;(data as { country: string }[]).forEach(r => { if (r.country) allCountries.add(r.country) })
        if (data.length < batchSize) break
        from += batchSize
      }
      const unique = [...allCountries].sort()
      return NextResponse.json({ countries: unique })
    }

    // ── Main events query ────────────────────────────────────────
    type Row = Record<string, unknown>
    let query = pl.from('hourly_sql_export').select(
      `event_id,
       event_name_en, event_name_ar,
       event_short_name_en, event_short_name_ar,
       event_long_name_en, event_long_name_ar,
       event_start_datetime, event_end_datetime,
       added_datetime, number_of_dates,
       description_en, description_ar,
       overview_description_en, overview_description_ar,
       text_teaser_en, text_teaser_ar,
       country, city, venue, venue_ar, venue_info_en, venue_info_ar,
       min_price, currency, comission,
       status, is_attraction,
       url, friendly_url, has_video_teaser, has_schedule_block,
       event_organiser, connected_artist,
       marketing_tags, tag_categories, categories, all_categories,
       promo_img, promo_mob_img, artwork_label, promo_campaign_text,
       is_banner_active, is_super_event, is_exclusive, is_no_index,
       is_hidden_in_event_guide, is_hidden_in_calendar,
       public_tickets_available_on_site, overall_capacity,
       ticket_sold_count, timestamp_on_sale,
       is_general_admission_flag, has_mobile_tickets,
       has_resale, has_dynamic_tickets, resale_time_restriction,
       show_tooltip_about_resale, show_mobile_ticket_tooltip,
       mobile_tooltip_description_en, mobile_tooltip_description_ar,
       meta_title_en, meta_title_ar,
       meta_keywords_en, meta_keywords_ar,
       meta_description_en, meta_description_ar,
       seo_block_text_en, seo_block_text_ar, seo_qa_block,
       custom_block_additional_description,
       custom_block_attr_before_you_visit,
       custom_block_attr_cancel_policy,
       custom_block_attr_exclusions,
       custom_block_attr_featured_activities,
       custom_block_attr_highlights,
       custom_block_attr_inclusions,
       custom_block_attr_meeting_point,
       custom_block_attr_schedule,
       custom_block_attr_timings,
       custom_block_contact_info,
       custom_block_description,
       custom_block_event_info_combined,
       custom_block_event_age_limit,
       custom_block_event_dress_code,
       custom_block_event_language,
       custom_block_event_lineup,
       custom_block_event_program,
       custom_block_event_rules,
       custom_block_faqs,
       custom_block_how_to_get_there,
       custom_block_important_updates,
       custom_block_limited_time_activities,
       custom_block_new_activities,
       custom_block_policies,
       custom_block_special_offers,
       custom_block_terms_and_conditions,
       custom_block_ticket_information,
       custom_block_undefined,
       custom_block_what_to_expect_event_highlights,
       custom_block_what_you_can_take_optional`,
      { count: 'exact' }
    )

    if (searchId)  query = query.eq('event_id', parseInt(searchId, 10))
    if (searchUrl) query = query.ilike('url', `%${searchUrl}%`)
    if (search)    query = query.ilike('event_name_en', `%${search}%`)
    if (country)   query = query.eq('country', country)
    if (city)      query = query.ilike('city', `%${city}%`)
    if (active === 'true')  query = query.in('status', ACTIVE_STATUSES)
    if (active === 'false') query = query.in('status', INACTIVE_STATUSES)
    if (typeFilter === 'attraction') query = query.eq('is_attraction', true)
    else if (typeFilter === 'event') query = query.eq('is_attraction', false)

    query = query
      .order('added_datetime', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: events, count, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // ── Enrich with tagging_entries (primary / secondary categories) ─
    const eventUrls = (events ?? [])
      .map((e: Row) => e.url as string)
      .filter(Boolean)

    const catMap: Record<string, { primary: string | null; secondary: string | null }> = {}

    if (eventUrls.length > 0) {
      const { data: tagRows } = await pl
        .from('tagging_entries')
        .select('source_url, initial_result, validated_result')
        .in('source_url', eventUrls)

      for (const entry of tagRows ?? []) {
        try {
          const raw = (entry as Row).validated_result || (entry as Row).initial_result
          let parsed: { primary_category?: string; secondary_category?: string } = {}

          if (typeof raw === 'string') {
            parsed = JSON.parse(raw)
          } else if (raw && typeof raw === 'object') {
            const r = raw as { result?: string }
            parsed = r.result
              ? JSON.parse(r.result)
              : (raw as typeof parsed)
          }

          catMap[(entry as Row).source_url as string] = {
            primary:   parsed.primary_category   ?? null,
            secondary: parsed.secondary_category ?? null,
          }
        } catch {
          // ignore JSON parse errors
        }
      }
    }

    const enriched = (events ?? []).map((e: Row) => ({
      ...e,
      primary_category:   catMap[e.url as string]?.primary   ?? null,
      secondary_category: catMap[e.url as string]?.secondary ?? null,
    }))

    return NextResponse.json({ events: enriched, total: count })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
