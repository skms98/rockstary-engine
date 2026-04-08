import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createPLClient } from '@/lib/pl-supabase'
import { buildInitialTaggingPrompt, buildValidatorPrompt, type TaggingContext } from '@/lib/ai-prompts-tagging'

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
      const section = t.section ? `[${t.section}] ` : ''
      return `- ${section}${t.name}${t.description ? ': ' + t.description : ''}`
    }).join('\n')

    const ctx: TaggingContext = {
      sourceText: entry.source_text,
      taggingBeastPrompt,
      validatorPrompt,
      categories: categoriesText,
      tags: tagsText,
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

    // Custom key from frontend settings (takes priority over PL edge function)
    const customApiKey = request.headers.get('x-openai-key')
    const proMode = request.headers.get('x-ai-mode') === 'pro'

    // Call AI - pro mode skips PL and uses custom key directly
    let aiResult: string
    let usedProMode = false
    try {
      if (proMode && customApiKey) throw new Error('pro_mode')
      const plClient = createPLClient()
      const { data, error } = await plClient.functions.invoke('ai-process', {
        body: { prompt, stepField: `tagging_${phase}`, eventTitle: entry.title || 'Tagging' }
      })
      if (error) throw error
      aiResult = data?.result || data?.text || data?.content || (typeof data === 'string' ? data : JSON.stringify(data))
    } catch (plError: any) {
      if (plError?.message === 'pro_mode') usedProMode = true
      const openaiKey = usedProMode
        ? (customApiKey || process.env.OPENAI_API_KEY)
        : customApiKey
      const anthropicKey = process.env.ANTHROPIC_API_KEY

      if (openaiKey) {
        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
          body: JSON.stringify({
            model: usedProMode ? 'gpt-5-mini' : 'gpt-4o-mini',
            max_completion_tokens: 4096,
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
      } else if (anthropicKey) {
        const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            messages: [{ role: 'user', content: prompt }],
            system: systemMessage,
          }),
        })
        if (!aiResponse.ok) {
          const errText = await aiResponse.text()
          return NextResponse.json({ error: `AI error: ${errText}` }, { status: 500 })
        }
        const aiData = await aiResponse.json()
        aiResult = aiData.content?.[0]?.text || 'No response from AI'
      } else {
        return NextResponse.json({
          error: `PL AI edge function error: ${plError?.message || 'Unknown'}. No fallback API keys.`
        }, { status: 500 })
      }
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
