import { NextRequest, NextResponse } from 'next/server'
import { createPLClient } from '@/lib/pl-supabase'

export async function POST(req: NextRequest) {
  try {
    const { systemPrompt, userMessage, images } = await req.json()

    if (!systemPrompt || (!userMessage && (!images || images.length === 0))) {
      return NextResponse.json({ error: 'Missing systemPrompt or userMessage' }, { status: 400 })
    }

    // Build user message content - supports text-only or text+images
    let userContent: any = userMessage || ''

    if (images && images.length > 0) {
      // Vision mode: construct multimodal content array
      const contentParts: any[] = []

      if (userMessage) {
        contentParts.push({ type: 'text', text: userMessage })
      }

      for (const img of images) {
        contentParts.push({
          type: 'image_url',
          image_url: {
            url: img.data,
            detail: 'high'
          }
        })
        if (img.label) {
          contentParts.push({ type: 'text', text: `[Screenshot ${img.label}]` })
        }
      }

      userContent = contentParts
    }

    // Custom key from frontend settings
    const customApiKey = req.headers.get('x-openai-key')
    const proMode = req.headers.get('x-ai-mode') === 'pro'

    // Pro mode: user's personal key → gpt-4o directly. Regular mode: PL edge function. Never mixed.
    // Vision requests (images) always use direct OpenAI regardless of mode.
    let result: string
    let usedProMode = false
    const hasImages = images && images.length > 0

    if (proMode && customApiKey) {
      usedProMode = true
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${customApiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
          max_tokens: 4000,
        }),
      })
      if (!response.ok) {
        const errorText = await response.text()
        return NextResponse.json({ error: `OpenAI API error: ${errorText}` }, { status: 500 })
      }
      const data = await response.json()
      result = data.choices?.[0]?.message?.content || 'No response generated.'
    } else if (hasImages) {
      // Vision mode in regular: use Vercel env key (PL doesn't support vision)
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) {
        return NextResponse.json({ error: 'No API key configured for vision in regular mode.' }, { status: 500 })
      }
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
          max_tokens: 4000,
        }),
      })
      if (!response.ok) {
        const errorText = await response.text()
        return NextResponse.json({ error: `OpenAI API error: ${errorText}` }, { status: 500 })
      }
      const data = await response.json()
      result = data.choices?.[0]?.message?.content || 'No response generated.'
    } else {
      // Regular mode (text-only): gpt-4o-mini via server key
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) {
        return NextResponse.json({ error: 'No API key configured for regular mode.' }, { status: 500 })
      }
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: typeof userContent === 'string' ? userContent : JSON.stringify(userContent) },
          ],
          max_tokens: 4000,
        }),
      })
      if (!response.ok) {
        const errorText = await response.text()
        return NextResponse.json({ error: `OpenAI API error: ${errorText}` }, { status: 500 })
      }
      const data = await response.json()
      result = data.choices?.[0]?.message?.content || 'No response generated.'
    }


    return NextResponse.json({ result, aiMode: usedProMode ? 'pro' : 'regular' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
