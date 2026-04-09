// OpenAI API call with automatic retry on rate limit (429) errors.
// Parses the "retry-after" header or "Please try again in X" from error body.
// Model selection: Regular = gpt-4o-mini, Pro = gpt-4o (hardcoded in route handlers).
// Model fallback: if the API key doesn't support gpt-4o, automatically falls back to gpt-4o-mini.

interface OpenAICallOptions {
  apiKey: string
  model: string
  maxTokens: number
  systemMessage: string
  userPrompt: string
  maxRetries?: number
  fallbackModel?: string
}

interface OpenAICallResult {
  content: string
  ok: true
  usedModel?: string
}

interface OpenAICallError {
  error: string
  ok: false
}

// Check if an error response indicates the model is not available for this API key
function isModelAccessError(status: number, body: string): boolean {
  if (status === 404) return true
  const lower = body.toLowerCase()
  return (
    lower.includes('model_not_found') ||
    lower.includes('does not exist') ||
    lower.includes('do not have access') ||
    lower.includes('not available') ||
    lower.includes('invalid_model') ||
    (status === 403 && lower.includes('model'))
  )
}

export async function callOpenAIWithRetry(
  opts: OpenAICallOptions
): Promise<OpenAICallResult | OpenAICallError> {
  const maxRetries = opts.maxRetries ?? 2
  const fallbackModel = opts.fallbackModel ?? (opts.model !== 'gpt-4o-mini' ? 'gpt-4o-mini' : undefined)
  let currentModel = opts.model

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model: currentModel,
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
      return { content, ok: true, usedModel: currentModel }
    }

    // Check if model is not accessible — fall back immediately (no retry needed)
    if (fallbackModel && currentModel !== fallbackModel) {
      const errBody = await response.text()
      if (isModelAccessError(response.status, errBody)) {
        currentModel = fallbackModel
        attempt = -1 // reset retries for the fallback model
        continue
      }
      // If not a model error, handle as before
      if (response.status === 429 && attempt < maxRetries) {
        let waitMs = 10000
        const retryAfter = response.headers.get('retry-after')
        if (retryAfter) {
          waitMs = (parseFloat(retryAfter) || 10) * 1000
        } else {
          const match = errBody.match(/try again in (\d+\.?\d*)\s*s/i)
          if (match) waitMs = (parseFloat(match[1]) + 1) * 1000
        }
        waitMs = Math.min(waitMs, 30000)
        await new Promise(resolve => setTimeout(resolve, waitMs))
        continue
      }
      return { error: `AI error: ${errBody}`, ok: false }
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

// Shared helper for direct-fetch routes: try the requested model, fall back to gpt-4o-mini if not accessible
export async function fetchOpenAIWithFallback(opts: {
  apiKey: string
  model: string
  messages: any[]
  maxTokens?: number
  temperature?: number
}): Promise<{ data: any; usedModel: string; response: Response }> {
  const models = opts.model !== 'gpt-4o-mini' ? [opts.model, 'gpt-4o-mini'] : [opts.model]

  for (const model of models) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens ?? 4096,
        ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
        messages: opts.messages,
      }),
    })

    if (response.ok) {
      const data = await response.json()
      return { data, usedModel: model, response }
    }

    // If model access error and we have a fallback, try next model
    if (models.indexOf(model) < models.length - 1) {
      const errBody = await response.text()
      if (isModelAccessError(response.status, errBody)) {
        continue // try fallback model
      }
      // Not a model error — return the error response as-is
      return { data: null, usedModel: model, response }
    }

    return { data: null, usedModel: model, response }
  }

  // Should never reach here, but just in case
  throw new Error('No models available')
}
