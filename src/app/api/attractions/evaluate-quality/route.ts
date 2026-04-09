import { NextRequest, NextResponse } from 'next/server'
import { createPLClient } from '@/lib/pl-supabase'
import { fetchOpenAIWithFallback } from '@/lib/openai-retry'

// Evaluates SEO content quality: TOV score, structural variation, and detailed fact check
// Called from the FactCheck tab after SEO content is generated
export async function POST(request: NextRequest) {
  try {
    const { attractionId } = await request.json()

    if (!attractionId) {
      return NextResponse.json({ error: 'Missing attractionId' }, { status: 400 })
    }

    const plClient = createPLClient()

    const { data: attraction, error: fetchError } = await plClient
      .from('attractions')
      .select('*')
      .eq('id', attractionId)
      .single()

    if (fetchError || !attraction) {
      return NextResponse.json({ error: 'Attraction not found' }, { status: 404 })
    }

    const rawText = attraction.raw_text || ''
    const seoContent = attraction.seo_content || {}

    if (!rawText.trim() || Object.keys(seoContent).length === 0) {
      return NextResponse.json({ error: 'Both Column C (raw text) and Column D (SEO content) are required' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'No OpenAI API key configured' }, { status: 500 })
    }

    // Strip keyword annotations from SEO text for clean comparison
    const seoFullText = Object.entries(seoContent)
      .filter(([k]) => k !== '_keywords_mapping')
      .map(([k, v]) => `=== ${k.toUpperCase()} ===\n${String(v || '')}`)
      .join('\n\n')

    const seoCleanText = seoFullText.replace(/\([^)]+\)\s*\[\d+[,\s\d*]*\]/g, (match) => {
      const inner = match.match(/\(([^)]+)\)/)?.[1] || ''
      return inner
    })

    // ── Run all 3 evaluations in parallel ──────────────────
    const [tovResult, variationResult, factCheckResult] = await Promise.all([

      // 1. TOV SCORE — B2C TOV 2.4 evaluation
      fetchOpenAIWithFallback({
        apiKey,
        model: 'gpt-4o-mini',
        maxTokens: 2048,
        messages: [
          { role: 'system', content: `You are a Platinumlist brand voice analyst. You evaluate content against the B2C Tone of Voice 2.4 standard.` },
          { role: 'user', content: `Evaluate this attraction SEO content against the Platinumlist B2C TOV 2.4 guidelines.

PLATINUMLIST B2C TOV 2.4 — FIVE VIBE PILLARS:
1. Inviting & Human — "We've got you." / "Just a heads-up..." Warm, friendly, like a trusted friend.
2. Energetic & Playful — "Let the countdown begin." / "Catch you at the show!" Rhythmic, upbeat, exciting.
3. Inclusive & Local — "From beach beats to rooftop movies — it's all here." Speaks to all audiences across the GCC.
4. Reassuring & Kind — "Totally get how that feels — let's fix it fast." Empathetic, trustworthy.
5. Joyful & Actionable — "Grab your spot." / "Let the weekend write its soundtrack." Drives action with warmth.

KEY DOS:
- Use contractions (you're, we've, it's)
- Mirror emotion of the moment
- Infuse warmth, even in short replies
- Be playful when context allows
- Keep paragraphs light and skimmable
- Use rhythmic repetition and alliteration sparingly

KEY DON'TS:
- Be overly formal or robotic
- Use passive voice
- Default to cliches ("Dear Customer," "Your call is important")
- Over-apologize
- Use sarcasm or slang that could confuse
- Sound like a press release

CONTENT TO EVALUATE:
${seoCleanText}

Score each dimension 1-10, then give an overall TOV score out of 10.

RESPOND WITH ONLY THIS EXACT FORMAT (no other text):
WARMTH: X/10
ENERGY: X/10
CLARITY: X/10
COMMERCIAL: X/10
CREDIBILITY: X/10
OVERALL_TOV: X.X/10
VERDICT: [ON-BRAND / MOSTLY ON-BRAND / OFF-BRAND]
NOTES: [1-2 sentences on key strengths and weaknesses]` }
        ]
      }),

      // 2. STRUCTURAL VARIATION — SEO duplicate analysis
      fetchOpenAIWithFallback({
        apiKey,
        model: 'gpt-4o-mini',
        maxTokens: 2048,
        messages: [
          { role: 'system', content: `You are an SEO duplicate content analyst. You determine whether two versions would be considered duplicate content from a search engine perspective.` },
          { role: 'user', content: `Compare these two versions of the same attraction content. Determine structural variation for SEO purposes.

VERSION A (Original / Column C):
${rawText}

VERSION B (Rewritten / Column D):
${seoCleanText}

Follow these steps:

Step 1 — Structural Similarity: Compare sentence structure, paragraph flow, opening and closing patterns. Classify as Low / Moderate / High similarity.

Step 2 — Lexical Similarity: Analyze repeated phrases (3+ consecutive words), shared adjectives, overall vocabulary overlap. Ignore stop words, brand names, dates, locations, and proper nouns.

Step 3 — Semantic Overlap: Identify shared factual anchors (attraction name, location, features). Determine if similarity is Factual-only (acceptable), Mixed factual + stylistic, or Stylistically redundant (risk).

Step 4 — Keyword & Intent: Evaluate primary keyword targeting overlap. Determine: same intent different expression / same intent same expression / different intent.

Step 5 — Structural Variation Score: What percentage of Version B is structurally different from Version A? Target: 35-50%.

RESPOND WITH ONLY THIS EXACT FORMAT (no other text):
STRUCTURAL_SIMILARITY: [Low/Moderate/High]
LEXICAL_SIMILARITY: XX%
SEMANTIC_OVERLAP: [Factual-only/Mixed/Stylistically redundant]
INTENT_ALIGNMENT: [Same intent different expression/Same intent same expression/Different intent]
VARIATION_SCORE: XX%
DUPLICATE_RISK: XX/100
VERDICT: [SEO-safe/Borderline/Duplicate risk]
NOTES: [1-2 sentences on what drives the variation score]` }
        ]
      }),

      // 3. DETAILED FACT CHECK — side-by-side comparison
      fetchOpenAIWithFallback({
        apiKey,
        model: 'gpt-4o-mini',
        maxTokens: 4096,
        messages: [
          { role: 'system', content: `You are a fact-checking analyst for Platinumlist. You compare old vs new versions of attraction content to ensure factual alignment.` },
          { role: 'user', content: `Compare the OLD version (original) with the NEW version (SEO rewrite) of this attraction. Ensure the NEW version preserves all facts from the OLD version.

OLD VERSION (Column C — source of truth):
${rawText}

NEW VERSION (Column D — SEO rewrite):
${seoCleanText}

Step 1 — Extract Key Facts from OLD version:
- Names, places, attractions, brands
- Dates, times, locations, addresses
- Activities, features, offerings
- Prices, age restrictions, requirements
- Unique phrasing or required disclaimers

Step 2 — Compare each fact against NEW version:
- Present and accurately stated?
- Consistent in tone and structure?
- Any facts altered, exaggerated, or fabricated?

Step 3 — Score alignment:
10 = Perfect alignment (no missing or altered facts)
7-9 = Minor differences that don't change meaning
4-6 = Noticeable inconsistencies or omissions
1-3 = Major factual shifts or misrepresentation

Step 4 — Side-by-side comparison of key elements.

RESPOND WITH ONLY THIS EXACT FORMAT:
FACT_SCORE: X/10
FACTS_PRESERVED: X out of Y
FACTS_MISSING: [list or "none"]
FACTS_ALTERED: [list or "none"]
FACTS_INVENTED: [list or "none"]
RECOMMENDATION: [Approved / Revise / Reject]
NOTES: [2-3 sentences summarizing alignment]` }
        ]
      }),
    ])

    // ── Parse results ──────────────────────────────────────
    const tovText = tovResult.data?.choices?.[0]?.message?.content || ''
    const varText = variationResult.data?.choices?.[0]?.message?.content || ''
    const factText = factCheckResult.data?.choices?.[0]?.message?.content || ''

    // Extract TOV score
    const tovMatch = tovText.match(/OVERALL_TOV:\s*([\d.]+)/i)
    const tovScore = tovMatch ? parseFloat(tovMatch[1]) : null
    const warmthMatch = tovText.match(/WARMTH:\s*([\d.]+)/i)
    const energyMatch = tovText.match(/ENERGY:\s*([\d.]+)/i)
    const clarityMatch = tovText.match(/CLARITY:\s*([\d.]+)/i)
    const commercialMatch = tovText.match(/COMMERCIAL:\s*([\d.]+)/i)
    const credibilityMatch = tovText.match(/CREDIBILITY:\s*([\d.]+)/i)

    // Extract structural variation score
    const varMatch = varText.match(/VARIATION_SCORE:\s*([\d.]+)/i)
    const variationScore = varMatch ? parseFloat(varMatch[1]) : null

    // Extract fact check score
    const factMatch = factText.match(/FACT_SCORE:\s*([\d.]+)/i)
    const factScore = factMatch ? parseFloat(factMatch[1]) : null

    // Build results object with dimension scores
    const evaluationResults: Record<string, unknown> = {
      warmth: warmthMatch ? parseFloat(warmthMatch[1]) : null,
      energy: energyMatch ? parseFloat(energyMatch[1]) : null,
      clarity: clarityMatch ? parseFloat(clarityMatch[1]) : null,
      commercial: commercialMatch ? parseFloat(commercialMatch[1]) : null,
      credibility: credibilityMatch ? parseFloat(credibilityMatch[1]) : null,
      tov_raw: tovText,
      variation_raw: varText,
      fact_check_raw: factText,
      evaluated_at: new Date().toISOString(),
    }

    // Save scores to attractions table
    const updatePayload: Record<string, unknown> = {
      fact_check_results: evaluationResults,
      fact_check_status: 'reviewed',
      updated_at: new Date().toISOString(),
    }
    if (tovScore !== null) updatePayload.fact_check_tov_score = tovScore
    if (variationScore !== null) updatePayload.fact_check_variation = variationScore
    if (factScore !== null) updatePayload.fact_check_score = factScore

    const { error: updateError } = await plClient
      .from('attractions')
      .update(updatePayload)
      .eq('id', attractionId)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to save: ' + updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      tovScore,
      variationScore,
      factScore,
      dimensions: {
        warmth: evaluationResults.warmth,
        energy: evaluationResults.energy,
        clarity: evaluationResults.clarity,
        commercial: evaluationResults.commercial,
        credibility: evaluationResults.credibility,
      },
      rawResults: { tov: tovText, variation: varText, factCheck: factText },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
