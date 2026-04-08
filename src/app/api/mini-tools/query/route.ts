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

    // Custom key from frontend settings (takes priority over PL edge function)
    const customApiKey = req.headers.get('x-openai-key')
    const proMode = req.headers.get('x-ai-mode') === 'pro'

    // Primary: Use PL Supabase edge function — pro mode skips PL and uses custom key directly
    let result: string
    let usedProMode = false

    try {
      if (proMode && customApiKey) throw new Error('pro_mode')
      const plClient = createPLClient()
      const { data, error } = await plClient.functions.invoke('ai-process', {
        body: {
          prompt: typeof userContent === 'string'
            ? `${systemPrompt}\n\n${userContent}`
            : `${systemPrompt}\n\n${userMessage || 'Analyze the provided images.'}`,
          stepField: 'mini_tools_query',
          eventTitle: 'Mini Tools'
        }
      })
      if (error) throw error
      result = data?.result || data?.text || data?.content || (typeof data === 'string' ? data : JSON.stringify(data))
    } catch (plError: any) {
      if (plError?.message === 'pro_mode') usedProMode = true
      // Fallback: direct OpenAI call if edge function fails or custom key provided
      const apiKey = customApiKey || process.env.OPENAI_API_KEY

      if (!apiKey) {
        return NextResponse.json({
          error: `PL AI edge function error: ${plError?.message || 'Unknown error'}. No fallback OPENAI_API_KEY configured.`
        }, { status: 500 })
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: usedProMode ? 'gpt-5-mini' : 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
          max_completion_tokens: 4000,
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
