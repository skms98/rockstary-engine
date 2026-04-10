// @ts-nocheck
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('batch_jobs')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json([])
    return NextResponse.json(data ?? [])
  } catch {
    return NextResponse.json([])
  }
}
