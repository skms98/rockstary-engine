import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createPLClient } from '@/lib/pl-supabase'
import { buildInitialTaggingPrompt, buildValidatorPrompt, type TaggingContext } from '@/lib/ai-prompts-tagging'
import { enrichArtistInfo } from '@/lib/artist-enrichment'

export async function POST(request: NextRequest) {
  try {
    const { entryId, phase, authToken, adminKey } = await request.json()

    if (!entryId || !phase) {
      return NextResponse.json({ error: 'Missing entryId or phase' }, { status: 400 })
    }

    // Admin mode: bypass Supabase auth using service key
    const isAdmin = adminKey && process.env.ADMIN_API_KEY && adminKey === process.env.ADMIN_API_KEY
    let dbClient: any

    if (isAdmin) {
      dbClient = createPLClient()
    } else {
      const supabaseAuth = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${authToken}` } } }
      )
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(authToken)
      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      dbClient = supabaseAuth
    }

    // Load the event entry from content_entries
    const { data: entry, error: fetchError } = await dbClient
      .from('content_entries')
      .select('*')
      .eq('id', entryId)
      .single()

    if (fetchError || !entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    if (!entry.original_description) {
      return NextResponse.json({
        error: 'Original description (Step S1) is required before running tagging'
      }, { status: 400 })
    }

    if (phase === 'validate' && !entry.categories_initial) {
      return NextResponse.json({
        error: 'Run the Initial tagging phase first before validation'
      }, { status: 400 })
    }

    if (!['initial', 'validate'].includes(phase)) {
      return NextResponse.json({ error: 'Invalid phase. Use "initial" or "validate"' }, { status: 400 })
    }

    // Load prompts from tagging_prompts table (same live source as Tagging Tool)
    const { data: prompts } = await dbClient.from('tagging_prompts').select('*')
    const taggingBeastPrompt = prompts?.find((p: any) => p.prompt_key === 'tagging_beast')?.prompt_text || ''
    const validatorPrompt = prompts?.find((p: any) => p.prompt_key === 'validator')?.prompt_text || ''

    // Load live taxonomy (same source as Tagging Tool)
    const [{ data: taxonomyCategories }, { data: taxonomyTags }] = await Promise.all([
      dbClient.from('tagging_taxonomy').select('*').eq('type', 'category').order('sort_order'),
      dbClient.from('tagging_taxonomy').select('*').eq('type', 'tag').order('sort_order'),
    ])

    const categoriesText = (taxonomyCategories || []).map((c: any) => {
      const domain = c.domain ? ` (${c.domain})` : ''
      const selectable = c.is_selectable ? '' : ' [NON-SELECTABLE PARENT]'
      const group = c.parent_group ? `[${c.parent_group}] ` : ''
      return `- ${group}${c.name}${domain}${selectable}${c.description ? ': ' + c.description : ''}`
    }).join('\n')

    const tagsText = (taxonomyTags || []).map((t: any) => {
      const section = t.section ? `[${t.section}] ` : ''
      return `- ${section}${t.name}${t.description ? ': ' + t.description : ''}`
    }).join('\n')

    // Resolve API key and model early (needed for artist enrichment + main AI call)
    const customApiKey = request.headers.get('x-openai-key')
    const proMode = request.headers.get('x-ai-mode') === 'pro'
    const envApiKey = process.env.OPENAI_API_KEY
    const apiKey = customApiKey || envApiKey
    const model = proMode ? (process.env.OPENAI_PRO_MODEL || 'gpt-4o') : (process.env.OPENAI_MODEL || 'gpt-4o-mini')

    // Build source text from event data
    const sourceText = [
      `Event: ${entry.event_title || ''}`,
      entry.event_url ? `URL: ${entry.event_url}` : '',
      '',
      entry.original_description || '',
    ].filter(Boolean).join('\n')

    // Real-time artist enrichment: search for genre/nationality if not in source text
    let artistEnrichment = ''
    if (phase === 'initial' && apiKey) {
      artistEnrichment = await enrichArtistInfo(sourceText, apiKey, 'gpt-4o-mini')
    }

    const ctx: TaggingContext = {
      sourceText,
      taggingBeastPrompt,
      validatorPrompt,
      categories: categoriesText,
      tags: tagsText,
      artistEnrichment,
    }

    let prompt: string
    if (phase === 'initial') {
      prompt = buildInitialTaggingPrompt(ctx)
    } else {
      prompt = buildValidatorPrompt(ctx, entry.categories_initial)
    }

    const systemMessage = 'You are TAGGING BEAST, a deterministic classification engine for Platinumlist.net. You execute rules. You never explain. You never guess. You output FINAL JSON ONLY.'

    let aiResult: string
    let usedProMode = false

    if (apiKey) {
      // Direct OpenAI call using available key
      usedProMode = proMode
      const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: prompt },
          ],
        }),
      })
      if (!aiResponse.ok) {
        const errText = await aiResponse.text()
        return NextResponse.json({ error: `AI error: ${errText}` }, { status: 500 })
      }
      const aiData = await aiResponse.json()
      aiResult = aiData.choices?.[0]?.message?.content || 'No response from AI'
    } else {
      // Fallback: PL edge function (only if no API key available)
      const plClient = createPLClient()
      const { data: plData, error: plError } = await plClient.functions.invoke('ai-process', {
        body: { prompt: `[INSTRUCTIONS]\n${systemMessage}\n\n[TASK]\n${prompt}`, stepField: `categories-${phase}`, eventTitle: '' },
      })
      if (plError) {
        return NextResponse.json({ error: plError.message || JSON.stringify(plError) }, { status: 500 })
      }
      aiResult = (plData?.result || plData?.text || plData?.content || '') as string
    }

    // Save result to content_entries
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
      status: 'in_progress',
    }

    if (phase === 'initial') {
      updateData.categories_initial = aiResult
    } else {
      // Validated result → final categories field
      updateData.categories = aiResult
      // Extract tags if present in output
      const tagsMatch = aiResult.match(/TAGS:\s*\n([^\n]+)/i)
      if (tagsMatch) {
        updateData.tags = tagsMatch[1].trim()
      }
    }

    const { error: updateError } = await dbClient
      .from('content_entries')
      .update(updateData)
      .eq('id', entryId)

    if (updateError) {
      return NextResponse.json({ error: `Failed to save: ${updateError.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, result: aiResult, phase, aiMode: usedProMode ? 'pro' : 'regular' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
