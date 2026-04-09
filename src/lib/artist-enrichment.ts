// Event Enrichment via AI Knowledge
// 1. Extracts artist names and looks up their music genre + performance language
// 2. Detects event performance language from text signals + artist knowledge
// Used by both standalone tagging tool and funnel categories-process

/**
 * Use OpenAI to extract artist/performer names from event text,
 * then look up each artist's genre and performance language.
 * Returns a formatted string to inject into the tagging prompt.
 */
export async function enrichArtistInfo(
  sourceText: string,
  apiKey: string,
  model: string = 'gpt-4o-mini'
): Promise<string> {
  try {
    // Step 1: Extract artist names
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
            content: 'You extract artist, performer, DJ, band, comedian, and musician names from event descriptions. Output ONLY a JSON array of name strings. If no artists/performers found, output []. Do not include venue names, event names, or promoter names — ONLY performing artists/acts.',
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
      // No artists parsed — try language detection from text alone
      return await detectLanguageFromText(sourceText, apiKey, model)
    }

    if (artists.length === 0) {
      return await detectLanguageFromText(sourceText, apiKey, model)
    }

    // Step 2: For each artist, look up genre AND performance language
    const searchArtists = artists.slice(0, 5)
    const enrichments: string[] = []
    const detectedLanguages: string[] = []

    for (const artist of searchArtists) {
      try {
        const searchResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            max_tokens: 200,
            temperature: 0,
            messages: [
              {
                role: 'system',
                content: `You are an entertainment knowledge database. Given an artist/performer name and their event context, provide:
1. Genre: their music genre(s) OR performance type (e.g. "Stand-up Comedy", "EDM", "Pop", "Arabic Pop")
2. Performance Language: the language they PERFORM in on stage (e.g. "Arabic", "English", "Hindi", "Mixed Arabic/English"). This is the language the audience hears — not where the artist is from.

Format: "Genre: X | Performance Language: Y"
If either is unknown, say "Unknown" for that field only.`,
              },
              {
                role: 'user',
                content: `Artist: ${artist}\nEvent context: ${sourceText.substring(0, 500)}`,
              },
            ],
          }),
        })

        if (searchResponse.ok) {
          const searchData = await searchResponse.json()
          const info = searchData.choices?.[0]?.message?.content || ''
          if (info) {
            // Extract performance language
            const langMatch = info.match(/Performance Language:\s*(.+?)(?:\s*$|\s*\|)/i)
            if (langMatch) {
              const lang = langMatch[1].trim()
              if (lang.toLowerCase() !== 'unknown' && lang.toLowerCase() !== 'english') {
                detectedLanguages.push(lang)
              }
            }

            // Extract genre
            const genreMatch = info.match(/Genre:\s*(.+?)(?:\s*\||$)/i)
            if (genreMatch) {
              const genre = genreMatch[1].trim()
              if (genre.toLowerCase() !== 'unknown') {
                enrichments.push(`- ${artist}: Genre: ${genre}`)
              }
            }
          }
        }
      } catch {
        // Skip failed lookups silently
      }
    }

    // Build output
    const sections: string[] = []

    // Performance language (use the first non-English language detected from any artist)
    if (detectedLanguages.length > 0) {
      // Deduplicate
      const uniqueLangs = Array.from(new Set(detectedLanguages))
      sections.push(`Performance Language: ${uniqueLangs.join(', ')}`)
    }

    // Artist genres
    if (enrichments.length > 0) {
      sections.push(...enrichments)
    }

    if (sections.length === 0) return ''

    return sections.join('\n')
  } catch {
    return ''
  }
}

/**
 * Fallback: detect performance language from event text alone (no artist context).
 * Used when no artists are found in the text.
 */
async function detectLanguageFromText(
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
            content: `You detect the PERFORMANCE language of an event (the language the audience will hear on stage). Look for explicit mentions like "in Arabic", "Arabic comedy", "Hindi stand-up", "performed in French", "Arabic Night", "Bollywood".
Output ONLY the language name (e.g. "Arabic", "Hindi") if clearly indicated.
Output "none" if English or cannot be determined. Do NOT guess.`,
          },
          {
            role: 'user',
            content: `Detect the performance language:\n\n${sourceText.substring(0, 2000)}`,
          },
        ],
      }),
    })

    if (!response.ok) return ''

    const data = await response.json()
    const result = (data.choices?.[0]?.message?.content || '').trim().toLowerCase()

    if (result === 'none' || result === 'english' || result === 'unknown') return ''

    const lang = result.charAt(0).toUpperCase() + result.slice(1)
    return `Performance Language: ${lang}`
  } catch {
    return ''
  }
}
