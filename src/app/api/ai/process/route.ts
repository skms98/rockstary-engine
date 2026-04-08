import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { STEP_PROMPTS, STEP_FIELD_TO_PROMPT, type StepContext } from '@/lib/ai-prompts'
import { ATTRACTION_PROMPTS, ATTRACTION_FIELD_TO_PROMPT, type AttractionStepContext } from '@/lib/ai-prompts-attractions'
import { createPLClient } from '@/lib/pl-supabase'

// Server-side only route - credentials never exposed to browser
export async function POST(request: NextRequest) {
  try {
    const { entryId, stepField, authToken, adminKey } = await request.json()

    if (!entryId || !stepField) {
      return NextResponse.json({ error: 'Missing entryId or stepField' }, { status: 400 })
    }

    // Admin mode: bypass Supabase auth using service key (for server-to-server / testing)
    const isAdmin = adminKey && process.env.ADMIN_API_KEY && adminKey === process.env.ADMIN_API_KEY
    let dbClient: any

    if (isAdmin) {
      // Use PL service client (bypasses RLS)
      dbClient = createPLClient()
    } else {
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
      dbClient = supabaseAuth
    }

    // Load the entry from Rockstary DB
    const { data: entry, error: fetchError } = await dbClient
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
      // ATTRACTIONS MODE — keyword-optimized pipeline
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
      // EVENTS MODE — original 13-step pipeline
      const promptKey = STEP_FIELD_TO_PROMPT[stepField]
      if (!promptKey || !STEP_PROMPTS[promptKey]) {
        return NextResponse.json({ error: `No AI prompt available for step: ${stepField}` }, { status: 400 })
      }

      // Format screenshots as ordered text with section grouping for prompt context
      let screenshotsText = ''
      if (entry.screenshots && Array.isArray(entry.screenshots) && entry.screenshots.length > 0) {
        const sorted = [...entry.screenshots].sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
        // Build section display: group-aware labelling
        const seenGroups: number[] = []
        sorted.forEach((s: any) => { if (s.group && !seenGroups.includes(s.group)) seenGroups.push(s.group) })
        const hasGroups = seenGroups.length > 0

        if (hasGroups) {
          const groupCounts: Record<number, number> = {}
          sorted.forEach((s: any) => { groupCounts[s.group] = (groupCounts[s.group] || 0) + 1 })
          const groupRunning: Record<number, number> = {}
          screenshotsText = sorted.map((s: any) => {
            const gIdx = seenGroups.indexOf(s.group) + 1
            groupRunning[s.group] = (groupRunning[s.group] || 0) + 1
            const partNum = groupRunning[s.group]
            const total = groupCounts[s.group]
            if (total > 1) {
              return `Section ${gIdx}, part ${partNum} of ${total}: ${s.url}`
            }
            return `Section ${gIdx}: ${s.url}`
          }).join('\n')
          screenshotsText = `${sorted.length} screenshots across ${seenGroups.length} sections (screenshots in the same section cover the same page area, stitched together):\n${screenshotsText}`
        } else {
          // Legacy: no group info, flat numbering
          screenshotsText = sorted
            .map((s: any, i: number) => `Screenshot ${i + 1} of ${sorted.length}: ${s.url}`)
            .join('\n')
        }
      } else if (entry.screenshot_url) {
        screenshotsText = `Screenshot 1 of 1: ${entry.screenshot_url}`
      }

      const ctx: StepContext = {
        eventTitle: entry.event_title || '',
        eventUrl: entry.event_url || '',
        screenshots: screenshotsText,
        pageQaComments: entry.page_qa_comments || '',
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

    // Custom key from frontend settings (takes priority over PL edge function)
    const customApiKey = request.headers.get('x-openai-key')
    const proMode = request.headers.get('x-ai-mode') === 'pro'

    // Call AI via PL Supabase edge function (primary) — pro mode skips PL
    let aiResult: string
    const systemMessage = isAttraction
      ? 'You are a professional content writer and SEO specialist for Platinumlist.net, specializing in attraction and experience descriptions for a leading ticketing platform in the Middle East.'
      : `You are a professional content editor and analyst for Platinumlist.net, a leading events and entertainment ticketing platform in the Middle East.

You apply Platinumlist B2C TOV 2.4 to ALL content you produce or evaluate. Core rules:
- Write like a warm, knowledgeable friend - not a brochure or press release
- Lead with experience and emotion, not logistics
- Use casual, rhythmic, modern phrasing. UK English throughout
- Active voice preferred. Sentences max 22-24 words
- NEVER use em dashes (the \u2014 character is banned)
- BANNED WORDS: unforgettable, incredible, amazing, spectacular, must-see, extraordinary, like no other, once-in-a-lifetime, not to be missed, don't miss out, we are pleased to announce, we are delighted, we are thrilled, immerse yourself, promises to be, memorable moments, an evening to remember
- 5 TOV pillars: Inviting & Human / Energetic & Playful / Inclusive & Local / Reassuring & Kind / Joyful & Actionable`

    try {
      if (proMode && customApiKey) throw new Error('pro_mode')
      const plClient = createPLClient()
      const { data, error } = await plClient.functions.invoke('ai-process', {
        body: { prompt, stepField, eventTitle: entry.event_title || '' }
      })
      if (error) throw error
      aiResult = data?.result || data?.text || data?.content || (typeof data === 'string' ? data : JSON.stringify(data))
    } catch (plError: any) {
      // If PL edge function fails, use custom key if available, then env key
      const openaiKey = customApiKey || process.env.OPENAI_API_KEY
      const anthropicKey = process.env.ANTHROPIC_API_KEY

      if (openaiKey) {
        // Heavy steps (reviewer, resolver, ranked) need more tokens — 16384 for full 4-variant output
        const heavySteps = ['reviewer_output', 'resolver_output', 'ranked_versions', 'recommended_versions', 'fact_check_scores', 'fact_check_final']
        const maxTokens = heavySteps.includes(stepField) ? 16384 : 4096

        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            max_tokens: maxTokens,
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
        const heavySteps = ['reviewer_output', 'resolver_output', 'ranked_versions', 'recommended_versions', 'fact_check_scores', 'fact_check_final']
        const maxTokens = heavySteps.includes(stepField) ? 16384 : 4096

        const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: maxTokens,
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
    // When resolver step completes, also copy original_description to prev_original_description (Step 10 addendum)
    const updateData: Record<string, any> = {
      [stepField]: aiResult,
      updated_at: new Date().toISOString(),
      status: 'in_progress',
    }
    if (stepField === 'resolver_output' && entry.original_description) {
      updateData.prev_original_description = entry.original_description
    }
    // Step B (categories) also extracts tags from the combined output
    if (stepField === 'categories') {
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

    return NextResponse.json({
      success: true,
      result: aiResult,
      step: stepField,
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
