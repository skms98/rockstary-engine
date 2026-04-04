import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createPLClient } from '@/lib/pl-supabase'

export const maxDuration = 60

interface AIResult {
  index: number
  wrong_categories?: string[]
  wrong_tags?: string[]
}

function parseTaggingResult(result: string | null): { cats: string[]; tags: string[] } {
  if (!result) return { cats: [], tags: [] }
  try {
    // Strip markdown code fences if present
    const cleaned = result.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { cats: [], tags: [] }
    const parsed = JSON.parse(jsonMatch[0])
    const cats = (parsed.categories || parsed.category || [])
      .map((c: any) => String(c).trim())
      .filter(Boolean)
    const tags = (parsed.tags || parsed.tag || [])
      .map((t: any) => String(t).trim())
      .filter(Boolean)
    return { cats, tags }
  } catch {
    return { cats: [], tags: [] }
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = (searchParams.get('mode') || 'both') as 'categories' | 'tags' | 'both' | 'no-tags'
  const fullScan = searchParams.get('full') === 'true'
  const maxParam = fullScan ? 9999 : Math.min(parseInt(searchParams.get('max') || '300'), 2000)
  const authToken = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!authToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify auth via Rockstary Supabase
  const rsAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${authToken}` } } }
  )
  const {
    data: { user },
    error: authError,
  } = await rsAuth.auth.getUser(authToken)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let plClient: ReturnType<typeof createPLClient>
  try {
    plClient = createPLClient()
  } catch (e: any) {
    return NextResponse.json({ error: 'PL client error: ' + e.message }, { status: 500 })
  }

  try {
    const { data, error } = await rsAuth
      .from('tagging_entries')
      .select('id,title,initial_result,validated_result,status')
      .in('status', ['initial_done', 'validated'])
      .order('created_at', { ascending: false })
      .limit(maxParam)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const entries = (data || [])
      .map((entry: any) => {
        const result = entry.validated_result || entry.initial_result
        const { cats, tags } = parseTaggingResult(result)
        return { entry, cats, tags }
      })
      .filter((r: any) => {
        if (mode === 'categories') return r.cats.length > 0
        if (mode === 'tags') return r.tags.length > 0
        return r.cats.length > 0 || r.tags.length > 0
      })

    if (entries.length === 0) {
      return NextResponse.json({ issues: [], scanned: 0 })
    }

    const BATCH = 150
    const issues: object[] = []

    for (let i = 0; i < entries.length; i += BATCH) {
      const batch = entries.slice(i, i + BATCH)
      const lines = batch
        .map((r: any, idx: number) => {
          const label = `${idx}. "${r.entry.title}"`
          const catPart = mode !== 'tags' ? `Categories: [${r.cats.join('; ')}]` : ''
          const tagPart = mode !== 'categories' ? `Tags: [${r.tags.join(', ')}]` : ''
          return [label, catPart, tagPart].filter(Boolean).join(' | ')
        })
        .join('\n')

      const checkWhat =
        mode === 'categories' ? 'categories' : mode === 'tags' ? 'tags' : 'categories and tags'

      const prompt = `You are a QA auditor for a UAE event ticketing platform. Review these events/attractions and their applied ${checkWhat}.

Your job: identify labels that are CLEARLY WRONG or MISLEADING for the event type.

Rules:
- Flag only obvious semantic mismatches. Example: "Comedy Shows" on Swan Lake (a ballet) is WRONG. "Music" on a marathon race is WRONG.
- A label is wrong if it describes a fundamentally different type of activity or genre.
- If a label could plausibly apply, do NOT flag it.
- Wrong categories go in "wrong_categories", wrong tags in "wrong_tags".
- Only include an entry in your response if there is at least one wrong label.
- Return ONLY a valid JSON array, no explanation, no markdown.

Events:
${lines}

Response format (only events with issues, empty array [] if none):
[{"index":0,"wrong_categories":["Wrong Cat"],"wrong_tags":["wrong-tag"]}]`

      try {
        const { data: aiData, error: aiError } = await plClient.functions.invoke('ai-process', {
          body: { prompt, stepField: 'qa-tagging-entries', eventTitle: '' },
        })
        if (aiError) throw new Error(aiError.message || JSON.stringify(aiError))

        const rawText = (aiData?.result || aiData?.text || aiData?.content || '') as string
        const jsonMatch = rawText.match(/\[[\s\S]*\]/)
        if (!jsonMatch) continue

        const results: AIResult[] = JSON.parse(jsonMatch[0])
        for (const r of results) {
          const item = batch[r.index]
          if (!item) continue
          const wrongCats = r.wrong_categories ?? []
          const wrongTags = r.wrong_tags ?? []
          if (wrongCats.length || wrongTags.length) {
            issues.push({
              entry_id: item.entry.id,
              title: item.entry.title,
              status: item.entry.status,
              applied_categories: item.cats,
              applied_tags: item.tags,
              wrong_categories: wrongCats,
              wrong_tags: wrongTags,
            })
          }
        }
      } catch (batchErr: any) {
        return NextResponse.json(
          { error: `AI batch ${Math.floor(i / BATCH) + 1} failed: ${batchErr?.message || 'Unknown error'}` },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ issues, scanned: entries.length })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
