import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { systemPrompt, userMessage, images } = await req.json()

    if (!systemPrompt || (!userMessage && (!images || images.length === 0))) {
      return NextResponse.json({ error: 'Missing systemPrompt or userMessage' }, { status: 400 })
    }

    // Both modes use server OPENAI_API_KEY. Vision/Pro = gpt-4o, Regular = gpt-4o-mini.
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'No OpenAI API key configured on server' }, { status: 500 })
    }

    const proMode = req.headers.get('x-ai-mode') === 'pro'
    const hasImages = images && images.length > 0
    const model = (hasImages || proMode) ? (process.env.OPENAI_PRO_MODEL || 'gpt-4o') : (process.env.OPENAI_MODEL || 'gpt-4o')
    const usedProMode = proMode || hasImages

    // Build user message content - supports text-only or text+images
    let userContent: any = userMessage || ''

    if (hasImages) {
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

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        max_tokens: 4000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
      }),
    })

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text()
      return NextResponse.json({ error: `OpenAI API error: ${errorText}` }, { status: 5031 })
    }

    const data = await aiResponse.json()
    const result = data.choices?.[0]?.message?.content || 'No response generated.'

    return NextResponse.json({ result, aiMode: usedProMode ? 'pro' : 'regular' })
  } catch(error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
