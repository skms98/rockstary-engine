// @ts-nocheck
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { plSupabase } from '@/lib/pl-supabase'
import Link from 'next/link'
import { OverviewTab } from './detail-overview'
import { SeoTab, TaggingTab, ReviewTab } from './detail-tabs'
import { FactCheckTab } from './detail-factcheck'
import { ScreenshotsTab } from './detail-tabs-screenshots'

// ── Types (inline to keep this page self-contained) ──────────
type AttractionStage = 'intake' | 'seo_optimization' | 'tagging' | 'review' | 'exported'
type SeoStatus = 'pending' | 'processing' | 'completed' | 'failed'
type TaggingStatus = 'pending' | 'gathering' | 'classifying' | 'validating' | 'completed' | 'failed' | 'unclassifiable'

export interface AttractionEntry {
  id: string
  attraction_id: string | null
  title: string
  url: string | null
  country: string | null
  city: string | null
  stage: AttractionStage
  raw_text: string | null
  keywords_list: string | null
  excel_sheet_name: string | null
  original_content: Record<string, unknown>
  seo_content: Record<string, unknown>
  seo_status: SeoStatus
  keywords_used: number
  keywords_total: number
  domain: string | null
  fact_sheet: Record<string, unknown>
  primary_category: string | null
  secondary_category: string | null
  tertiary_category: string | null
  quaternary_category: string | null
  marketing_tags: string[]
  tagging_status: TaggingStatus
  validation_gates_passed: number
  tagging_loops: number
  tagging_log: unknown[]
  review_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  excel_file_url: string | null
  screenshot_url: string | null
  batch_id: string | null
  batch_name: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // Notes / comments
  seo_notes: string | null
  attraction_notes: string | null
  field_notes: Record<string, string> | null
  // Assignment
  assigned_writer: string | null
  assigned_translator: string | null
  // Fact check fields
  fact_check_score: number | null
  fact_check_tov_score: number | null
  fact_check_variation: number | null
  fact_check_status: string | null
  fact_check_results: Record<string, unknown>
  fact_check_flags: unknown[]
}

const STAGE_ORDER: AttractionStage[] = ['intake', 'seo_optimization', 'tagging', 'review', 'exported']

const STAGE_META: Record<AttractionStage, { label: string; icon: string; color: string; bgColor: string; borderColor: string }> = {
  intake:            { label: 'Intake',            icon: '\uD83D\uDCE5', color: 'text-blue-400',    bgColor: 'bg-blue-500/10',    borderColor: 'border-blue-500/30' },
  seo_optimization:  { label: 'SEO Optimization',  icon: '\u270D\uFE0F', color: 'text-amber-400',   bgColor: 'bg-amber-500/10',   borderColor: 'border-amber-500/30' },
  tagging:           { label: 'Tagging',           icon: '\uD83C\uDFF7\uFE06', color: 'text-purple-400',  bgColor: 'bg-purple-500/10',  borderColor: 'border-purple-500/30' },
  review:            { label: 'Review',            icon: '\u2705', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/30' },
  exported:          { label: 'Exported',         icon: '\uD83D\uDCE4', color: 'text-gray-400',    bgColor: 'bg-gray-500/10',    borderColor: 'border-gray-500/30' },
}

// ── Main Component ────────────────────────────────
export default function AttractionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [entry, setEntry] = useState<AttractionEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'seo' | 'factcheck' | 'tagging' | 'review' | 'screenshots'>('overview')

  const fetchEntry = useCallback(async () => {
    setLoading(true)
    const { data, error } = await plSupabase
      .from('attractions')
      .select('*')
      .eq('id', id)
      .single()
    if (!error && data) setEntry(data as AttractionEntry)
    setLoading(false)
  }, [id])

  useEffect(() => { fetchEntry() }, [fetchEntry])

  const save = async (updates: Partial<AttractionEntry>) => {
    setSaving(true)
    const { error } = await plSupabase.from('attractions').update(updates).eq('id', id)
    if (!error) await fetchEntry()
    setSaving(false)
  }

  const advanceStage = async () => {
    if (!entry) return
    const idx = STAGE_ORDER.indexOf(entry.stage)
    if (idx >= STAGE_ORDER.length - 1) return
    const currentStage = STAGE_ORDER[idx]
    const nextStage = STAGE_ORDER[idx + 1]

    // Gate: Intake -> SEO Optimization
    if (currentStage === 'intake' && nextStage === 'seo_optimization') {
      if (!entry.raw_text || entry.raw_text.trim() === '') {
        window.alert('Cannot advance: Raw Content (Column C) must be populated first.')
        return
      }
    }

    // Gate: SEO Optimization -> Tagging
    if (currentStage === 'seo_optimization' && nextStage === 'tagging') {
      if (entry.seo_status !== 'completed') {
        window.alert('Cannot advance: SEO optimization must be completed first.')
        return
      }
      if (!entry.seo_content || Object.keys(entry.seo_content).length === 0) {
        window.alert('Cannot advance: SEContent (Column D) must have data.')
        return
      }
    }

    // Gate: Tagging -> Review
    if (currentStage === 'tagging' && nextStage === 'review') {
      if (entry.tagging_status !== 'completed') {
        window.alert('Cannot advance: Tagging must be completed first.')
        return
      }
      if (entry.validation_gates_passed !== 6) {
        window.alert('Cannot advance: All 6 validation gates must pass first.')
        return
      }
    }

    await save({ stage: nextStage } as Partial<AttractionEntry>)
  }

  const revertStage = async () => {
    if (!entry) return
    const idx = STAGE_ORDER.indexOf(entry.stage)
    if (idx <= 0) return
    await save({ stage: STAGE_ORDER[idx - 1] } as Partial<AttractionEntry>)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!entry) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-gray-400">Attraction not found</p>
        <Link href="/dashboard/attractions" className="text-blue-400 hover:text-blue-300 text-sm">Back to funnel</Link>
      </div>
    )
  }

  const currentStageIdx = STAGE_ORDER.indexOf(entry.stage)
  const meta = STAGE_META[entry.stage]

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link href="/dashboard/attractions" className="hover:text-white transition-colors">Attractions Funnel</Link>
        <span>/</span>
        <span className="text-white">{entry.title}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{entry.title}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${meta.bgColor} ${meta.color} border ${meta.borderColor}`}>
              <span style={{ fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif' }}>{meta.icon}</span> {meta.label}
            </span>
            {entry.batch_name && (
              <span className="text-gray-500 text-xs bg-gray-700/50 px-2 py-1 rounded">{entry.batch_name}</span>
            )}
            {entry.city && (
              <span className="text-gray-500 text-sm">{entry.city}{entry.country ? `, ${entry.country}` : ''}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {currentStageIdx > 0 && (
            <button onClick={revertStage} className="px-3 py-2 bg-gray-700 text-gray-300 text-sm rounded-lg hover:bg-gray-600 transition-colors">
              &#8592; Back
            </button>
          )}
          {currentStageIdx < STAGE_ORDER.length - 1 && (
            <button onClick={advanceStage} className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm font-medium rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all">
              Advance to {STAGE_META[STAGE_ORDER[currentStageIdx + 1]].label} &#8594;
            </button>
          )}
        </div>
      </div>

      {/* Funnel Progress Bar */}
      <div className="flex items-center gap-1 mb-8">
        {STAGE_ORDER.map((stage, i) => (
          <div key={stage} className="flex-1 flex items-center">
            <div className={`flex-1 h-2 rounded-full transition-all ${
              i < currentStageIdx? 'bg-emerald-500' : stage === entry.stage ? 'bg-blue-500 animate-pulse' : 'bg-gray-700'
            }`} />
            {i < STAGE_ORDER.length - 1 && <div className="w-1" />}
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-gray-500 -mt-6 mb-8 px-1">
        {STAGE_ORDER.map((stage) => (
          <span key={stage} className={stage === entry.stage ? STAGE_META[stage].color + ' font-medium' : ''}>
            <span style={{ fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif' }}>{STAGE_META[stage].icon}</span> {STAGE_META[stage].label}
          </span>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-800/50 p-1 rounded-lg w-fit">
        {([['overview', 'Overview'], ['seo', 'SEO'], ['factcheck', 'Fact Check'], ['tagging', 'Tagging'], ['review', 'Review'], ['screenshots', 'Screenshots']] as const).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab entry={entry} save={save} saving={saving} />}
      {activeTab === 'seo' && <SeoTab entry={entry} save={save} saving={saving} />}
      {activeTab === 'factcheck' && <FactCheckTab entry={entry} save={save} saving={saving} />}
      {activeTab === 'tagging' && <TaggingTab entry={entry} save={save} saving={saving} />}
      {activeTab === 'review' && <ReviewTab entry={entry} save={save} saving={saving} advanceStage={advanceStage} />}
      {activeTab === 'screenshots' && <ScreenshotsTab attractionId={entry.id} attractionTitle={entry.title} />}
    </div>
  )
}
