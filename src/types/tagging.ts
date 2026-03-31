// === TAGGING SYSTEM TYPES ===

export interface TaxonomyItem {
  id: string
  type: 'category' | 'tag'
  name: string
  domain: 'event' | 'attraction' | 'both' | null
  parent_group: string
  section: string
  description: string
  is_selectable: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface TaggingPrompt {
  id: string
  prompt_key: 'tagging_beast' | 'validator'
  prompt_text: string
  updated_by: string
  created_at: string
  updated_at: string
}

export interface TaggingEntry {
  id: string
  user_id: string
  title: string
  source_text: string
  initial_result: string
  validated_result: string
  status: 'draft' | 'initial_done' | 'validated' | 'error'
  created_at: string
  updated_at: string
}
