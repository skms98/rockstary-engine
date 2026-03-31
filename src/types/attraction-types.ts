// ============================================================
// Attraction Funnel Types — Rockstary Engine
// ============================================================

export type AttractionStage = 'intake' | 'seo_optimization' | 'tagging' | 'review' | 'exported'

export type SeoStatus = 'pending' | 'processing' | 'completed' | 'failed'

export type TaggingStatus = 'pending' | 'gathering' | 'classifying' | 'validating' | 'completed' | 'failed' | 'unclassifiable'

export type AttractionDomain = 'ATTRACTION' | 'EVENT'

export interface AttractionEntry {
  id: string
  attraction_id: string | null
  title: string
  url: string | null
  country: string | null
  city: string | null

  // Funnel
  stage: AttractionStage

  // Intake
  raw_text: string | null
  keywords_list: string | null
  excel_sheet_name: string | null
  original_content: Record<string, unknown>

  // SEO
  seo_content: Record<string, unknown>
  seo_status: SeoStatus
  keywords_used: number
  keywords_total: number

  // Tagging
  domain: AttractionDomain | null
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

  // Review
  review_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null

  // Files
  excel_file_url: string | null
  screenshot_url: string | null

  // Batch
  batch_id: string | null
  batch_name: string | null

  // Meta
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface AttractionStageConfig {
  key: AttractionStage
  label: string
  color: string
  bgColor: string
  borderColor: string
  icon: string
  description: string
}

export const ATTRACTION_STAGES: AttractionStageConfig[] = [
  {
    key: 'intake',
    label: 'Intake',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    icon: '📥',
    description: 'Upload Excel or add attraction manually'
  },
  {
    key: 'seo_optimization',
    label: 'SEO Optimization',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    icon: '✍️',
    description: 'AI rewrites Column D with keyword annotations'
  },
  {
    key: 'tagging',
    label: 'Tagging',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    icon: '🏷️',
    description: '4-phase: Gather → Classify → Validate → Loop'
  },
  {
    key: 'review',
    label: 'Review',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    icon: '✅',
    description: 'Final human check before export'
  },
  {
    key: 'exported',
    label: 'Exported',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-500/30',
    icon: '📤',
    description: 'Done — optimised file downloaded'
  },
]
