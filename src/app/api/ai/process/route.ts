import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { STEP_PROMPTS, STEP_FIELD_TO_PROMPT, type StepContext } from '@/lib/ai-prompts'
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
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(authToken)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Load the entry from Rockstary DB
    const { data: entry, error: fetchError } = await supabaseAuth
      .from('content_entries')
      .select('*')
      .eq('id', entryId)
      .single()

    if (fetchError || !entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    // Check if the step has a prompt
    const promptKey = STEP_FIELD_TO_PROMPT[stepField]
    if (!promptKey || !STEP_PROMPTS[promptKey]) {
      return NextResponse.json({ error: `No AI prompt available for step: ${stepField}` }, { status: 400 })
    }

    // Build context from entry data
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

    // Check prerequisites
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

    // Generate the prompt
    const prompt = STEP_PROMPTS[promptKey](ctx)

    // Call AI via PL Supabase Edge Function or direct API
    // Using Anthropic Claude API via fetch
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    let aiResult: string

    if (anthropicKey) {
      // Use Anthropic Claude API directly
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
        }),
      })

      if (!aiResponse.ok) {
        const errText = await aiResponse.text()
        return NextResponse.json({ error: `AI API error: ${errText}` }, { status: 500 })
      }

      const aiData = await aiResponse.json()
      aiResult = aiData.content?.[0]?.text || 'No response from AI'
    } else {
      // Fallback: Use PL Supabase for AI processing if available
      // Or return a helpful message
      try {
        const plClient = createPLClient()
        // Try to call a PL edge function for AI processing
        const { data, error } = await plClient.functions.invoke('ai-process', {
          body: { prompt, stepField }
        })

        if (error) throw error
        aiResult = data?.result || 'No response from PL AI'
      } catch {
        // Ultimate fallback - generate a structured placeholder
        aiResult = `[AI Processing Required]\n\nStep: ${stepField}\nEvent: ${ctx.eventTitle}\n\nTo enable AI processing, add an ANTHROPIC_API_KEY environment variable in Vercel.\n\nPrompt preview:\n${prompt.substring(0, 500)}...`
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
