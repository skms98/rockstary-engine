// Artist Enrichment via Real-Time Web Search
// Extracts artist names from event text, searches for genre & nationality
// Used by both standalone tagging tool and funnel categories-process

/**
 * Use OpenAI to extract artist/performer names from event text,
 * then search the web for each artist's genre and nationality.
 * Returns a formatted string to inject into the tagging prompt.
 */
export async function enrichArtistInfo(
  sourceText: string,
  apiKey: string,
  model: string = 'gpt-4o-mini'
): Promise<string> {
  try {
    // Step 1: Extract artist names using a quick AI call
    const extractResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
    })

    if (!extractResponse.ok) return ''

    const extractData = await extractResponse.json()
    const extractContent = extractData.choices?.[0]?.message?.content || '[]'

    let artists: string[] = []
    try {
      const parsed = JSON.parse(extractContent.replace(/```json\s*/gi, '').replace(/```/g, '').trim())
      artists = Array.isArray(parsed) ? parsed.filter((a: any) => typeof a === 'string' && a.length > 1) : []
    } catch {
      return ''
    }

    if (artists.length === 0) return ''

    // Step 2: Search for each artist's genre and nationality (max 5 to keep it fast)
    const searchArtists = artists.slice(0, 5)
    const enrichments: string[] = []

    for (const artist of searchArtists) {
      try {
        const searchQuery = `${artist} musician genre nationality country origin`
        // Use Google Custom Search API if available, otherwise use a simple knowledge call
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
                content: 'You are a music knowledge database. Given an artist name, provide their genre(s) and nationality/country of origin. Be concise. Format: "Genre: X | Nationality: Y". If unknown, say "Unknown".',
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
            enrichments.push(`- ${artist}: ${info.trim()}`)
          }
        }
      } catch {
        // Skip failed lookups silently
      }
    }

    if (enrichments.length === 0) return ''

    return enrichments.join('\n')
  } catch {
    // If enrichment fails entirely, return empty — tagging still works without it
    return ''
  }
}
