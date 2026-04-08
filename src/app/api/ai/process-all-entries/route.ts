import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ATTRACTION_AI_STEPS } from '@/lib/ai-prompts-attractions'

// Process all entries for a given mode (events/attractions)
// Runs all AI steps sequentially per entry, entries processed one-by-one
// Uses mode-specific step sequences
export async function POST(request: NextRequest) {
  try {
    const { mode, authToken, entryIds } = await request.json()
    const baseUrl = request.nextUrl.origin

    // Forward AI mode headers so pro mode works in the chain
    const customApiKey = request.headers.get('x-openai-key') || ''
    const aiMode = request.headers.get('x-ai-mode') || ''

    if (!mode || !authToken) {
      return NextResponse.json({ error: 'Missing mode or authToken' }, { status: 400 })
    }

    // Verify user auth
    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${authToken}` } } }
    )

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(authToken)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Load entries for this mode
    let query = supabaseAuth
      .from('content_entries')
      .select('id, event_id, event_title, original_description, status')
      .eq('mode', mode)
      .order('created_at', { ascending: true })

    // If specific entry IDs provided, filter to those
    if (entryIds && entryIds.length > 0) {
      query = query.in('id', entryIds)
    }

    const { data: entries, error: fetchError } = await query

    if (fetchError || !entries || entries.length === 0) {
      return NextResponse.json({ error: 'No entries found', details: fetchError?.message }, { status: 404 })
    }

    // Filter to entries that have original_description (prerequisite for AI steps)
    const processable = entries.filter(e => e.original_description && e.original_description.trim() !== '')
    const skipped = entries.length - processable.length

    // Use mode-specific AI steps
    const EVENTS_AI_STEPS = [
      'recommended_versions',
      'fact_check_scores',
      'duplicate_analysis',
      'ab_tests',
      'organiser_trigger_risk',
      'tov_score',
      'grammar_style',
      'reviewer_output',
      'resolver_output',
      'seo_analysis',
      'fact_check_final',
      'ranked_versions',
    ]

    const AI_STEPS = mode === 'attractions' ? ATTRACTION_AI_STEPS : EVENTS_AI_STEPS

    const results: Array<{
      entryId: string
      eventId: string
      eventTitle: string
      status: 'success' | 'partial' | 'error'
      stepsCompleted: number
      stepsTotal: number
      errors: string[]
    }> = []

    // Process each entry sequentially (pipeline dependency for events)
    for (const entry of processable) {
      const entryResult = {
        entryId: entry.id,
        eventId: entry.event_id,
        eventTitle: entry.event_title,
        status: 'success' as 'success' | 'partial' | 'error',
        stepsCompleted: 0,
        stepsTotal: AI_STEPS.length,
        errors: [] as string[],
      }

      // Update status to in_progress
      await supabaseAuth
        .from('content_entries')
        .update({ status: 'in_progress', updated_at: new Date().toISOString() })
        .eq('id', entry.id)

      for (const step of AI_STEPS) {
        try {
          const aiHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
          if (customApiKey) aiHeaders['x-openai-key'] = customApiKey
          if (aiMode) aiHeaders['x-ai-mode'] = aiMode

          const res = await fetch(`${baseUrl}/api/ai/process`, {
            method: 'POST',
            headers: aiHeaders,
            body: JSON.stringify({
              entryId: entry.id,
              stepField: step,
              authToken,
            }),
          })

          if (res.ok) {
            entryResult.stepsCompleted++
          } else {
            const data = await res.json().catch(() => ({ error: 'Unknown error' }))
            entryResult.errors.push(`${step}: ${data.error || res.statusText}`)
            // For events mode, continue despite errors (next step might still work)
            // For attractions, also continue
          }
        } catch (err: any) {
          entryResult.errors.push(`${step}: ${err.message}`)
        }
      }

      // Set final status
      if (entryResult.stepsCompleted === AI_STEPS.length) {
        entryResult.status = 'success'
        await supabaseAuth
          .from('content_entries')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', entry.id)
      } else if (entryResult.stepsCompleted > 0) {
        entryResult.status = 'partial'
      } else {
        entryResult.status = 'error'
      }

      results.push(entryResult)
    }

    return NextResponse.json({
      success: true,
      mode,
      totalEntries: entries.length,
      processed: processable.length,
      skipped,
      results,
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
