// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createPLClient } from '@/lib/pl-supabase'

export async function POST(request: NextRequest) {
  try {
    const { rawText, keywords, additionalContext, constraints, audience, audiences, contentType } = await request.json()

    if (!rawText || rawText.trim() === '') {
      return NextResponse.json({ error: 'Raw text is required' }, { status: 400 })
    }

    // Parse keywords into a numbered list
    const keywordsList = (keywords || '')
      .split('\n')
      .map((k: string) => k.trim())
      .filter((k: string) => k.length > 0)

    const keywordsTotal = keywordsList.length

    const numberedKeywords = keywordsList
      .map((kw: string, i: number) => `[${i + 1}] ${kw}`)
      .join('\n')

    // Build constraints instructions
    const constraintRules: string[] = []
    if (constraints?.maxChars) constraintRules.push(`Maximum ${constraints.maxChars} characters total`)
    if (constraints?.minChars) constraintRules.push(`Minimum ${constraints.minChars} characters total`)
    if (constraints?.maxWords) constraintRules.push(`Maximum ${constraints.maxWords} words total`)
    if (constraints?.minWords) constraintRules.push(`Minimum ${constraints.minWords} words total`)
    const constraintBlock = constraintRules.length > 0
      ? `\n\nHEXT CONSTRAINTS (MUST respect these limits):\n${constraintRules.map(r => `- ${r}`).join('\n')}`
      : ''

    // Audience modifiers for B2B
    const audienceModifiers: Record<string, string> = {
      default: 'Write for the full Platinumlist B2B audience: event organisers, venue managers, promoters, corporate clients, tourism boards, and entertainment executives across the GCC. Use the default B2B TOV 2.2 voice without skewing toward any single segment.',
      'organisers-promoters': 'Skew the tone toward Event Organisers & Promoters: results-driven, empowering, partnership-focused. Use words like scale, reach, sell-out, partnership, audience, momentum. Sample: "Your next sell-out starts here."',
      'corporate-enterprise': 'Skew the tone toward Corporate & Enterprise Clients: professional, data-backed, reliable. Use words like ROI, insights, seamless, enterprise-grade, scalable, compliance. Sample: "Ticketing infrastructure that scales with your ambition."',
      'venues-destinations': 'Skew the tone toward Venues & Destinations: experiential, footfall-driven, partnership-oriented. Use words like footfall, activation, destination, experience, attract, transform. Sample: "Turn your venue into the destination everyone talks about."',
      'government-tourism': 'Skew the tone toward Government & Tourism Boards: strategic, regionally proud, vision-aligned. Use words like vision, strategy, cultural impact, tourism growth, national agenda, ecosystem. Sample: "Powering the events ecosystem behind the region\'s boldest visions."',
    }

    // Support both legacy `audience` string and new `audiences` array
    const selectedAudiences: string[] = Array.isArray(audiences)
      ? audiences
      : [audience || 'default']

    let audienceInstruction: string
    const nonDefault = selectedAudiences.filter(a => a !== 'default')
    if (nonDefault.length === 0) {
      audienceInstruction = audienceModifiers.default
    } else if (nonDefault.length === 1) {
      audienceInstruction = audienceModifiers[nonDefault[0]] || audienceModifiers.default
    } else {
      const blended = nonDefault.map((a, i) => `${i + 1}. ${audienceModifiers[a] || ''}`).filter(Boolean).join('\n\n')
      audienceInstruction = `Blend the following audience tones into one cohesive voice - do not write separate sections, just naturally weave these qualities together:\n\n${blended}`
    }

    const systemMessage = `You are a professional content optimiser for Platinumlist.net, the GCC's leading ticketing and entertainment technology platform serving event organisers, venues, and entertainment businesses.

TONE OF VOICE (Platinumlist B2B TOV 2.2):
You write like a sharp, confident partner who understands the business of live events. Your voice is bold, results-oriented, warm, and regionally rooted - never generic or cold.

TOV PILLARS - apply ALL of these in every piece:
- Confident & Results-Oriented: Lead with clarity and purpose, assertive verbs, show impact. "Plan fast. Sell smarter. Grow big." / "We don't just sell tickets - we sell out shows."
- Exciting & Energetic: Bring momentum and drive, make clients feel the opportunity. "Your next sold-out show starts here." / "The region's hottest events are powered by us."
- Calming & Reassuring: Offer peace of mind, ease friction. "You focus on the magic - we'll handle the rest." / "We've got your back - from sign-up to scale-up."
- Empowering, Human & Warm: Relatable and grounded, speak like someone who's been in the crowd. "We're with you - from planning to sold out." / "Your vision. Our engine."
- Bold Yet Professional: Sharp and modern, never robotic or cold. "No fluff. No jargon. Just results that speak for themselves."
- AI-Driven & Helpful: Showcase AI as a supportive, user-friendly strength. "Smart tools, real-time insights, and the data to back every decision."
- GCC-Proud & Regionally Fluent: Embed local pride and cultural understanding. "Born in Dubai. Built for the Gulf. Ready for the world."

HOW TO WRITE:
Step 1 - Understand the Business Moment: What is the client feeling or seeking? Is it growth, confidence, partnership, innovation, or trust?
Step 2 - Lead with Value: Start with what they gain, not what you do. Benefits before features.
Step 3 - Use Confident, Direct Phrasing: Speak like a trusted advisor. Be bold but not arrogant. Use active voice, strong verbs, and short punchy lines.
Step 4 - Back Claims with Substance: Use data, scale, track record. "15+ years", "10,000+ events", "6 GCC markets".
Step 5 - Close with Partnership Energy: End with a forward-looking CTA that feels collaborative, not salesy.

Your copy MUST:
- Be results-oriented - show ROI, scale, and impact
- Use confident, direct language with active voice
- Lead with client value and business outcomes
- Be clear and scannable (short paragraphs, strong verbs, punchy lines)
- Feel like a trusted partner speaking - warm but professional
- Include regional context where relevant (GCC, Dubai, Gulf markets)

NEVER:
- Sound generic or templated ("We offer best-in-class solutions")
- Use empty buzzwords without substance ("synergy", "leverage", "paradigm")
- Be passive or tentative ("We might be able to help")
- Oversell or hype without backing ("The world's greatest platform")
- Use consumer-facing casual tone (this is B2B, not B2C)
- Use em dashes - use regular dashes instead
- Sound cold or corporate ("Please find attached our proposal")

Core brand insight: Platinumlist is the infrastructure behind the GCC's live entertainment ecosystem. We empower organisers, venues, and entertainment businesses to sell more, know more, and grow more. Our B2B voice should make clients feel like they've found a strategic partner, not just a vendor.

HUMANIZER RULES — STRIP AI PATTERNS FROM ALL OUTPUT:

BANNED WORDS (never use, no exceptions):
crucial, showcase, landscape, testament, delve, foster, navigate, leverage, unlock, elevate, streamline, pivotal, milestone, groundbreaking, game-changer, vibrant, nestled, thriving, dynamic, robust, holistic, seamless, cutting-edge, transformative, innovative

BANNED OPENERS (never start a sentence with):
Additionally, Furthermore, Moreover, It's worth noting that, It's important to note that, Notably,

BANNED CONSTRUCTIONS:
- "serves as" — use "is" instead
- "functions as" — use "is" instead
- Vague -ing modifiers: "showcasing how", "highlighting the importance of", "demonstrating that", "underscoring"
- Stacked hedges: "somewhat possibly", "might potentially", "could perhaps", "it could be argued that"
- Generic conclusions: ending with a vague wrap-up instead of a specific point

STYLE RULES:
- Write with a clear point of view — human writing has an opinion
- Be specific: if you can't name something concrete, cut the line
- No passive voice stacking — two passive constructions in a row must be rewritten
- End every piece on a specific, grounded note — not a vague aspiration

AUDIENCE: ${audienceInstruction}`

    // Build keyword annotation block only if keywords are provided
    const keywordBlock = keywordsTotal > 0 ? `

KEYWORDS - each has an identifier number. You MUST integrate them into the optimised text using the annotation format:
${numberedKeywords}

KEYWORD ANNOTATION FORMAT:

1. STANDARD USE - when a keyword fits naturally:
   Write it as: (keyword phrase) [N]
   Example: "Book your (burj khalifa tickets) [1] online and skip the queue."

2. MERGED KEYWORDS - when two or more keywords overlap or are very similar, MERGE them into one phrase:
   Write it as: (merged phrase) [N1, N2]
   Example: If [1] = "dubai aquarium tickets" and [4] = "dubai aquarium and underwater zoo tickets", merge:
   "Get your (dubai aquarium and underwater zoo tickets) [1, 4] for the ultimate experience."

3. SYNONYM REPLACEMENT - when repeating a keyword would be too spammy or unnatural:
   Write it as: (synonym phrase) [N*]
   The asterisk * signals this is a synonym, not the original keyword.

KEYWORD RULES:
- Each keyword MUST appear at least 2 times across the output (directly, merged, or as synonym)
- Spread keywords naturally - do NOT cluster them
- When 2+ keywords share the same core phrase, MERGE them
- Use synonyms sparingly - only when exact keyword would feel repetitive
- No keyword stuffing (max 1 annotation per 20 words)

KEYWORD MAPPING (include in your JSON response):
"_keywords_mapping": [
  { "id": 1, "original": "keyword", "action": "used", "as_written": "keyword", "times": 3 },
  { "id": 2, "original": "keyword", "action": "merged_with_5", "as_written": "merged phrase", "merged_ids": [2, 5], "times": 2 },
  { "id": 3, "original": "keyword", "action": "synonym", "as_written": "synonym phrase", "synonym_of": "keyword", "times": 1 }
]
The mapping MUST account for ALL ${keywordsTotal} keywords.` : ''

    const prompt = `Optimise the following text using Platinumlist B2B TOV 2.2.

CONTENT TYPE: ${contentType || 'General'}
${additionalContext ? `\nADDITIONAL CONTEXT:\n${additionalContext}` : ''}
${constraintBlock}
${keywordBlock}

ORIGINAL TEXT:
${rawText}

RESPOND WITH ONLY A VALID JSON OBJECT (no markdown code blocks):
{
  "optimised_text": "The full optimised text with keyword annotations if keywords were provided",
  "summary": "1-sentence summary of changes made",
  "tone_notes": "Brief note on which vibe pillars were emphasised"${keywordsTotal > 0 ? ',\n  "_keywords_mapping": [array of keyword mapping objects as described above]' : ''}
}`

    // Custom key from frontend settings
    const customApiKey = request.headers.get('x-openai-key')
    const proMode = request.headers.get('x-ai-mode') === 'pro'

    let aiResult: string
    let usedProMode = false

    // Pro mode: user's personal key → gpt-4o directly. Regular mode: PL edge function. Never mixed.
    if (proMode && customApiKey) {
      usedProMode = true
      const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${customApiKey}` },
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
    } else {
      // Regular mode: PL edge function
      const plClient = createPLClient()
      const { data: plData, error: plError } = await plClient.functions.invoke('ai-process', {
        body: { prompt: `[INSTRUCTIONS]\n${systemMessage}\n\n[TASK]\n${prompt}`, stepField: 'optimiser-b2b', eventTitle: '' },
      })
      if (plError) {
        return NextResponse.json({ error: plError.message || JSON.stringify(plError) }, { status: 500 })
      }
      aiResult = (plData?.result || plData?.text || plData?.content || '') as string
    }

    // Parse JSON response
    let parsed: Record<string, unknown>
    try {
      let toParse: string = typeof aiResult === 'string' ? aiResult : JSON.stringify(aiResult)
      toParse = toParse.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
      if (toParse.startsWith('{"result":') || toParse.startsWith('{ "result":')) {
        try {
          const wrapper = JSON.parse(toParse)
          if (wrapper?.result) {
            toParse = typeof wrapper.result === 'string' ? wrapper.result : JSON.stringify(wrapper.result)
          }
        } catch { /* continue with original */ }
      }
      parsed = JSON.parse(toParse)
    } catch {
      parsed = { optimised_text: aiResult, summary: 'Applied B2B TOV 2.2', tone_notes: '' }
    }

    // Extract keywords mapping
    let keywordsMapping: unknown[] = []
    let keywordsUsed = 0

    if (parsed._keywords_mapping) {
      keywordsMapping = Array.isArray(parsed._keywords_mapping)
        ? parsed._keywords_mapping
        : (typeof parsed._keywords_mapping === 'string'
          ? (() => { try { return JSON.parse(parsed._keywords_mapping as string) } catch { return [] } })()
          : [])
      delete parsed._keywords_mapping
    }

    if (keywordsTotal > 0 && parsed.optimised_text) {
      const usedIds = new Set<number>()
      const annotationRegex = /\([^)]+\)\s*\[([^\]]+)\]/g
      let match: RegExpExecArray | null
      const text = String(parsed.optimised_text)
      while ((match = annotationRegex.exec(text)) !== null) {
        const ids = match[1].split(',').map(s => parseInt(s.replace('*', '').trim(), 10)).filter(n => !isNaN(n))
        ids.forEach(id => usedIds.add(id))
      }
      keywordsUsed = Math.min(usedIds.size, keywordsTotal)
    }

    return NextResponse.json({
      success: true,
      optimised_text: parsed.optimised_text || '',
      summary: parsed.summary || '',
      tone_notes: parsed.tone_notes || '',
      keywordsUsed,
      keywordsTotal,
      keywordsMapping,
      aiMode: usedProMode ? 'pro' : 'regular',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
