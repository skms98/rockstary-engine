import { NextRequest, NextResponse } from 'next/server'
import { createPLClient } from '@/lib/pl-supabase'
import { callOpenAIWithRetry } from '@/lib/openai-retry'
import { enrichArtistInfo } from '@/lib/artist-enrichment'
import { buildInitialTaggingPrompt, buildValidatorPrompt, type TaggingContext } from '@/lib/ai-prompts-tagging'

// Attraction classification endpoint — runs the same TAGGING BEAST system
// as the pipeline and tagging tool, but reads/writes from the attractions table
export async function POST(request: NextRequest) {
  try {
    const { attractionId } = await request.json()

    if (!attractionId) {
      return NextResponse.json({ error: 'Missing attractionId' }, { status: 400 })
    }

    const plClient = createPLClient()

    // Load attraction
    const { data: attraction, error: fetchError } = await plClient
      .from('attractions')
      .select('*')
      .eq('id', attractionId)
      .single()

    if (fetchError || !attraction) {
      return NextResponse.json({ error: 'Attraction not found' }, { status: 404 })
    }

    // Build source text from attraction data
    const rawText = attraction.raw_text || ''
    const seoContent = attraction.seo_content || {}
    const seoText = Object.entries(seoContent)
      .filter(([k]) => k !== '_keywords_mapping')
      .map(([, v]) => String(v || ''))
      .join('\n')

    const sourceText = [
      `Attraction: ${attraction.title || ''}`,
      attraction.url ? `URL: ${attraction.url}` : '',
      '',
      rawText || seoText || '',
    ].filter(Boolean).join('\n')

    if (!sourceText.trim() || sourceText.length < 20) {
      return NextResponse.json({ error: 'Attraction needs content (raw text or SEO content) before classification' }, { status: 400 })
    }

    // Load tagging prompts from DB (same source as tagging tool)
    const { data: prompts } = await plClient.from('tagging_prompts').select('*')
    const taggingBeastPrompt = prompts?.find((p: any) => p.prompt_key === 'tagging_beast')?.prompt_text || ''
    const validatorPrompt = prompts?.find((p: any) => p.prompt_key === 'validator')?.prompt_text || ''

    // Load live taxonomy (same source as tagging tool)
    const [{ data: taxonomyCategories }, { data: taxonomyTags }] = await Promise.all([
      plClient.from('tagging_taxonomy').select('*').eq('type', 'category').order('sort_order'),
      plClient.from('tagging_taxonomy').select('*').eq('type', 'tag').order('sort_order'),
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

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'No OpenAI API key configured' }, { status: 500 })
    }

    // Phase 1 uses gpt-4o-mini (large prompt fits within higher TPM limits)
    // Phase 2 (validator) uses gpt-4o for authoritative final classification
    const phase1Model = 'gpt-4o-mini'
    const phase2Model = 'gpt-4o'
    const proMode = true

    // Artist enrichment (for music attractions)
    let artistEnrichment = ''
    try {
      artistEnrichment = await enrichArtistInfo(sourceText, apiKey, 'gpt-4o-mini')
    } catch { /* non-critical */ }

    const ctx: TaggingContext = {
      sourceText,
      taggingBeastPrompt,
      validatorPrompt,
      categories: categoriesText,
      tags: tagsText,
      artistEnrichment,
    }

    const systemMessage = 'You are TAGGING BEAST, a deterministic classification engine for Platinumlist.net. You execute rules. You never explain. You never guess. You output FINAL JSON ONLY.'

    const taggingLog: any[] = []

    // ── Phase 1: Initial Classification ──────────────────
    const initialPrompt = buildInitialTaggingPrompt(ctx)
    const initialResult = await callOpenAIWithRetry({
      apiKey,
      model: phase1Model,
      maxTokens: 4096,
      systemMessage,
      userPrompt: initialPrompt,
      maxRetries: 2,
    })

    if (!initialResult.ok) {
      return NextResponse.json({ error: initialResult.error }, { status: 500 })
    }

    taggingLog.push({ phase: 'initial', timestamp: new Date().toISOString(), model: initialResult.usedModel || phase1Model })

    // ── Phase 2: Validation ──────────────────────────────
    const validatorPromptText = buildValidatorPrompt(ctx, initialResult.content)
    const validatorResult = await callOpenAIWithRetry({
      apiKey,
      model: phase2Model,
      maxTokens: 4096,
      systemMessage,
      userPrompt: validatorPromptText,
      maxRetries: 2,
    })

    if (!validatorResult.ok) {
      return NextResponse.json({ error: validatorResult.error }, { status: 500 })
    }

    taggingLog.push({ phase: 'validate', timestamp: new Date().toISOString(), model: validatorResult.usedModel || phase2Model })

    // ── Parse the final classification output ────────────
    const finalOutput = validatorResult.content
    let parsed: any = {}
    try {
      // Try to extract JSON from the response
      const jsonMatch = finalOutput.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0])
      }
    } catch { /* parse manually below */ }

    // Extract domain
    const domain = parsed.domain || parsed.DOMAIN ||
      (finalOutput.match(/domain["\s:]+["']?(ATTRACTION|EVENT)/i)?.[1]?.toUpperCase()) || 'ATTRACTION'

    // Extract categories
    const extractCategory = (keys: string[]) => {
      for (const k of keys) {
        if (parsed[k]) return String(parsed[k])
      }
      return null
    }

    const p1 = extractCategory(['primary_category', 'P1', 'p1', 'primary']) ||
      finalOutput.match(/P1["\s:]+["']?([^"'\n,}]+)/i)?.[1]?.trim() || null
    const p2 = extractCategory(['secondary_category', 'P2', 'p2', 'secondary']) ||
      finalOutput.match(/P2["\s:]+["']?([^"'\n,}]+)/i)?.[1]?.trim() || null
    const p3 = extractCategory(['tertiary_category', 'P3', 'p3', 'tertiary']) ||
      finalOutput.match(/P3["\s:]+["']?([^"'\n,}]+)/i)?.[1]?.trim() || null
    const p4 = extractCategory(['quaternary_category', 'P4', 'p4', 'quaternary']) ||
      finalOutput.match(/P4["\s:]+["']?([^"'\n,}]+)/i)?.[1]?.trim() || null

    // Extract tags
    let marketingTags: string[] = []
    if (parsed.tags && Array.isArray(parsed.tags)) {
      marketingTags = parsed.tags
    } else if (parsed.marketing_tags && Array.isArray(parsed.marketing_tags)) {
      marketingTags = parsed.marketing_tags
    } else {
      const tagsMatch = finalOutput.match(/tags["\s:]+\[([^\]]+)\]/i)
      if (tagsMatch) {
        marketingTags = tagsMatch[1].split(',').map((t: string) => t.replace(/['"]/g, '').trim()).filter(Boolean)
      }
    }

    // Extract final_status (VALID / UNCLASSIFIABLE)
    const finalStatus: string = parsed.final_status || parsed.FINAL_STATUS ||
      (finalOutput.match(/final_status["\s:]+["']?(VALID|UNCLASSIFIABLE)/i)?.[1]?.toUpperCase()) || 'UNKNOWN'

    // Extract fact sheet if present
    let factSheet: Record<string, unknown> = {}
    if (parsed.fact_sheet) {
      factSheet = parsed.fact_sheet
    }

    // Validation gate count (count non-null categories)
    let gatesPassed = 0
    if (domain) gatesPassed++
    if (p1) gatesPassed++
    if (p2) gatesPassed++
    if (marketingTags.length > 0) gatesPassed++
    if (p1 && !p1.toLowerCase().includes('non-selectable')) gatesPassed++
    if (domain === 'ATTRACTION' || domain === 'EVENT') gatesPassed++

    // Save to attractions table
    const updatePayload: Record<string, any> = {
      domain: domain || null,
      primary_category: p1 && p1.toLowerCase() !== 'null' ? p1 : null,
      secondary_category: p2 && p2.toLowerCase() !== 'null' ? p2 : null,
      tertiary_category: p3 && p3.toLowerCase() !== 'null' ? p3 : null,
      quaternary_category: p4 && p4.toLowerCase() !== 'null' ? p4 : null,
      marketing_tags: marketingTags,
      tagging_status: 'completed',
      validation_gates_passed: Math.min(gatesPassed, 6),
      tagging_loops: 1,
      tagging_log: taggingLog,
      updated_at: new Date().toISOString(),
    }
    if (Object.keys(factSheet).length > 0) {
      updatePayload.fact_sheet = factSheet
    }

    const { error: updateError } = await plClient
      .from('attractions')
      .update(updatePayload)
      .eq('id', attractionId)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to save: ' + updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      final_status: finalStatus,
      domain,
      primary_category: p1,
      secondary_category: p2,
      tertiary_category: p3,
      quaternary_category: p4,
      marketing_tags: marketingTags,
      validation_gates_passed: Math.min(gatesPassed, 6),
      initial_raw: initialResult.content,
      validated_raw: finalOutput,
      aiMode: proMode ? 'pro' : 'regular',
      // Debug: confirm prompts/taxonomy were loaded
      _debug: {
        phase1Model,
        phase2Model,
        promptChars: taggingBeastPrompt.length,
        validatorChars: validatorPrompt.length,
        categoryCount: (taxonomyCategories || []).length,
        tagCount: (taxonomyTags || []).length,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
