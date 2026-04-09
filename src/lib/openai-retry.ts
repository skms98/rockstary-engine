// OpenAI API call with automatic retry on rate limit (429) errors.
// Parses the "retry-after" header or "Please try again in X" from error body.
// Model selection: Regular = gpt-4o-mini, Pro = gpt-4o (hardcoded in route handlers).
// v1.1 — reconnected Git integration to fix webhook.

interface OpenAICallOptions {
  apiKey: string
  model: string
  maxTokens: number
  systemMessage: string
  userPrompt: string
  maxRetries?: number
}

interface OpenAICallResult {
  content: string
  ok: true
}

interface OpenAICallError {
  error: string
  ok: false
}

export async function callOpenAIWithRetry(
  opts: OpenAICallOptions
): Promise<OpenAICallResult | OpenAICallError> {
  const maxRetries = opts.maxRetries ?? 2

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: opts.maxTokens,
        messages: [
          { role: 'system', content: opts.systemMessage },
          { role: 'user', content: opts.userPrompt },
        ],
      }),
    })

    if (response.ok) {
      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || 'No response from AI'
      return { content, ok: true }
    }

    // Check if rate limited
    if (response.status === 429 && attempt < maxRetries) {
      const errBody = await response.text()

      // Try to parse wait time from response
      let waitMs = 10000 // default 10s
      const retryAfter = response.headers.get('retry-after')
      if (retryAfter) {
        waitMs = (parseFloat(retryAfter) || 10) * 1000
      } else {
        // Parse "Please try again in X.XXXs" from error body
        const match = errBody.match(/try again in (\d+\.?\d*)\s*s/i)
        if (match) {
          waitMs = (parseFloat(match[1]) + 1) * 1000 // add 1s buffer
        }
      }

      // Cap wait at 30 seconds
      waitMs = Math.min(waitMs, 30000)

      await new Promise(resolve => setTimeout(resolve, waitMs))
      continue
    }

    // Non-retryable error or out of retries
    const errText = await response.text()
    return { error: `AI error: ${errText}`, ok: false }
  }

  return { error: 'Max retries exceeded', ok: false }
}
// v1.6 — deploy after Git reconnect for QA tools toggle
