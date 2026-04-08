// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createPLClient } from '@/lib/pl-supabase'

export async function POST(request: NextRequest) {
  try {
    const { attractionId } = await request.json()

    if (!attractionId) {
      return NextResponse.json({ error: 'Missing attractionId' }, { status: 400 })
    }

    const plClient = createPLClient()

    // Load the attraction
    const { data: attraction, error: fetchError } = await plClient
      .from('attractions')
      .select('*')
      .eq('id', attractionId)
      .single()

    if (fetchError || !attraction) {
      return NextResponse.json({ error: 'Attraction not found' }, { status: 404 })
    }

    if (!attraction.raw_text || attraction.raw_text.trim() === '') {
      return NextResponse.json({ error: 'Raw content (Column C) is empty — cannot generate SEO content' }, { status: 400 })
    }

    const keywords = attraction.keywords_list || ''
    const title = attraction.title || ''
    const rawText = attraction.raw_text

    // Parse keywords into a numbered list for the prompt
    const keywordsList = keywords
      .split('\n')
      .map((k: string) => k.trim())
      .filter((k: string) => k.length > 0)

    const keywordsTotal = keywordsList.length

    // Build numbered keyword reference: [1] keyword, [2] keyword, etc.
    const numberedKeywords = keywordsList
      .map((kw: string, i: number) => `[${i + 1}] ${kw}`)
      .join('\n')

    const systemMessage = `Yu are a professional SEO content writer for Platinumlist.net, the GCC's go-to platform for tickets to concerts, attractions, sports, and cultural events.

TONE OF VOICE (Platinumlist B2C TOV 2.4):
You write like a trusted, upbeat friend who knows what's on. Your voice is emotionally aware, clear, and confident — never stiff or robotic.

Vibe pillars:
- Inviting & Human: "We've got you." / "Just a heads-up..."
- Energetic & Playful: "Let the countdown begin." / "Catch you at the show!"
- Inclusive & Local: "From beach beats to rooftop movies — it's all here."
- Reassuring & Kind: "Totally get how that feels — let's fix it fast."
- Joyful & Actionable: "Grab your spot." / "Let the weekend write its soundtrack."

Your copy should:
- Be emotionally resonant — spark joy, trust, or curiosity
- Use casual, rhythmic, modern phrasing with contractions (you're, we've, it's)
- Lead with experience and feeling, not just logistics
- Be readable at a glance (short lines, lively verbs, light punctuation)
- Invite the reader in — make them feel part of something
- Use alliteration and rhythm when fitting: "Feel every beat, every lyric, every heart-thump."

NEVER:
- Sound robotic ("Your request is being processed")
- Use corporate jargon ("Avail our premium offering")
- Use passive voice ("The issue has been resolved")
- Overuse empty adjectives ("amazing, incredible, unforgettable") — be vivid, not vague
- Use phrases that push without warmth ("Buy now")

Core brand insight: We are a healthier alternative to fast dopamine. We invite people to trade noise for presence, endless content for real connection. Our words should make space to feel something real.

Audience: Write for ordinary people, families, expats, tourists, party people, and cultural fans across the GCC.`

    const prompt = `Generate SEO-optimized structured content for this attraction listing.

ATTRACTION: ${title}

KEYWORDS — each has an identifier number. You MUST integrate them into the text using the annotation format described below:
${numberedKeywords}

═══ KEYWORD ANNOTATION FORMAT ═══

1. STANDARD USE — when a keyword fits naturally:
   Write it as: (keyword phrase) [N]
   Example: "Book your (burj khalifa tickets) [1] online and skip the queue."

2. MERGED KEYWORDS — when two or more keywords overlap or are very similar, MERGE them into one phrase to avoid spam:
   Write it as: (merged phrase) [N1, N2]
   Example: If [1] = "dubai aquarium tickets" and [4] = "dubai aquarium and underwater zoo tickets", merge:
   "Get your (dubai aquarium and underwater zoo tickets) [1, 4] for the ultimate experience."
   This counts BOTH [1] and [4] as used.

3. SYNONYM REPLACEMENT — when repeating a keyword would be too spammy or unnatural, replace it with a natural synonym:
   Write it as: (synonym phrase) [N*]
   The asterisk * signals this is a synonym, not the original keyword.
   Example: If [3] = "observation deck" and you already used it twice, write:
   "The (viewing platform) [3*] provides a 360-degree panorama."

═══ KEYWORD MAPPING (CRITICAL) ═══

After the main JSON content, include a "_keywords_mapping" key in the JSON response. This tracks every keyword's fate:

"_keywords_mapping": [
  { "id": 1, "original": "burj khalifa tickets", "action": "used", "as_written": "burj khalifa tickets", "times": 3 },
  { "id": 2, "original": "at the top dubai", "action": "merged_with_5", "as_written": "at the top dubai observation deck", "merged_ids": [2, 5], "times": 2 },
  { "id": 3, "original": "observation deck", "action": "synonym", "as_written": "viewing platform", "synonym_of": "observation deck", "times": 1 },
  { "id": 4, "original": "dubai entry price", "action": "used", "as_written": "dubai entry price", "times": 2 }
]

═══ RULES ═══

- Each keyword MUST appear at least 2 times across ALL sections (directly, merged, or as synonym)
- Spread keywords naturally — do NOT cluster them all in one section
- When 2+ keywords share the same core phrase, MERGE them (e.g., "burj khalifa" + "burj khalifa observation deck" → merge)
- Use synonyms sparingly — only when the exact keyword would feel repetitive or spammy
- No keyword stuffing (max 1 keyword annotation per 20 words)
- The _keywords_mapping MUST account for ALL ${keywordsTotal} keywords

ORIGINAL CONTENT (Column C):
${rawText}

RESPOND WITH ONLY A VALID JSON OBJECT with these keys. Each value is a string. Do NOT wrap in markdown code blocks.

{
  "h1": "SEO-optimized H1 headline (include primary keyword with annotation)",
  "teaser": "1-2 sentence hook, 15-30 words, include primary keyword with annotation",
  "what_to_expect": "3-4 sentences, 60-100 words, use 2-3 keywords with annotations",
  "highlights": "3-5 bullet points separated by newlines, 8-15 words each, use 1-2 keywords",
  "inclusions": "Bulleted list of what's included, copy from original if available",
  "exclusions": "Bulleted list of what's NOT included, copy from original if available",
  "ticket_info": "Ticket types, pricing tiers, booking details, use 1-2 keywords",
  "important_info": "3-5 bullet points: safety, age restrictions, accessibility, visitor tips",
  "cancellation": "2-3 sentences on refund terms, modification windows",
  "by_car": "Directions by car if available from original, or general guidance",
  "by_public_transport": "Public transport options if available",
  "by_taxi": "Taxi/rideshare guidance if available",
  "_keywords_mapping": "Array of keyword mapping objects as described above"
}

Additional Rules:
- Maintain factual accuracy from original content
- Follow the Platinumlist B2C TOV 2.4 tone described in the system message — warm, joyful, rhythmic, action-driving
- Lead with what the visitor will FEEL, not just what they'll see
- Close sections with energy and actionable language ("Grab your spot", "Secure your tickets", "Your adventure starts here")
- Be inclusive — speak to superfans, casual goers, and families alike
- If original content doesn't mention a section, write reasonable content or put "Information not available"
`

        // Both modes use server OPENAI_API_KEY. Pro = gpt-4o, Regular = gpt-4o-mini.
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'No OpenAI API key configured on server' }, { status: 500 })
    }
    const proMode = request.headers.get('x-ai-mode') === 'pro'
    const model = proMode ? 'gpt-4o' : 'gpt-4o-mini'
    let usedProMode = proMode
    let aiResult: string

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
    aiResult = aiData.choices?.[0]?.message?.content || 'No response from AI' else {
      // Regular mode: gpt-4o-mini via server key
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) {
        return NextResponse.json({ error: 'No OpenAI API key configured on server' }, { status: 500 })
      }
      const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
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
    }

    // Parse the JSON result
    let seoContent: Record<string, unknown>
    try {
      let toParse: string = typeof aiResult === 'string' ? aiResult : JSON.stringify(aiResult)
      // Strip markdown code blocks if present
      toParse = toParse.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
      // Handle {"result": "..."} wrapper
      if (toParse.startsWith('{"result":') || toParse.startsWith('{ "result":')) {
        try {
          const wrapper = JSON.parse(toParse)
          if (wrapper?.result) {
            toParse = typeof wrapper.result === 'string' ? wrapper.result : JSON.stringify(wrapper.result)
          }
        } catch {
          const resultKeyEnd = toParse.indexOf('"result"') + 8
          const innerStart = toParse.indexOf('{', resultKeyEnd)
          if (innerStart !== -1) {
            let braceCount = 0
            let innerEnd = -1
            for (let i = innerStart; i < toParse.length; i++) {
              if (toParse[i] === '{') braceCount++
              else if (toParse[i] === '}') {
                braceCount--
                if (braceCount === 0) { innerEnd = i; break }
              }
            }
            if (innerEnd !== -1) {
              toParse = toParse.slice(innerStart, innerEnd + 1)
            }
          }
        }
      }
      seoContent = JSON.parse(toParse)
    } catch {
      const raw = typeof aiResult === 'string' ? aiResult : JSON.stringify(aiResult)
      return NextResponse.json({ error: 'AI returned invalid JSON. Raw: ' + raw.slice(0, 200) }, { status: 500 })
    }

    // ── Extract keywords_mapping from AI response ─────────────────────────────
    let keywordsMapping: unknown[] = []
    if (seoContent._keywords_mapping) {
      keywordsMapping = Array.isArray(seoContent._keywords_mapping)
        ? seoContent._keywords_mapping
        : (typeof seoContent._keywords_mapping === 'string'
          ? (() => { try { return JSON.parse(seoContent._keywords_mapping as string) } catch { return [] } })()
          : [])
      // Remove _keywords_mapping from seo_content so it's stored separately
      delete seoContent._keywords_mapping
    }

    // ── Count keyword usage from annotations ──────────────────────────────────
    const allSeoText = Object.values(seoContent)
      .map((v) => String(v || ''))
      .join(' ')

    // Track which keyword IDs appear in any annotation pattern:
    // Standard: (text) [N]  |  Merged: (text) [N1, N2]  |  Synonym: (text) [N*]
    const usedIds = new Set<number>()

    // Match all annotation patterns: (anything) [numbers with optional commas and asterisks]
    const annotationRegex = /\([^)]+\)\s*\[([^\]]+)\]/g
    let match: RegExpExecArray | null
    while ((match = annotationRegex.exec(allSeoText)) !== null) {
      const idsStr = match[1] // e.g. "1", "1, 2", "3*"
      // Extract all numeric IDs (strip asterisks, split by comma)
      const ids = idsStr.split(',').map(s => parseInt(s.replace('*', '').trim(), 10)).filter(n => !isNaN(n))
      ids.forEach(id => usedIds.add(id))
    }

    const keywordsUsed = Math.min(usedIds.size, keywordsTotal)

    // Save to Supabase — includes keyword tracking + mapping
    const { error: updateError } = await plClient
      .from('attractions')
      .update({
        seo_content: seoContent,
        seo_status: 'completed',
        keywords_used: keywordsUsed,
        keywords_total: keywordsTotal,
        keywords_mapping: keywordsMapping.length > 0 ? keywordsMapping : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', attractionId)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to save SEO content: ' + updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, seoContent, keywordsUsed, keywordsTotal, keywordsMapping, aiMode: usedProMode ? 'pro' : 'regular' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
