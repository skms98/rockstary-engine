export type ContentMode = 'events' | 'attractions'

export type InputMethod = 'screenshot_url' | 'rawtext_url' | 'url_only' | 'excel_upload'

// Column mapping for Excel import (0-indexed column numbers)
// VERIFIED from actual sheet headers (Blueprint v2 audit)
// Accounts for blue spacer columns (G, H, L, M, AA, AC) and cream/label columns
export const EXCEL_COLUMN_MAP: Record<string, number> = {
  event_id: 0,            // A
  event_title: 1,         // B
  event_url: 2,           // C
  page_qa_comments: 3,    // D - Page structure and comments
  categories: 4,          // E - Validated categories and tags
  tags: 5,                // F - old Tags v1
  // G (6) = blue spacer
  // H (7) = blue spacer
  original_description: 8, // I - Original description (Step 1)
  // J (9) = label column "I & K are base for every test" — do NOT write data
  recommended_versions: 10, // K - Recommended versions (Step 2)
  // L (11) = blue spacer
  // M (12) = orange spacer
  fact_check_scores: 13,   // N - Fact check Scores (Step 3)
  // O (14) = cream spacer
  duplicate_analysis: 15,  // P - Duplicates? (Step 4)
  // Q (16) = cream spacer
  ab_tests: 17,            // R - A/B Tests (Step 5)
  // S (18) = cream spacer
  organiser_trigger_risk: 19, // T - Organiser trigger risk (Step 6)
  // U (20) = cream spacer
  tov_score: 21,           // V - TOV Score (Step 7)
  // W (22) = cream spacer
  grammar_style: 23,       // X - Grammar and style (Step 8)
  // Y (24) = cream spacer
  reviewer_output: 25,     // Z - Reviewer (Step 9)
  // AA (26) = blue spacer
  resolver_output: 27,     // AB - Resolver (Step 10)
  // AC (28) = blue spacer
  prev_original_description: 29, // AD - Old version (copy of original from I)
  seo_analysis: 30,        // AE - Old vs Resolver SEO content analysis (Step 11)
  fact_check_final: 31,    // AF - Old vs Resolver Fact check (Step 12)
  ranked_versions: 32,     // AG - Top versions (Step 13)
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
  screenshots?: { order: number; url: string; label: string; group?: number }[]
  // Step data columns
  original_description: string        // I - Original Description
  recommended_versions: string        // K - Recommended versions
  fact_check_scores: string           // N - Step 3
  duplicate_analysis: string          // P - Step 4
  ab_tests: string                    // R - Step 5
  organiser_trigger_risk: string      // T - Step 6
  tov_score: string                   // V - Step 7
  grammar_style: string               // X - Step 8
  reviewer_output: string             // Z - Step 9
  resolver_output: string             // AB - Step 10
  prev_original_description: string   // AD
  seo_analysis: string                // AE - Step 11
  fact_check_final: string            // AF - Step 12
  ranked_versions: string             // AG - Step 13
  // Attractions-specific fields
  keywords_list: string               // Keywords for attraction SEO optimization
  optimized_description: string       // Final keyword-optimized description
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

// Events pipeline: 13-step content engine
// Column letters VERIFIED from actual sheet headers (Blueprint v2 audit)
export const STEPS_CONFIG: StepConfig[] = [
  { step: '1', label: 'Event ID', column: 'A', field: 'event_id' },
  { step: '2', label: 'Event Title', column: 'B', field: 'event_title' },
  { step: 'A', label: 'Page Structure & QA', column: 'D', field: 'page_qa_comments', optional: true },
  { step: 'B', label: 'Categories & Tags', column: 'E', field: 'categories', optional: true },
  { step: 'S1', label: 'Original Description', column: 'I', field: 'original_description' },
  { step: 'S2', label: 'Recommended Versions', column: 'K', field: 'recommended_versions' },
  { step: 'S3', label: 'Fact Check Scores', column: 'N', field: 'fact_check_scores' },
  { step: 'S4', label: 'Duplicate Analysis', column: 'P', field: 'duplicate_analysis' },
  { step: 'S5', label: 'A/B Tests', column: 'R', field: 'ab_tests' },
  { step: 'S6', label: 'Organiser Trigger Risk', column: 'T', field: 'organiser_trigger_risk' },
  { step: 'S7', label: 'TOV Score', column: 'V', field: 'tov_score' },
  { step: 'S8', label: 'Grammar & Style', column: 'X', field: 'grammar_style' },
  { step: 'S9', label: 'Reviewer', column: 'Z', field: 'reviewer_output' },
  { step: 'S10', label: 'Resolver', column: 'AB', field: 'resolver_output' },
  { step: 'S11', label: 'SEO Analysis', column: 'AE', field: 'seo_analysis' },
  { step: 'S12', label: 'Fact Check (Final)', column: 'AF', field: 'fact_check_final' },
  { step: 'S13', label: 'Ranked Top Versions', column: 'AG', field: 'ranked_versions' },
]

// Attractions pipeline: keyword-optimized content flow
// Attractions are different from events:
// - Text is in attractions format (experience/venue focused, not event-date focused)
// - Includes a keywords list for SEO optimization
// - Descriptions are optimized around keywords, not just rewritten
// - Still uses Platinumlist TOV
// - No organiser trigger risk (attractions are venue-owned)
// - No A/B tests (attractions are evergreen, not time-bound)
export const ATTRACTIONS_STEPS_CONFIG: StepConfig[] = [
  { step: '1', label: 'Attraction ID', column: 'A', field: 'event_id' },
  { step: '2', label: 'Attraction Name', column: 'B', field: 'event_title' },
  { step: 'A', label: 'Page Structure & QA', column: 'C', field: 'page_qa_comments', optional: true },
  { step: 'B', label: 'Categories & Tags', column: 'E', field: 'categories', optional: true },
  { step: 'S1', label: 'Original Description', column: 'I', field: 'original_description' },
  { step: 'K', label: 'Keywords List', column: '-', field: 'keywords_list' },
  { step: 'S2', label: 'Keyword-Optimized Versions', column: 'K', field: 'recommended_versions' },
  { step: 'S3', label: 'Fact Check', column: 'N', field: 'fact_check_scores' },
  { step: 'S4', label: 'Duplicate Analysis', column: 'P', field: 'duplicate_analysis' },
  { step: 'S5', label: 'TOV Score', column: 'V', field: 'tov_score' },
  { step: 'S6', label: 'Grammar & Style', column: 'X', field: 'grammar_style' },
  { step: 'S7', label: 'Reviewer', column: 'Z', field: 'reviewer_output' },
  { step: 'S8', label: 'Resolver', column: 'AB', field: 'resolver_output' },
  { step: 'S9', label: 'SEO Keyword Analysis', column: 'AE', field: 'seo_analysis' },
  { step: 'S10', label: 'Fact Check (Final)', column: 'AF', field: 'fact_check_final' },
  { step: 'S11', label: 'Optimized Final Description', column: '-', field: 'optimized_description' },
  { step: 'S12', label: 'Ranked Top Versions', column: 'AG', field: 'ranked_versions' },
]
