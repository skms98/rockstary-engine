import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { systemPrompt, userMessage } = await req.json()

    if (!systemPrompt || !userMessage) {
      return NextResponse.json({ error: 'Missing systemPrompt or userMessage' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
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
          { role: 'user', content: userMessage },
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
