import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createPLClient } from '@/lib/pl-supabase'
import { buildInitialTaggingPrompt, buildValidatorPrompt, type TaggingContext } from '@/lib/ai-prompts-tagging'
import { enrichArtistInfo } from '@/lib/artist-enrichment'
import { callOpenAIWithRetry } from '@/lib/openai-retry'

export async function POST(request: NextRequest) {
  try {
    const { entryId, phase, authToken } = await request.json()
    // phase: 'initial' or 'validate'

    if (!entryId || !phase) {
      return NextResponse.json({ error: 'Missing entryId or phase' }, { status: 400 })
    }

    // Auth
    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${authToken}` } } }
    )
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(authToken)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Load tagging entry
    const { data: entry, error: fetchError } = await supabaseAuth
      .from('tagging_entries')
      .select('*')
      .eq('id', entryId)
      .single()
    if (fetchError || !entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    // Load shared prompts (tagging_beast and validator)
    const { data: prompts } = await supabaseAuth
      .from('tagging_prompts')
      .select('*')
    const taggingBeastPrompt = prompts?.find((p: any) => p.prompt_key === 'tagging_beast')?.prompt_text || ''
    const validatorPrompt = prompts?.find((p: any) => p.prompt_key === 'validator')?.prompt_text || ''

    // Load taxonomy
    const { data: taxonomyCategories } = await supabaseAuth
      .from('tagging_taxonomy')
      .select('*')
      .eq('type', 'category')
      .order('sort_order')
    const { data: taxonomyTags } = await supabaseAuth
      .from('tagging_taxonomy')
      .select('*')
      .eq('type', 'tag')
      .order('sort_order')

    // Format taxonomy for prompt injection
    const categoriesText = (taxonomyCategories || []).map((c: any) => {
      const domain = c.domain ? ` (${c.domain})` : ''
      const selectable = c.is_selectable ? '' : ' [NON-SELECTABLE PARENT]'
      const group = c.parent_group ? `[${c.parent_group}] ` : ''
      return `- ${group}${c.name}${domain}${selectable}${c.description ? ': ' + c.description : ''}`
    }).join('\n')

    const tagsText = (taxonomyTags || []).map((t: any) => {
      const section = t.section === 'tag' ? `[${t.section}] ` : ''
      return `- ${section}${t.name}${t.description ? ': ' + t.description : ''}`
    }).join('\n')

    // Resolve API key and model early (needed for artist enrichment + main AI call)
    const customApiKey = request.headers.get('x-openai-key')
    const proMode = request.headers.get('x-ai-mode') === 'pro'
    const envApiKey = process.env.OPENAI_API_KEY
    const apiKey = customApiKey || envApiKey
    const model = proMode ? (process.env.OPENAI_PRO_MODEL || 'gpt-4o') : (process.env.OPENAI_MODEL || 'gpt-4o-mini')

    // Real-time artist enrichment: search for genre/nationality if not in source text
    let artistEnrichment = ''
    if (phase === 'initial' && apiKey) {
      artistEnrichment = await enrichArtistInfo(entry.source_text, apiKey, 'gpt-4o-mini')
    }

    const ctx: TaggingContext = {
      sourceText: entry.source_text,
      taggingBeastPrompt,
      validatorPrompt,
      categories: categoriesText,
      tags: tagsText,
      artistEnrichment,
    }

    let prompt: string
    if (phase === 'initial') {
      prompt = buildInitialTaggingPrompt(ctx)
    } else if (phase === 'validate') {
      if (!entry.initial_result) {
        return NextResponse.json({ error: 'Initial tagging must be completed before validation' }, { status: 400 })
      }
      prompt = buildValidatorPrompt(ctx, entry.initial_result)
    } else {
      return NextResponse.json({ error: 'Invalid phase. Use "initial" or "validate"' }, { status: 400 })
    }

    const systemMessage = 'You are TAGGING BEAST, a deterministic classification engine for Platinumlist.net. You execute rules. You never explain. You never guess. You output FINAL JSON ONLY.'

    let aiResult: string
    let usedProMode = false

    if (apiKey) {
      // Direct OpenAI call with retry on rate limit
      usedProMode = proMode
      const result = await callOpenAIWithRetry({
        apiKey,
        model,
        maxTokens: 4096,
        systemMessage,
        userPrompt: prompt,
        maxRetries: 2,
      })
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 500 })
      }
      aiResult = result.content
    } else {
      // Fallback: PL edge function (only if no API key available)
      const plClient = createPLClient()
      const { data: plData, error: plError } = await plClient.functions.invoke('ai-process', {
        body: { prompt: `[INSTRUCTIONS]\n${systemMessage}\n\n[TASK]\n${prompt}`, stepField: `tagging-${phase}`, eventTitle: '' },
      })
      if (plError) {
        return NextResponse.json({ error: plError.message || JSON.stringify(plError) }, { status: 500 })
      }
      aiResult = (plData?.result || plData?.text || plData?.content || '') as string
    }

    // Save result
    const updateData: Record<string, any> = { updated_at: new Date().toISOString() }
    if (phase === 'initial') {
      updateData.initial_result = aiResult
      updateData.status = 'initial_done'
    } else {
      updateData.validated_result = aiResult
      updateData.status = 'validated'
    }

    const { error: updateError } = await supabaseAuth
      .from('tagging_entries')
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
