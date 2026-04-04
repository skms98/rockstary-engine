'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface TaggingEntry {
  id: string;
  user_id: string;
  title: string;
  source_text: string;
  source_url?: string;
  screenshots?: string[];
  source_type?: 'text' | 'url' | 'mixed';
  status: 'draft' | 'initial_done' | 'validated' | 'error';
  initial_result?: any;
  validated_result?: any;
  created_at: string;
  updated_at: string;
}

interface TaxonomyItem {
  id: string;
  type: 'category' | 'tag';
  name: string;
  domain: 'event' | 'attraction' | 'both' | null;
  parent_group?: string;
  section?: string;
  description?: string;
  is_selectable: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface TaggingPrompt {
  id: string;
  prompt_key: 'tagging_beast' | 'validator';
  prompt_text: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

interface Stats {
  total: number;
  initial_done: number;
  validated: number;
  error: number;
}

export default function TaggingPage() {
  const [activeTab, setActiveTab] = useState<'classify' | 'taxonomy' | 'prompts' | 'qa'>('classify')