import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
    try {
          const { type, item_ids, variables, label } = await request.json()

      if (!type || !item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
              return NextResponse.json({ error: 'type and item_ids are required' }, { status: 400 })
      }

      const { data, error } = await supabase
            .from('batch_jobs')
            .insert({
                      type,
                      item_ids,
                      variables: variables || {},
                      label: label || `${type} batch (${item_ids.length} items)`,
                      status: 'queued',
                      progress: {
                                  total: item_ids.length,
                                  completed: 0,
                                  failed: 0,
                                  items: item_ids.map((id: string) => ({ id, status: 'queued' }))
                      }
            })
            .select()
            .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
          return NextResponse.json({ jobId: data.id, job: data })
    } catch (err) {
          return NextResponse.json({ error: String(err) }, { status: 500 })
    }
}
