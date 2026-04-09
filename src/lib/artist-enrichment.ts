// Event Enrichment via AI Knowledge
// 1. Detects event language (Arabic, Hindi, etc.) from text signals
// 2. Extracts artist names and looks up their music genre
// Used by both standalone tagging tool and funnel categories-process

/**
 * Detect the performance/spoken language of an event from its text.
 * Returns a string like "Arabic" or "Hindi" if detected, empty otherwise.
 */
async function detectEventLanguage(
  sourceText: string,
  apiKey: string,
  model: string
): Promise<string> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        max_tokens: 100,
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: `You detect the PERFORMANCE or SPOKEN language of an event from its description. Look for:
- Explicit mentions: "in Arabic", "Arabic comedy", "Hindi stand-up", "French theatre"
- Artist names that strongly indicate a language (e.g. Arabic names doing comedy = Arabic)
- Show types that imply a language: "Mushaira" (Urdu), "Arabic Night", "Bollywood" (Hindi)
- Song/music language: "Arabic music", "Arabic songs"

Output ONLY the language name (e.g. "Arabic", "Hindi", "French") if confidently detected.
Output "none" if the event is in English or if language cannot be determined.
Do NOT guess — only flag when there are clear signals.`,
          },
          {
            role: 'user',
            content: `Detect the performance language of this event:\n\n${sourceText.substring(0, 3000)}`,
          },
        ],
      }),
    })

    if (!response.ok) return ''

    const data = await response.json()
    const result = (data.choices?.[0]?.message?.content || '').trim().toLowerCase()

    if (result === 'none' || result === 'english' || result === 'unknown') return ''

    // Capitalize first letter
    return result.charAt(0).toUpperCase() + result.slice(1)
  } catch {
    return ''
  }
}

/**
 * Use OpenAI to extract artist/performer names from event text,
 * then look up each artist's genre.
 * Also detects event language for proper tagging.
 * Returns a formatted string to inject into the tagging prompt.
 */
export async function enrichArtistInfo(
  sourceText: string,
  apiKey: string,
  model: string = 'gpt-4o-mini'
): Promise<string> {
  try {
    // Run language detection and artist extraction in parallel
    const [detectedLanguage, extractResponse] = await Promise.all([
      detectEventLanguage(sourceText, apiKey, model),
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          max_tokens: 500,
          temperature: 0,
          messages: [
            {
              role: 'system',
              content: 'You extract artist, performer, DJ, band, and musician names from event descriptions. Output ONLY a JSON array of name strings. If no artists found, output []. Do not include venue names, event names, or promoter names — ONLY performing artists/acts.',
            },
            {
              role: 'user',
              content: `Extract all artist/performer names from this event text:\n\n${sourceText.substring(0, 3000)}`,
            },
          ],
        }),
      }),
    ])

    const sections: string[] = []

    // Language section
    if (detectedLanguage) {
      sections.push(`Event Language: ${detectedLanguage}`)
    }

    // Artist genre section
    if (extractResponse.ok) {
      const extractData = await extractResponse.json()
      const extractContent = extractData.choices?.[0]?.message?.content || '[]'

      let artists: string[] = []
      try {
        const parsed = JSON.parse(extractContent.replace(/```json\s*/gi, '').replace(/```/g, '').trim())
        artists = Array.isArray(parsed) ? parsed.filter((a: any) => typeof a === 'string' && a.length > 1) : []
      } catch {
        // No artists parsed
      }

      if (artists.length > 0) {
        const searchArtists = artists.slice(0, 5)

        for (const artist of searchArtists) {
          try {
            const searchResponse = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
              body: JSON.stringify({
                model,
                max_tokens: 150,
                temperature: 0,
                messages: [
                  {
                    role: 'system',
                    content: 'You are a music knowledge database. Given an artist name, provide ONLY their music genre(s). Be concise. Format: "Genre: X, Y". Do NOT include nationality or country of origin — only genre matters for event classification. If unknown, say "Unknown".',
                  },
                  {
                    role: 'user',
                    content: `Artist: ${artist}`,
                  },
                ],
              }),
            })

            if (searchResponse.ok) {
              const searchData = await searchResponse.json()
              const info = searchData.choices?.[0]?.message?.content || ''
              if (info && !info.toLowerCase().includes('unknown')) {
                sections.push(`- ${artist}: ${info.trim()}`)
              }
            }
          } catch {
            // Skip failed lookups silently
          }
        }
      }
    }

    if (sections.length === 0) return ''

    return sections.join('\n')
  } catch {
    // If enrichment fails entirely, return empty — tagging still works without it
    return ''
  }
}
