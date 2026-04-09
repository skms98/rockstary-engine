'use client'

import { useState, useRef, useCallback } from 'react'

type ToolTab = 'shortener' | 'teaser' | 'factchecker' | 'offers' | 'reformatter' | 'transcriber' | 'tagger'
type NumberingMode = 'section' | 'subsection'

interface Tab {
  id: ToolTab
  label: string
  icon: string
  description: string
}

interface ScreenshotItem {
  id: string
  file: File
  preview: string
  base64: string
  label: string
}

const TABS: Tab[] = [
  { id: 'shortener', label: 'Text Shortener', icon: 'CUT', description: 'Shorten text while keeping the meaning' },
  { id: 'teaser', label: 'Teaser Creator', icon: 'TGT', description: 'Create engaging event teasers' },
  { id: 'factchecker', label: 'Fact Checker', icon: 'CHK', description: 'Check and fix text for factual accuracy' },
  { id: 'offers', label: 'New Offers', icon: 'NEW', description: 'Generate fresh promotional offers' },
  { id: 'reformatter', label: 'Bulk Reformatter', icon: 'FMT', description: 'Reformat multiple text blocks at once' },
  { id: 'transcriber', label: 'Table Transcriber', icon: 'TBL', description: 'Convert messy data into clean tables -- supports screenshot upload' },
  { id: 'tagger', label: 'Block Tagger', icon: 'TAG', description: 'Tag content blocks with metadata labels -- supports screenshot upload' },
]

const SYSTEM_PROMPTS: Record<ToolTab, string> = {
  shortener: `You are a professional text shortener for Platinumlist, a leading event ticketing platform specializing in global music festivals and live events.

Your job is to shorten and compress the provided text while preserving its core meaning, tone, and all emoji.

Rules: 
- Keep it to one, two, or three convise sentences maximum
- Preserve all emoji
- Keep the tone, energy,and action-oriented messaging
- Keep the blogs, is an event or specific offer

Give only the shortened text, nothing else.`, 
  teaser: `You are a creative director( create humanized, emotionally connecting event teasers for Platinumlist events in a/ B2C travel context.
Data You'll receive:
- Event name
- Event category (festival, concert, sports etc)
- Date, location, key artists / teams
- Any additional context

A2B 2.4 (our current ARP tv) Tune of Voice:
- Inspiring, confident, criea 
- CieltyŸÀAA Y/artists are the stars of stagi
- You're their fan, rooter, haer cheering
- ton rays of shu 
- Weniy of travel,
 the excltement of discovery