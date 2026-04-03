// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createPLClient } from '@/lib/pl-supabase'

export async function POST(request: NextRequest) {
  try {
    const { rawText, keywords, additionalContext, constraints, audience, contentType } = await request.json()

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
      ? `\n\nTEXT CONSTRAINTS (MUST respect these limits):\n${constraintRules.map(r => `- ${r}`).join('\n')}`
      : ''

    // Audience modifiers for B2C
    const audienceModifiers: Record<string, string> = {
      default: 'Write for the full Platinumlist B2C audience: ordinary people, families, expats, tourists, party people, and cultural fans across the GCC. Use the default B2C TOV 2.4 voice without skewing toward any single segment.',
      'party-genz': 'Skew the tone toward Party People / Gen Z: rhythmic, social, high energy. Use words like vibe, tap, unlock, drop, blast, fire. Sample: "Your vibe, your night. Let\'s go."',
      'families': 'Skew the tone toward Families / Local Residents: kind, clear, community-forward. Use words like welcome, ease, fun, all ages, joy. Sample: "Moments you\'ll talk about all week."',
      'expats-tourists': 'Skew the tone toward Expats / Tourists: helpful, inclusive, reassuring. Use words like explore, discover, relax, local, unforgettable. Sample: "From dhow cruises to desert beats - it\'s all here."',
      'cultural-highclass': 'Skew the tone toward Cultural Enthusiasts / High-Class Audiences: elegant, nostalgic, emotionally rich. Use words like legacy, timeless, journey, sentiment, depth. Sample: "Where memory meets melody."',
    }

    const audienceInstruction = audienceModifiers[audience || 'default'] || audienceModifiers.default

    const systemMessage = `You are a professional content optimiser for Platinumlist.net, the GCC's go-to platform for tickets to concerts, attractions, sports, and cultural events.

TONE OF VOICE (Platinumlist B2C TOV 2.4):
You write like a trusted, upbeat friend who knows what's on. Your voice is emotionally aware, clear, and confident - never stiff or robotic.

Vibe pillars:
- Inviting & Human: "We've got you." / "Just a heads-up..."
- Energetic & Playful: "Let the countdown begin." / "Catch you at the show!"
- Inclusive & Local: "From beach beats to rooftop movies - it's all here."
- Reassuring & Kind: "Totally get how that feels - let's fix it fast."
- Joyful & Actionable: "Grab your spot." / "Let the weekend write its soundtrack."

HOW TO WRITE:
Step 1 - Understand the Emotional Moment: What is the user feeling or seeking? Is it hype, clarity, nostalgia, trust, relief, or joy?
Step 2 - Lead with Emotion: Start with what it feels like, not what it is.
Step 3 - Use Conversational, Rhythmic Phrasing: Speak like you're chatting with a curious friend. Use contractions, breaks, light alliteration, and short sentences.
Step 4 - Structure with Space: Break paragraphs often. Use pacing that matches the mood.
Step 5 - Close with Clarity and Feeling: Use a CTA that fits the tone and moment.

Your copy MUST:
- Be emotionally resonant - spark joy, trust, or curiosity
- Use casual, rhythmic, modern phrasing with contractions (you're, we've, it's)
- Lead with experience and feeling, not just logistics
- Be readable at a glance (short lines, lively verbs, light punctuation)
- Invite the reader in - make them feel part of something

NEVER:
- Sound robotic ("Your request is being processed")
- Use corporate jargon ("Avail our premium offering")
- Use passive voice ("The issue has been resolved")
- Overuse empty adjectives ("amazing, incredible, unforgettable") - be vivid, not vague
- Use phrases that push without warmth ("Buy now")
- Use em dashes - use regular dashes instead

Core brand insight: We are a healthier alternative to fast dopamine. We invite people to trade noise for presence, endless content for real connection. Our words should make space to feel something real.

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

    const prompt = `Optimise the following text using Platinumlist B2C TOV 2.4.

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

    let aiResult: string

    // Primary: Supabase edge function
    const plClient = createPLClient()
    try {
      const { data, error } = await plClient.functions.invoke('ai-process', {
        body: { prompt: `${systemMessage}\n\n${prompt}`, stepField: 'b2c_optimiser', eventTitle: 'B2C Optimiser' }
      })
      if (error) throw error
      aiResult = data?.result || data?.text || data?.content || (typeof data === 'string' ? data : JSON.stringify(data))
    } catch (plError: any) {
      const openaiKey = process.env.OPENAI_API_KEY
      const anthropicKey = process.env.ANTHROPIC_API_KEY

      if (openaiKey) {
        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
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
          headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
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
        return NextResponse.json({ error: 'No AI provider available.' }, { status: 500 })
      }
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
      // If JSON parsing fails, treat the whole response as optimised text
      parsed = { optimised_text: aiResult, summary: 'Applied B2C TOV 2.4', tone_notes: '' }
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

    // Count keyword usage from annotations in the optimised text
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
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
