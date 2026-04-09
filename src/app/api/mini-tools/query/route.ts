import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { systemPrompt, userMessage, images, toolName } = body;

    if (!systemPrompt || !userMessage) {
      return NextResponse.json(
        { error: 'Missing systemPrompt or userMessage' },
        { status: 400 }
      );
    }

    // Pro mode only for factchecker and tagger; everything else always gpt-4o-mini
    const proEligibleTools = ['factchecker', 'tagger'];
    const isProMode = proEligibleTools.includes(toolName) && req.headers.get('x-ai-mode') === 'pro';
    const model = isProMode ? 'gpt-4o' : 'gpt-4o-mini';

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Build messages array
    const messages: any[] = [
      { role: 'system', content: systemPrompt },
    ];

    // If images are provided, build a multimodal user message
    if (images && Array.isArray(images) && images.length > 0) {
      const contentParts: any[] = [];

      // Add text part first
      if (userMessage) {
        contentParts.push({ type: 'text', text: userMessage });
      }

      // Add each image
      for (const img of images) {
        if (img.data) {
          // img.data is a base64 data URL like "data:image/png;base64,..."
          contentParts.push({
            type: 'image_url',
            image_url: {
              url: img.data,
              detail: 'high',
            },
          });
          // Add label reference if present
          if (img.label) {
            contentParts.push({
              type: 'text',
              text: `[Screenshot ${img.label}]`,
            });
          }
        }
      }

      messages.push({ role: 'user', content: contentParts });
    } else {
      messages.push({ role: 'user', content: userMessage });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData?.error?.message || `OpenAI API error: ${response.status}`;
      return NextResponse.json(
        { error: errorMessage, provider: `direct-openai-${model}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content || '';

    return NextResponse.json({
      result,
      provider: `direct-openai-${model}`,
      mode: isProMode ? 'pro' : 'regular',
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
