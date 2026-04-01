import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Server-side Supabase client for AI Runner queries
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: NextRequest) {
  try {
    const { question, mode } = await request.json()

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 })
    }

    // Search workflows using full-text search
    const searchTerms = question
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w: string) => w.length > 2)
      .join(' | ')

    let results: any[] = []

    // Try full-text search first
    if (searchTerms) {
      const { data: ftsResults } = await supabase
        .from('ai_runner_workflows')
        .select('*')
        .textSearch('topic', searchTerms, { type: 'plain', config: 'english' })
        .limit(5)

      if (ftsResults && ftsResults.length > 0) {
        results = ftsResults
      }
    }

    // Fallback: ILIKE search on topic, category, and workflow_steps
    if (results.length === 0) {
      const keywords = question
        .toLowerCase()
        .split(/\s+/)
        .filter((w: string) => w.length > 2)
        .slice(0, 5)

      for (const keyword of keywords) {
        const { data: ilikeResults } = await supabase
          .from('ai_runner_workflows')
          .select('*')
          .or(`topic.ilike.%${keyword}%,category.ilike.%${keyword}%,workflow_steps.ilike.%${keyword}%`)
          .limit(5)

        if (ilikeResults && ilikeResults.length > 0) {
          results = [...results, ...ilikeResults]
          break
        }
      }
    }

    // Filter by mode if specified
    if (mode && results.length > 0) {
      const modeFiltered = results.filter(
        (r: any) => r.mode === mode || r.mode === 'general'
      )
      if (modeFiltered.length > 0) {
        results = modeFiltered
      }
    }

    // Deduplicate
    const seen = new Set()
    results = results.filter((r: any) => {
      if (seen.has(r.id)) return false
      seen.add(r.id)
      return true
    }).slice(0, 5)

    // Format response - provide workflow directions without revealing internals
    const workflows = results.map((r: any) => ({
      category: r.category,
      topic: r.topic,
      steps: r.workflow_steps,
      prerequisites: r.prerequisites || '',
      notes: r.notes || '',
      mode: r.mode,
      reference_url: r.reference_url || '',
      screenshots: r.screenshots || []
    }))

    return NextResponse.json({
      success: true,
      question,
      matchCount: workflows.length,
      workflows,
      hint: workflows.length === 0
        ? 'No matching workflow found. Try rephrasing your question or check available categories: events-pipeline, attractions-pipeline, mini-tools, b2b-tov, b2c-tov, tov-guidelines, setup, navigation, troubleshooting, categories-tags, column-map, ai-runner, general.'
        : undefined
    })
  } catch (error: any) {
    console.error('AI Runner query error:', error)
    return NextResponse.json(
      { error: 'Failed to process query', details: error.message },
      { status: 500 }
    )
  }
}

// GET: List all available workflow categories
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('ai_runner_workflows')
      .select('category, topic, mode')
      .order('category')

    if (error) throw error

    // Group by category
    const grouped: Record<string, { topics: string[], mode: string }[]> = {}
    for (const row of data || []) {
      if (!grouped[row.category]) grouped[row.category] = []
      grouped[row.category].push({ topics: [row.topic], mode: row.mode })
    }

    return NextResponse.json({
      success: true,
      categories: Object.keys(grouped),
      workflows: grouped,
      totalCount: (data || []).length
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to list workflows', details: error.message },
      { status: 500 }
    )
  }
}
