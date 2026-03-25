import { NextRequest, NextResponse } from 'next/server'

// Run all AI steps sequentially for an entry
// This calls the process endpoint for each step in order
export async function POST(request: NextRequest) {
  try {
    const { entryId, authToken } = await request.json()
    const baseUrl = request.nextUrl.origin

    const steps = [
      'recommended_versions',
      'fact_check_scores',
      'duplicate_analysis',
      'ab_tests',
      'organiser_trigger_risk',
      'tov_score',
      'grammar_style',
      'reviewer_output',
      'resolver_output',
      'seo_analysis',
      'fact_check_final',
      'ranked_versions',
    ]

    const results: Record<string, string> = {}

    for (const step of steps) {
      const res = await fetch(`${baseUrl}/api/ai/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId, stepField: step, authToken }),
      })

      const data = await res.json()
      if (!res.ok) {
        results[step] = `ERROR: ${data.error}`
        // Continue to next step even if one fails
        continue
      }
      results[step] = 'OK'
    }

    return NextResponse.json({ success: true, results })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
