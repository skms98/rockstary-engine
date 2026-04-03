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

    const systemMessage = 'You are a professional content writer and SEO specialist for Platinumlist.net, specializing in attraction and experience descriptions for a leading ticketing platform in the Middle East.'

    const prompt = `Generate SEO-optimized structured content for this attraction listing.

ATTRACTION: ${title}
KEYWORDS (integrate naturally, 2-4 appearances each):
${keywords}

ORIGINAL CONTENT (Column C):
${rawText}

RESPOND WITH ONLY A VALID JSON OBJECT with these keys. Each value is a string. Do NOT wrap in markdown code blocks.

{
  "h1": "SEO-optimized H1 headline (include primary keyword)",
  "teaser": "1-2 sentence hook, 15-30 words, include primary keyword",
  "what_to_expect": "3-4 sentences, 60-100 words describing activities/experiences/duration",
  "highlights": "3-5 bullet points separated by newlines, 8-15 words each, concrete visual language",
  "inclusions": "Bulleted list of what's included, copy from original if available",
  "exclusions": "Bulleted list of what's NOT included, copy from original if available",
  "ticket_info": "Ticket types, pricing tiers if mentioned, booking details",
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
- Include section titles as part of the JSON keys above
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
      // sometimes with unescaped inner quotes that make the outer JSON invalid
      if (toParse.startsWith('{"result":') || toParse.startsWith('{ "result":')) {
        try {
          // Try clean JSON parse of the wrapper first
          const wrapper = JSON.parse(toParse)
          if (wrapper?.result) {
            toParse = typeof wrapper.result === 'string' ? wrapper.result : JSON.stringify(wrapper.result)
          }
        } catch {
          // Outer JSON invalid (unescaped inner quotes) — extract inner JSON by position:
          // skip past {"result": " to find the inner { that starts the SEO JSON
          const resultKeyEnd = toParse.indexOf('"result"') + 8
          const innerStart = toParse.indexOf('{', resultKeyEnd)
          const innerEnd = toParse.lastIndexOf('}')
          if (innerStart !== -1 && innerEnd > innerStart) {
            toParse = toParse.slice(innerStart, innerEnd + 1)
          }
        }
      }
      seoContent = JSON.parse(toParse)
    } catch {
      const raw = typeof aiResult === 'string' ? aiResult : JSON.stringify(aiResult)
      return NextResponse.json({ error: 'AI returned invalid JSON. Raw: ' + raw.slice(0, 200) }, { status: 500 })
    }

    // Save to Supabase
    const { error: updateError } = await plClient
      .from('attractions')
      .update({
        seo_content: seoContent,
        seo_status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', attractionId)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to save SEO content: ' + updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, seoContent })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
