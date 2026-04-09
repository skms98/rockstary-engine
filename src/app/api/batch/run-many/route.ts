// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const maxDuration = 300 // 5 min max on Vercel Pro

export async function POST(request: NextRequest) {
  try {
    const { jobId } = await request.json()
    const baseUrl = request.nextUrl.origin

    // Load job from Supabase
    const { data: job, error: loadErr } = await supabase
      .from('batch_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (loadErr || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Mark as running
    await supabase
      .from('batch_jobs')
      .update({ status: 'running', updated_at: new Date().toISOString() })
      .eq('id', jobId)

    const { type, item_ids, variables } = job
    const progress = JSON.parse(JSON.stringify(job.progress)) // deep clone

    // Helper: persist progress to Supabase
    const saveProgress = async () => {
      await supabase
        .from('batch_jobs')
        .update({ progress, updated_at: new Date().toISOString() })
        .eq('id', jobId)
    }

    // -- EVENTS: calls /api/ai/run-all for each selected event
    const processEvent = async (itemId: string) => {
      const idx = progress.items.findIndex((i: any) => i.id === itemId)
      if (idx !== -1) progress.items[idx].status = 'running'
      await saveProgress()

      const resp = await fetch(`${baseUrl}/api/ai/run-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(variables.authToken ? { 'x-openai-key': variables.authToken } : {}),
          ...(variables.mode ? { 'x-ai-mode': variables.mode } : {})
        },
        body: JSON.stringify({
          entryId: itemId,
          authToken: variables.authToken || '',
          adminKey: variables.adminKey || ''
        })
      })
      if (!resp.ok) throw new Error(`run-all failed (${resp.status}): ${resp.statusText}`)
      return resp.json()
    }

    // -- ATTRACTIONS: calls generate-seo + classify for each selected attraction
    const processAttraction = async (itemId: string) => {
      const steps: string[] = variables.steps || ['seo', 'classify']
      const idx = progress.items.findIndex((i: any) => i.id === itemId)
      if (idx !== -1) progress.items[idx].status = 'running'
      await saveProgress()

      if (steps.includes('seo')) {
        const r = await fetch(`${baseUrl}/api/attractions/generate-seo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attractionId: itemId })
        })
        if (!r.ok) throw new Error(`generate-seo failed: ${r.statusText}`)
      }

      if (steps.includes('classify')) {
        const r = await fetch(`${baseUrl}/api/attractions/classify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attractionId: itemId })
        })
        if (!r.ok) throw new Error(`classify failed: ${r.statusText}`)
      }

      if (steps.includes('evaluate')) {
        const r = await fetch(`${baseUrl}/api/attractions/evaluate-quality`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attractionId: itemId })
        })
        if (!r.ok) throw new Error(`evaluate failed: ${r.statusText}`)
      }
    }

    // -- Run ALL selected items in PARALLEL (Promise.allSettled never throws)
    await Promise.allSettled(
      item_ids.map(async (itemId: string) => {
        try {
          if (type === 'events') {
            await processEvent(itemId)
          } else {
            await processAttraction(itemId)
          }
          const idx = progress.items.findIndex((i: any) => i.id === itemId)
          if (idx !== -1) progress.items[idx].status = 'completed'
          progress.completed++
        } catch (err) {
          const idx = progress.items.findIndex((i: any) => i.id === itemId)
          if (idx !== -1) {
            progress.items[idx].status = 'failed'
            progress.items[idx].error = String(err)
          }
          progress.failed++
        } finally {
          await saveProgress()
        }
      })
    )

    // Final job status
    const finalStatus =
      progress.failed === 0 ? 'completed' :
      progress.completed === 0 ? 'failed' : 'partial'

    await supabase
      .from('batch_jobs')
      .update({
        status: finalStatus,
        progress,
        updated_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId)

    return NextResponse.json({ ok: true, status: finalStatus, progress })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
                             }
