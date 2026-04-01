import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { systemPrompt, userMessage, images } = await req.json()

    if (!systemPrompt || (!userMessage && (!images || images.length === 0))) {
      return NextResponse.json({ error: 'Missing systemPrompt or userMessage' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
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

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json({ error: `OpenAI API error: ${errorText}` }, { status: 500 })
    }

    const data = await response.json()
    const result = data.choices?.[0]?.message?.content || 'No response generated.'

    return NextResponse.json({ result })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
