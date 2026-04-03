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

    // Build numbered keyword reference for the prompt: [1] keyword, [2] keyword, etc.
    const numberedKeywords = keywordsList
      .map((kw: string, i: number) => `[${i + 1}] ${kw}`)
      .join('\n')

    const systemMessage = 'You are a professional content writer and SEO specialist for Platinumlist.net, specializing in attraction and experience descriptions for a leading ticketing platform in the Middle East.'

    const prompt = `Generate SEO-optimized structured content for this attraction listing.

ATTRACTION: ${title}

KEYWORDS — each has an identifier number. You MUST integrate them into the text using the exact annotation format (keyword) [N]:
${numberedKeywords}

KEYWORD ANNOTATION FORMAT:
When using a keyword in the text, write it as: (keyword phrase) [N]
Examples:
- "Book your (burj khalifa tickets) [1] online and skip the queue."
- "The (observation deck) [3] offers stunning views of the city."
- "Visitors can enjoy a premium (dubai sky experience) [5] at 555 meters."

Each keyword MUST appear at least 2 times across ALL sections combined. Spread them naturally — do NOT cluster all keywords in one section.

ORIGINAL CONTENT (Column C):
${rawText}

RESPOND WITH ONLY A VALID JSON OBJECT with these keys. Each value is a string. Do NOT wrap in markdown code blocks.

{
  "h1": "SEO-optimized H1 headline (include primary keyword with annotation)",
  "teaser": "1-2 sentence hook, 15-30 words, include primary keyword with annotation",
  "what_to_expect": "3-4 sentences, 60-100 words describing activities/experiences/duration, use 2-3 keywords with annotations",
  "highlights": "3-5 bullet points separated by newlines, 8-15 words each, concrete visual language, use 1-2 keywords with annotations",
  "inclusions": "Bulleted list of what's included, copy from original if available",
  "exclusions": "Bulleted list of what's NOT included, copy from original if available",
  "ticket_info": "Ticket types, pricing tiers if mentioned, booking details, use 1-2 keywords with annotations",
  "important_info": "3-5 bullet points: safety, age restrictions, accessibility, visitor tips",
  "cancellation": "2-3 sentences on refund terms, modification windows",
  "by_car": "Directions by car if available from original, or general guidance",
  "by_public_transport": "Public transport options if available",
  "by_taxi": "Taxi/rideshare guidance if available"
}

Rules:
- Maintain factual accuracy from original content
- Professional & Informative tone
- No keyword stuffing (max 1 keyword per 20 words)
- CRITICAL: Every keyword from the list above MUST appear in the output at least 2 times using the (keyword) [N] annotation format
- If original content doesn't mention a section, write reasonable content or put "Information not available"
`

    let aiResult: string

    // Primary: Supabase edge function
    try {
      const { data, error } = await plClient.functions.invoke('ai-process', {
        body: { prompt, stepField: 'seo_content', eventTitle: title }
      })
      if (error) throw error
      aiResult = data?.result || data?.text || data?.content || (typeof data === 'string' ? data : JSON.stringify(data))
    } catch (plError: any) {
      // Fallback: direct OpenAI
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
        return NextResponse.json({ error: 'No AI provider available. Set OPENAI_API_KEY or ANTHROPIC_API_KEY, or configure Supabase ai-process edge function.' }, { status: 500 })
      }
    }

    // Parse the JSON result
    let seoContent: Record<string, unknown>
    try {
      let toParse: string = typeof aiResult === 'string' ? aiResult : JSON.stringify(aiResult)
      // Strip markdown code blocks if present
      toParse = toParse.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
      // Handle {"result": "..."} wrapper — edge function may return content inside a result key,
      // possibly with unescaped inner quotes that make the outer JSON invalid.
      if (toParse.startsWith('{"result":') || toParse.startsWith('{ "result":')) {
        try {
          // Try clean JSON parse of the wrapper first (valid JSON case)
          const wrapper = JSON.parse(toParse)
          if (wrapper?.result) {
            toParse = typeof wrapper.result === 'string' ? wrapper.result : JSON.stringify(wrapper.result)
          }
        } catch {
          // Outer JSON invalid (unescaped inner quotes) — use brace counting to extract inner SEO JSON.
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

    // ── Count keyword usage by looking for (keyword) [N] annotations ──────────
    const allSeoText = Object.values(seoContent)
      .map((v) => String(v || ''))
      .join(' ')

    // Count how many distinct keyword identifiers [N] appear in annotation format
    let keywordsUsed = 0
    for (let i = 0; i < keywordsList.length; i++) {
      const id = i + 1
      // Match pattern: (anything) [N] where N is the keyword identifier
      const pattern = new RegExp(`\\([^)]+\\)\\s*\\[${id}\\]`)
      if (pattern.test(allSeoText)) {
        keywordsUsed++
      }
    }

    // Save to Supabase — includes keyword tracking
    const { error: updateError } = await plClient
      .from('attractions')
      .update({
        seo_content: seoContent,
        seo_status: 'completed',
        keywords_used: keywordsUsed,
        keywords_total: keywordsTotal,
        updated_at: new Date().toISOString(),
      })
      .eq('id', attractionId)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to save SEO content: ' + updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, seoContent, keywordsUsed, keywordsTotal })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
