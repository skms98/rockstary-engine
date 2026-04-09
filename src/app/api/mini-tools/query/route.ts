import { NextResponse } from 'next/server';
import { fetchOpenAIWithFallback } from '@/lib/openai-retry';

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
          contentParts.push({
            type: 'image_url',
            image_url: {
              url: img.data,
              detail: 'high',
            },
          });
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

    // Use fetchOpenAIWithFallback — automatically retries with gpt-4o-mini if gpt-4o is not accessible
    const { data, usedModel, response } = await fetchOpenAIWithFallback({
      apiKey,
      model,
      messages,
      temperature: 0.7,
      maxTokens: 4096,
    });

    if (!response.ok) {
      const errorMessage = data?.error?.message || `OpenAI API error: ${response.status}`;
      return NextResponse.json(
        { error: errorMessage, provider: `direct-openai-${model}` },
        { status: response.status }
      );
    }

    const result = data.choices?.[0]?.message?.content || '';
    const actuallyPro = isProMode && usedModel === 'gpt-4o';

    return NextResponse.json({
      result,
      provider: `direct-openai-${usedModel}`,
      mode: actuallyPro ? 'pro' : 'regular',
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
