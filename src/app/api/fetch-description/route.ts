import { NextRequest, NextResponse } from 'next/server'

// Fetch event description from a Platinumlist URL
export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Fetch the page HTML
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })

    if (!response.ok) {
      return NextResponse.json({ error: `Failed to fetch URL: ${response.status}` }, { status: 500 })
    }

    const html = await response.text()

    // Extract description from Platinumlist page
    // Try multiple strategies to find the event description
    let description = ''

    // Strategy 1: Look for og:description meta tag
    const ogDescMatch = html.match(/<meta\s+(?:property|name)="og:description"\s+content="([^"]*)"/)
      || html.match(/<meta\s+content="([^"]*)"\s+(?:property|name)="og:description"/)
    if (ogDescMatch?.[1]) {
      description = decodeHTMLEntities(ogDescMatch[1])
    }

    // Strategy 2: Look for event description/overview section
    // Platinumlist uses various containers for event descriptions
    const descPatterns = [
      // Common PL patterns
      /<div[^>]*class="[^"]*event-description[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*class="[^"]*overview[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*id="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      // Look for "About" or "Overview" sections
      /(?:About|Overview|Description)[\s\S]*?<(?:p|div)[^>]*>([\s\S]*?)<\/(?:p|div)>/i,
      // JSON-LD structured data
      /"description"\s*:\s*"([^"]{50,})"/,
    ]

    for (const pattern of descPatterns) {
      const match = html.match(pattern)
      if (match?.[1]) {
        const cleaned = stripHTML(match[1]).trim()
        if (cleaned.length > description.length) {
          description = cleaned
        }
      }
    }

    // Strategy 3: Try JSON-LD structured data for longer description
    const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)
    if (jsonLdMatch) {
      for (const block of jsonLdMatch) {
        try {
          const jsonStr = block.replace(/<script[^>]*>|<\/script>/gi, '')
          const data = JSON.parse(jsonStr)
          const desc = data.description || data.about?.description
          if (desc && typeof desc === 'string' && desc.length > description.length) {
            description = desc
          }
        } catch {
          // Skip invalid JSON-LD
        }
      }
    }

    if (!description) {
      // Strategy 4: meta description as last resort
      const metaDescMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/)
        || html.match(/<meta\s+content="([^"]*)"\s+name="description"/)
      if (metaDescMatch?.[1]) {
        description = decodeHTMLEntities(metaDescMatch[1])
      }
    }

    if (!description) {
      return NextResponse.json({
        error: 'Could not extract description from the page. Please enter it manually.',
        html_length: html.length,
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      description: description.trim(),
      source: 'url_fetch',
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch description' }, { status: 500 })
  }
}

function stripHTML(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)))
}
