import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
    const { data, error } = await supabase
      .from('batch_jobs')
      .select('*')
      .eq('id', params.id)
      .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
    return NextResponse.json(data)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
    const { error } = await supabase
      .from('batch_jobs')
      .delete()
      .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
}
