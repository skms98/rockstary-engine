'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ATTRACTIONS_STEPS_CONFIG, type EventEntry } from '@/types'
import { ATTRACTION_AI_STEPS } from '@/lib/ai-prompts-attractions'

// AI-processable step fields for attractions
const AI_STEPS = ATTRACTION_AI_STEPS

// Simple markdown-like renderer for AI output
function FormattedContent({ text }: { text: string }) {
  if (!text) return <p className="text-pl-muted italic text-sm">No content yet</p>

  const lines = text.split('\n')
  const elements: JSX.Element[] = []

  lines.forEach((line, i) => {
    const trimmed = line.trim()
    if (!trimmed) {
      elements.push(<div key={i} className="h-2" />)
      return
    }

    // Headers
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h4 key={i} className="text-sm font-semibold text-emerald-400 mt-3 mb-1">
          {trimmed.slice(4)}
        </h4>
      )
      return
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h3 key={i} className="text-sm font-bold text-emerald-400 mt-4 mb-1.5">
          {trimmed.slice(3)}
        </h3>
      )
      return
    }
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h2 key={i} className="text-base font-bold text-white mt-4 mb-2">
          {trimmed.slice(2)}
        </h2>
      )
      return
    }

    // Horizontal rule
    if (/^[-=_]{3,}$/.test(trimmed)) {
      elements.push(<hr key={i} className="border-pl-border my-3" />)
      return
    }

    // Bullet points
    if (trimmed.startsWith('- ') || trimmed.startsWith('â¢ ') || trimmed.startsWith('* ')) {
      const content = trimmed.slice(2)
      elements.push(
        <div key={i} className="flex gap-2 ml-2 my-0.5">
          <span className="text-emerald-500/60 mt-0.5 flex-shrink-0">â¢</span>
          <span className="text-sm text-pl-text-dim leading-relaxed">{renderInline(content)}</span>
        </div>
      )
      return
    }

    // Numbered list
    const numMatch = trimmed.match(/^(\d+)[.)]\s+(.*)/)
    if (numMatch) {
      elements.push(
        <div key={i} className="flex gap-2 ml-2 my-0.5">
          <span className="text-emerald-500/60 font-mono text-xs mt-0.5 flex-shrink-0 w-5 text-right">{numMatch[1]}.</span>
          <span className="text-sm text-pl-text-dim leading-relaxed">{renderInline(numMatch[2])}</span>
        </div>
      )
      return
    }

    // Score lines
    const scoreMatch = trimmed.match(/^(Score|Rating|Grade|Risk|Result|Verdict|Overall|Total|Final|Keyword|Density)[:\s]+(.+)/i)
    if (scoreMatch) {
      elements.push(
        <div key={i} className="flex items-center gap-2 my-1.5 px-3 py-1.5 rounded-lg bg-pl-navy/60 border border-pl-border/50">
          <span className="text-xs font-semibold text-pl-text-dim uppercase tracking-wider">{scoreMatch[1]}</span>
          <span className="text-sm font-bold text-emerald-400">{scoreMatch[2]}</span>
        </div>
      )
      return
    }

    // Version labels
    const versionMatch = trimmed.match(/^(Version\s+[A-Z0-9]+|Option\s+\d+|Variant\s+\d+)[:\s]+(.*)$/i)
    if (versionMatch) {
      elements.push(
        <div key={i} className="mt-3 mb-1">
          <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded mb-1">
            {versionMatch[1]}
          </span>
          {versionMatch[2] && (
            <p className="text-sm text-pl-text-dim leading-relaxed ml-1">{renderInline(versionMatch[2])}</p>
          )}
        </div>
      )
      return
    }

    // Keyword tags (comma-separated keywords line)
    if (trimmed.includes(',') && trimmed.split(',').length >= 3 && trimmed.split(',').every(k => k.trim().split(' ').length <= 4)) {
      const keywords = trimmed.split(',').map(k => k.trim()).filter(Boolean)
      elements.push(
        <div key={i} className="flex flex-wrap gap-1.5 my-2">
          {keywords.map((kw, ki) => (
            <span key={ki} className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {kw}
            </span>
          ))}
        </div>
      )
      return
    }

    // Regular paragraph
    elements.push(
      <p key={i} className="text-sm text-pl-text-dim leading-relaxed my-0.5">
        {renderInline(trimmed)}
      </p>
    )
  })

  return <div className="space-y-0">{elements}</div>
}

// Render inline formatting: **bold**, *italic*, `code`
function renderInline(text: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/)
    const codeMatch = remaining.match(/`(.+?)`/)
    const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/)

    let earliest: { match: RegExpMatchArray; type: string } | null = null
    for (const [m, type] of [[boldMatch, 'bold'], [codeMatch, 'code'], [italicMatch, 'italic']] as const) {
      if (m && m.index !== undefined) {
        if (!earliest || m.index < earliest.match.index!) {
          earliest = { match: m, type }
        }
      }
    }

    if (!earliest) {
      parts.push(remaining)
      break
    }

    const { match, type } = earliest
    const idx = match.index!

    if (idx > 0) parts.push(remaining.slice(0, idx))

    if (type === 'bold') {
      parts.push(<strong key={key++} className="text-white font-semibold">{match[1]}</strong>)
    } else if (type === 'code') {
      parts.push(<code key={key++} className="text-xs bg-pl-dark px-1.5 py-0.5 rounded font-mono text-emerald-400/80">{match[1]}</code>)
    } else if (type === 'italic') {
      parts.push(<em key={key++} className="text-pl-text-dim/80">{match[1]}</em>)
    }

    remaining = remaining.slice(idx + match[0].length)
  }

  return parts
}

// Content preview for collapsed steps
function ContentPreview({ text, maxLength = 120 }: { text: string; maxLength?: number }) {
  if (!text || !text.trim()) return null
  const clean = text.replace(/\n+/g, ' ').replace(/[#*_`]+/g, '').replace(/\s+/g, ' ').trim()
  const preview = clean.length > maxLength ? clean.slice(0, maxLength) + '...' : clean
  return (
    <p className="text-xs text-pl-muted/70 mt-1 line-clamp-1">{preview}</p>
  )
}

export default function AttractionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [entry, setEntry] = useState<EventEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeStep, setActiveStep] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [aiProcessing, setAiProcessing] = useState<Record<string, boolean>>({})
  const [runningAll, setRunningAll] = useState(false)
  const [fetchingDesc, setFetchingDesc] = useState(false)
  const [deletingEntry, setDeletingEntry] = useState(false)

  useEffect(() => {
    loadEntry()
  }, [params.id])

  async function loadEntry() {
    const { data } = await supabase
      .from('content_entries')
      .select('*')
      .eq('id', params.id)
      .single()
    if (data) setEntry(data as EventEntry)
    setLoading(false)
  }

  async function saveField(field: string, value: string) {
    setSaving(true)
    const { error } = await supabase
      .from('content_entries')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('id', params.id)
    if (!error) {
      setEntry(prev => prev ? { ...prev, [field]: value } : null)
      setEditMode(false)
    }
    setSaving(false)
  }

  async function updateStatus(status: string) {
    await supabase
      .from('content_entries')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', params.id)
    setEntry(prev => prev ? { ...prev, status: status as EventEntry['status'] } : null)
  }

  async function getAuthToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || null
  }

  async function runAIStep(stepField: string) {
    const authToken = await getAuthToken()
    if (!authToken) return

    setAiProcessing(prev => ({ ...prev, [stepField]: true }))

    try {
      const res = await fetch('/api/ai/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryId: params.id,
          stepField,
          authToken,
        }),
      })

      const data = await res.json()
      if (res.ok && data.result) {
        setEntry(prev => prev ? { ...prev, [stepField]: data.result, status: 'in_progress' } : null)
        if (activeStep) {
          setEditValue(data.result)
          setEditMode(false) // Show formatted result
        }
      } else {
        alert(`AI Error: ${data.error}`)
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`)
    } finally {
      setAiProcessing(prev => ({ ...prev, [stepField]: false }))
    }
  }

  async function runAllAISteps() {
    const authToken = await getAuthToken()
    if (!authToken) return

    setRunningAll(true)

    for (const stepField of AI_STEPS) {
      if (!entry?.original_description) continue

      setAiProcessing(prev => ({ ...prev, [stepField]: true }))

      try {
        const res = await fetch('/api/ai/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entryId: params.id, stepField, authToken }),
        })

        const data = await res.json()
        if (res.ok && data.result) {
          setEntry(prev => prev ? { ...prev, [stepField]: data.result } : null)
        }
      } catch {
        // Continue to next step
      } finally {
        setAiProcessing(prev => ({ ...prev, [stepField]: false }))
      }
    }

    await loadEntry()
    setRunningAll(false)
  }

  async function deleteEntry() {
    if (!confirm('Are you sure you want to remove this attraction?')) return
    setDeletingEntry(true)
    const { error } = await supabase.from('content_entries').delete().eq('id', params.id)
    if (!error) {
      router.push('/dashboard/attractions')
    } else {
      alert('Failed to delete: ' + error.message)
      setDeletingEntry(false)
    }
  }

  async function fetchDescriptionFromURL() {
    if (!entry?.event_url) return
    setFetchingDesc(true)
    try {
      const res = await fetch('/api/fetch-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: entry.event_url }),
      })
      const data = await res.json()
      if (res.ok && data.description) {
        await saveField('original_description', data.description)
        if (activeStep === 'S1') {
          setEditValue(data.description)
        }
      } else if (data.queue_detected) {
        setActiveStep('S1')
        setEditMode(true)
        setEditValue('')
        alert('The page is behind queue protection (Cloudflare). Please open the URL in your browser, copy the description text, and paste it into Step S1 below.')
      } else {
        alert(data.error || 'Could not fetch description from URL')
      }
    } catch (err: any) {
      alert('Network error: ' + err.message)
    } finally {
      setFetchingDesc(false)
    }
  }

  async function exportToExcel() {
    if (!entry) return
    const XLSX = await import('xlsx')

    const headers = [
      'Attraction ID', 'Attraction Name', 'URL', 'Page QA', 'Categories',
      'Tags', 'Keywords List', 'Original Description',
      'Keyword-Optimized Versions', 'Fact Check', 'Duplicate Analysis',
      'TOV Score', 'Grammar & Style', 'Reviewer', 'Resolver',
      'SEO Keyword Analysis', 'Fact Check (Final)', 'Optimized Description',
      'Ranked Versions', 'Status'
    ]

    const row = [
      entry.event_id, entry.event_title, entry.event_url,
      entry.page_qa_comments, entry.categories, entry.tags,
      entry.keywords_list || '', entry.original_description,
      entry.recommended_versions, entry.fact_check_scores,
      entry.duplicate_analysis, entry.tov_score,
      entry.grammar_style, entry.reviewer_output, entry.resolver_output,
      entry.seo_analysis, entry.fact_check_final,
      entry.optimized_description || '', entry.ranked_versions, entry.status,
    ]

    const ws = XLSX.utils.aoa_to_sheet([headers, row])
    ws['!cols'] = headers.map(() => ({ wch: 30 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Attraction Pipeline')
    XLSX.writeFile(wb, `rockstary-attraction-${entry.event_id}.xlsx`)
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
    </div>
  )

  if (!entry) return (
    <div className="p-8 text-center">
      <p className="text-pl-muted">Entry not found</p>
      <button onClick={() => router.push('/dashboard/attractions')} className="pl-btn-secondary mt-4">
        Back to Attractions
      </button>
    </div>
  )

  const getFieldValue = (field: string): string => {
    return (entry as any)[field] || ''
  }

  const getStepStatus = (field: string): 'pending' | 'done' => {
    const value = getFieldValue(field)
    return value && value.trim() !== '' ? 'done' : 'pending'
  }

  const completedCount = ATTRACTIONS_STEPS_CONFIG.filter(s => getStepStatus(s.field) === 'done').length
  const totalSteps = ATTRACTIONS_STEPS_CONFIG.length
  const canRunAI = (field: string) => AI_STEPS.includes(field)

  const hasKeywords = !!(entry.keywords_list && entry.keywords_list.trim())
  const hasDescription = !!(entry.original_description && entry.original_description.trim())

  return (
    <div className="p-8 max-w-5xl">
      {/* Back button & Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.push('/dashboard/attractions')} className="p-2 rounded-lg hover:bg-pl-card transition-colors text-pl-muted hover:text-white">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="bg-emerald-500/10 text-emerald-400 font-mono font-bold px-3 py-1 rounded-lg text-sm">
              #{entry.event_id}
            </span>
            <h1 className="text-xl font-bold text-white">{entry.event_title}</h1>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full uppercase tracking-wider">Attraction</span>
          </div>
          <p className="text-sm text-pl-muted mt-1">{entry.event_url}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={runAllAISteps}
            disabled={runningAll || !hasDescription}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            title={!hasDescription ? 'Add original description first' : 'Run all AI steps (keywords + optimization pipeline)'}
          >
            {runningAll ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Running AI...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Run All AI
              </>
            )}
          </button>
          <select
            value={entry.status}
            onChange={(e) => updateStatus(e.target.value)}
            className="pl-input text-sm w-auto"
          >
            <option value="draft">Draft</option>
            <option value="in_progress">In Progress</option>
            <option value="review">Review</option>
            <option value="completed">Completed</option>
          </select>
          <button onClick={exportToExcel} className="pl-btn-secondary flex items-center gap-2 text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export XLSX
          </button>
          <button
            onClick={deleteEntry}
            disabled={deletingEntry}
            className="p-2 rounded-lg text-pl-muted hover:text-red-400 hover:bg-red-600/10 transition-all"
            title="Remove attraction"
          >
            {deletingEntry ? (
              <div className="w-5 h-5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Fetch Description Banner */}
      {!hasDescription && entry.event_url && (
        <div className="pl-card p-4 mb-4 border-amber-500/30 bg-amber-500/5 flex items-center gap-4">
          <svg className="w-5 h-5 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-amber-200 flex-1">Original description is needed before AI can process. Fetch it from the URL or enter it manually in Step S1.</p>
          <button
            onClick={fetchDescriptionFromURL}
            disabled={fetchingDesc}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium disabled:opacity-40 transition-all flex-shrink-0"
          >
            {fetchingDesc ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Fetching...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Fetch from URL
              </>
            )}
          </button>
        </div>
      )}

      {/* Keywords Needed Banner */}
      {hasDescription && !hasKeywords && (
        <div className="pl-card p-4 mb-4 border-emerald-500/30 bg-emerald-500/5 flex items-center gap-4">
          <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <p className="text-sm text-emerald-200 flex-1">Generate keywords next! The keyword list drives the optimization of all subsequent steps.</p>
          <button
            onClick={() => runAIStep('keywords_list')}
            disabled={aiProcessing['keywords_list']}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium disabled:opacity-40 transition-all flex-shrink-0"
          >
            {aiProcessing['keywords_list'] ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generate Keywords
              </>
            )}
          </button>
        </div>
      )}

      {/* Progress Bar */}
      <div className="pl-card p-4 mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-pl-text-dim">Attraction Pipeline Progress</span>
          <span className="text-sm font-medium text-emerald-400">{completedCount}/{totalSteps} steps</span>
        </div>
        <div className="w-full h-3 bg-pl-dark rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-400 rounded-full transition-all duration-500"
            style={{ width: `${(completedCount / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {ATTRACTIONS_STEPS_CONFIG.map((step, idx) => {
          const status = getStepStatus(step.field)
          const isActive = activeStep === step.step
          const value = getFieldValue(step.field)
          const isAIStep = canRunAI(step.field)
          const isProcessing = aiProcessing[step.field]
          const isKeywordsStep = step.field === 'keywords_list'
          const isOptimizedStep = step.field === 'optimized_description'

          return (
            <div key={step.step} className={`pl-card overflow-hidden transition-all ${isActive ? 'border-emerald-500/40 shadow-lg shadow-emerald-500/5' : ''} ${isProcessing ? 'border-emerald-500/40 shadow-lg shadow-emerald-500/5' : ''} ${isKeywordsStep ? 'ring-1 ring-emerald-500/20' : ''}`}>
              {/* Step Header */}
              <div className="flex items-center">
                <button
                  onClick={() => {
                    if (isActive) {
                      setActiveStep(null)
                      setEditMode(false)
                    } else {
                      setActiveStep(step.step)
                      setEditValue(value)
                      setEditMode(!value) // Auto-enter edit mode if empty
                    }
                  }}
                  className="flex-1 flex items-center gap-4 p-4 text-left hover:bg-pl-card/50 transition-colors"
                >
                  {/* Step number */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    isProcessing
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : status === 'done'
                        ? 'bg-pl-success/20 text-pl-success'
                        : 'bg-pl-muted/20 text-pl-muted'
                  }`}>
                    {isProcessing ? (
                      <div className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                    ) : status === 'done' ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : idx + 1}
                  </div>

                  {/* Step info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-emerald-500/60">Step {step.step}</span>
                      {step.column !== '-' && <span className="text-xs text-pl-muted">Col {step.column}</span>}
                      {step.optional && <span className="text-[10px] bg-pl-muted/20 text-pl-muted px-2 py-0.5 rounded-full">Optional</span>}
                      {isAIStep && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">AI</span>}
                      {isKeywordsStep && <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">SEO Keywords</span>}
                      {isOptimizedStep && <span className="text-[10px] bg-teal-500/20 text-teal-400 px-2 py-0.5 rounded-full">Final Output</span>}
                    </div>
                    <p className="font-medium text-white text-sm mt-0.5">{step.label}</p>
                    {/* Content preview when collapsed */}
                    {!isActive && <ContentPreview text={value} />}
                  </div>

                  {/* Status + char count */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {value && !isActive && (
                      <span className="text-[10px] text-pl-muted font-mono">{value.length.toLocaleString()}c</span>
                    )}
                    <span className={`px-2 py-1 rounded text-xs ${
                      isProcessing ? 'bg-emerald-500/20 text-emerald-400' :
                      status === 'done' ? 'badge-done' : 'badge-pending'
                    }`}>
                      {isProcessing ? 'Processing...' : status === 'done' ? 'Done' : 'Pending'}
                    </span>
                  </div>

                  {/* Expand icon */}
                  <svg className={`w-5 h-5 text-pl-muted transition-transform flex-shrink-0 ${isActive ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* AI Run Button */}
                {isAIStep && !isActive && (
                  <button
                    onClick={(e) => { e.stopPropagation(); runAIStep(step.field) }}
                    disabled={isProcessing || runningAll}
                    className="mr-4 p-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 hover:text-emerald-300 transition-all disabled:opacity-30"
                    title={`Run AI for ${step.label}`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Expanded Content */}
              {isActive && (
                <div className="border-t border-pl-border">
                  {/* Toolbar */}
                  <div className="flex items-center gap-2 px-4 py-2 bg-pl-dark/40 border-b border-pl-border/50">
                    <button
                      onClick={() => { setEditMode(false) }}
                      className={`text-xs px-3 py-1 rounded-md transition-all ${!editMode ? 'bg-emerald-500/20 text-emerald-400 font-medium' : 'text-pl-muted hover:text-white'}`}
                    >
                      View
                    </button>
                    <button
                      onClick={() => { setEditMode(true); setEditValue(value) }}
                      className={`text-xs px-3 py-1 rounded-md transition-all ${editMode ? 'bg-emerald-500/20 text-emerald-400 font-medium' : 'text-pl-muted hover:text-white'}`}
                    >
                      Edit
                    </button>
                    <div className="flex-1" />
                    {value && (
                      <span className="text-[10px] text-pl-muted font-mono">
                        {value.length.toLocaleString()} chars Â· {value.split('\n').length} lines
                      </span>
                    )}
                    {isAIStep && (
                      <button
                        onClick={() => runAIStep(step.field)}
                        disabled={isProcessing || runningAll}
                        className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium disabled:opacity-40 transition-all"
                      >
                        {isProcessing ? (
                          <>
                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Running...
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Run AI
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Content Area */}
                  <div className="p-4 bg-pl-dark/20">
                    {editMode ? (
                      <>
                        <textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          placeholder={isKeywordsStep
                            ? 'Enter keywords (comma-separated) or click "Run AI" to auto-generate from the description...'
                            : `Enter ${step.label} content...`
                          }
                          className="pl-input min-h-[200px] resize-y font-mono text-sm"
                        />
                        <div className="flex items-center gap-3 mt-3">
                          <button
                            onClick={() => saveField(step.field, editValue)}
                            disabled={saving}
                            className="pl-btn-primary text-sm flex items-center gap-2"
                          >
                            {saving ? (
                              <div className="w-4 h-4 border-2 border-pl-dark/30 border-t-pl-dark rounded-full animate-spin" />
                            ) : (
                              <>
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Save
                              </>
                            )}
                          </button>
                          <button onClick={() => { setEditMode(false) }} className="pl-btn-secondary text-sm">
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        <FormattedContent text={value} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

