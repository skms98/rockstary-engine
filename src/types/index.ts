export type ContentMode = 'events' | 'attractions'

export type InputMethod = 'screenshot_url' | 'rawtext_url' | 'url_only' | 'excel_upload'

// Column mapping for Excel import (0-indexed column numbers)
export const EXCEL_COLUMN_MAP: Record<string, number> = {
  event_id: 0,            // A
  event_title: 1,         // B
  event_url: 2,           // C
  page_qa_comments: 2,    // C (also used for QA)
  categories: 4,          // E
  tags: 5,                // F
  original_description: 7, // H
  recommended_versions: 9, // J
  fact_check_scores: 10,   // K
  duplicate_analysis: 11,  // L
  ab_tests: 12,            // M
  organiser_trigger_risk: 13, // N
  tov_score: 14,           // O
  grammar_style: 15,       // P
  reviewer_output: 22,     // W
  resolver_output: 24,     // Y
  prev_original_description: 28, // AC
  seo_analysis: 26,        // AA
  fact_check_final: 27,    // AB
  ranked_versions: 32,     // AG
}

export interface EventEntry {
  id: string
  user_id: string
  mode: ContentMode
  event_id: string
  event_title: string
  event_url: string
  input_method: InputMethod
  screenshot_url?: string
  // Step data columns
  original_description: string        // H - Original Description
  recommended_versions: string        // J - Recommended versions
  fact_check_scores: string           // Step 3
  duplicate_analysis: string          // Step 4
  ab_tests: string                    // Step 5
  organiser_trigger_risk: string      // Step 6
  tov_score: string                   // Step 7
  grammar_style: string               // Step 8
  reviewer_output: string             // Step 9 - W
  resolver_output: string             // Step 10 - Y
  prev_original_description: string   // AC
  seo_analysis: string                // Step 11 - AA
  fact_check_final: string            // Step 12
  ranked_versions: string             // Step 13 - AG
  // Categories/Tags (Step B)
  categories: string
  tags: string
  // Page QA (Step A)
  page_qa_comments: string
  // Meta
  status: 'draft' | 'in_progress' | 'review' | 'completed'
  created_at: string
  updated_at: string
}

export interface StepResult {
  step: string
  label: string
  column: string
  value: string
  status: 'pending' | 'processing' | 'done' | 'error'
}

export interface StepConfig {
  step: string
  label: string
  column: string
  field: string
  optional?: boolean
}

export const STEPS_CONFIG: StepConfig[] = [
  { step: '1', label: 'Event ID', column: 'A', field: 'event_id' },
  { step: '2', label: 'Event Title', column: 'B', field: 'event_title' },
  { step: 'A', label: 'Page Structure & QA', column: 'C', field: 'page_qa_comments', optional: true },
  { step: 'B', label: 'Categories & Tags', column: 'E', field: 'categories', optional: true },
  { step: 'S1', label: 'Original Description', column: 'H', field: 'original_description' },
  { step: 'S2', label: 'Recommended Versions', column: 'J', field: 'recommended_versions' },
  { step: 'S3', label: 'Fact Check Scores', column: 'K', field: 'fact_check_scores' },
  { step: 'S4', label: 'Duplicate Analysis', column: 'L', field: 'duplicate_analysis' },
  { step: 'S5', label: 'A/B Tests', column: 'M', field: 'ab_tests' },
  { step: 'S6', label: 'Organiser Trigger Risk', column: 'N', field: 'organiser_trigger_risk' },
  { step: 'S7', label: 'TOV Score', column: 'O', field: 'tov_score' },
  { step: 'S8', label: 'Grammar & Style', column: 'P', field: 'grammar_style' },
  { step: 'S9', label: 'Reviewer', column: 'W', field: 'reviewer_output' },
  { step: 'S10', label: 'Resolver', column: 'Y', field: 'resolver_output' },
  { step: 'S11', label: 'SEO Analysis', column: 'AA', field: 'seo_analysis' },
  { step: 'S12', label: 'Fact Check (Final)', column: 'AB', field: 'fact_check_final' },
  { step: 'S13', label: 'Ranked Top Versions', column: 'AG', field: 'ranked_versions' },
]
