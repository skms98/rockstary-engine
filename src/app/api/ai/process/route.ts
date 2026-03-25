import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { STEP_PROMPTS, STEP_FIELD_TO_PROMPT, type StepContext } from '@/lib/ai-prompts'
import { ATTRACTION_PROMPTS, ATTRACTION_FIELD_TO_PROMPT, type AttractionStepContext } from '@/lib/ai-prompts-attractions'
import { createPLClient } from '@/lib/pl-supabase'

// Server-side only route - credentials never exposed to browser
export async function POST(request: NextRequest) {
  try {
    const { entryId, stepField, authToken } = await request.json()

    if (!entryId || !stepField) {
      return NextResponse.json({ error: 'Missing entryId or stepField' }, { status: 400 })
    }

    // Verify user is authenticated via Rockstary auth
    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${authToken}` } } }
    )

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(authToken)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Load the entry from Rockstary DB (RLS will filter to user's own entries)
    const { data: entry, error: fetchError } = await supabaseAuth
      .from('content_entries')
      .select('*')
      .eq('id', entryId)
      .single()

    if (fetchError || !entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    // Detect mode and use the right prompt system
    const isAttraction = entry.mode === 'attractions'
    let prompt: string

    if (isAttraction) {
      // ATTRACTIONS MODE â keyword-optimized pipeline
      const attractionPromptKey = ATTRACTION_FIELD_TO_PROMPT[stepField]
      if (!attractionPromptKey || !ATTRACTION_PROMPTS[attractionPromptKey]) {
        return NextResponse.json({ error: `No attraction AI prompt available for step: ${stepField}` }, { status: 400 })
      }

      const actx: AttractionStepContext = {
        attractionName: entry.event_title || '',
        attractionUrl: entry.event_url || '',
        originalDescription: entry.original_description || '',
        keywordsList: entry.keywords_list || '',
        recommendedVersions: entry.recommended_versions || '',
        factCheckScores: entry.fact_check_scores || '',
        duplicateAnalysis: entry.duplicate_analysis || '',
        tovScore: entry.tov_score || '',
        grammarStyle: entry.grammar_style || '',
        reviewerOutput: entry.reviewer_output || '',
        resolverOutput: entry.resolver_output || '',
        prevOriginalDescription: entry.prev_original_description || '',
        seoAnalysis: entry.seo_analysis || '',
        factCheckFinal: entry.fact_check_final || '',
        optimizedDescription: entry.optimized_description || '',
        rankedVersions: entry.ranked_versions || '',
      }

      // Check prerequisites for attractions
      if (stepField === 'keywords_list' && !actx.originalDescription) {
        return NextResponse.json({
          error: 'Original description is required before generating keywords'
        }, { status: 400 })
      }

      if (stepField === 'recommended_versions') {
        if (!actx.originalDescription) {
          return NextResponse.json({
            error: 'Original description is required before creating optimized versions'
          }, { status: 400 })
        }
        if (!actx.keywordsList) {
          return NextResponse.json({
            error: 'Keywords list is required before creating keyword-optimized versions. Run the Keywords step first.'
          }, { status: 400 })
        }
      }

      if (['fact_check_scores', 'duplicate_analysis', 'tov_score', 'grammar_style'].includes(stepField)) {
        if (!actx.originalDescription || !actx.recommendedVersions) {
          return NextResponse.json({
            error: 'Original description and Keyword-Optimized Versions are required before running this step'
          }, { status: 400 })
        }
      }

      prompt = ATTRACTION_PROMPTS[attractionPromptKey](actx)

    } else {
      // EVENTS MODE â original 13-step pipeline
      const promptKey = STEP_FIELD_TO_PROMPT[stepField]
      if (!promptKey || !STEP_PROMPTS[promptKey]) {
        return NextResponse.json({ error: `No AI prompt available for step: ${stepField}` }, { status: 400 })
      }

      const ctx: StepContext = {
        eventTitle: entry.event_title || '',
        eventUrl: entry.event_url || '',
        originalDescription: entry.original_description || '',
        recommendedVersions: entry.recommended_versions || '',
        factCheckScores: entry.fact_check_scores || '',
        duplicateAnalysis: entry.duplicate_analysis || '',
        abTests: entry.ab_tests || '',
        organiserTriggerRisk: entry.organiser_trigger_risk || '',
        tovScore: entry.tov_score || '',
        grammarStyle: entry.grammar_style || '',
        reviewerOutput: entry.reviewer_output || '',
        resolverOutput: entry.resolver_output || '',
        prevOriginalDescription: entry.prev_original_description || '',
        seoAnalysis: entry.seo_analysis || '',
        factCheckFinal: entry.fact_check_final || '',
        rankedVersions: entry.ranked_versions || '',
      }

      // Check prerequisites for events
      if (stepField === 'recommended_versions' && !ctx.originalDescription) {
        return NextResponse.json({
          error: 'Original description (Step 1) is required before running this step'
        }, { status: 400 })
      }

      if (['fact_check_scores', 'duplicate_analysis', 'ab_tests', 'organiser_trigger_risk', 'tov_score', 'grammar_style'].includes(stepField)) {
        if (!ctx.originalDescription || !ctx.recommendedVersions) {
          return NextResponse.json({
            error: 'Original description and Recommended versions are required before running this step'
          }, { status: 400 })
        }
      }

      prompt = STEP_PROMPTS[promptKey](ctx)
    }

    // Call AI via PL Supabase edge function (primary)
    let aiResult: string
    const systemMessage = isAttraction
      ? 'You are a professional content writer and SEO specialist for Platinumlist.net, specializing in attraction and experience descriptions for a leading ticketing platform in the Middle East.'
      : 'You are a professional content editor and analyst for Platinumlist.net, a leading events and entertainment ticketing platform in the Middle East.'

    try {
      const plClient = createPLClient()
      const { data, error } = await plClient.functions.invoke('ai-process', {
        body: { prompt, stepField, eventTitle: entry.event_title || '' }
      })
      if (error) throw error
      aiResult = data?.result || data?.text || data?.content || (typeof data === 'string' ? data : JSON.stringify(data))
    } catch (plError: any) {
      // If PL edge function fails, try direct OpenAI/Anthropic as fallback
      const openaiKey = process.env.OPENAI_API_KEY
      const anthropicKey = process.env.ANTHROPIC_API_KEY

      if (openaiKey) {
        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o',
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
          error: `PL AI edge function error: ${plError?.message || 'Unknown error'}. No fallback API keys configured.`
        }, { status: 500 })
      }
    }

    // Save result to the entry
    const { error: updateError } = await supabaseAuth
      .from('content_entries')
      .update({
        [stepField]: aiResult,
        updated_at: new Date().toISOString(),
        status: 'in_progress',
      })
      .eq('id', entryId)

    if (updateError) {
      return NextResponse.json({ error: `Failed to save: ${updateError.message}` }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      result: aiResult,
      step: stepField,
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
