'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { STEPS_CONFIG, type EventEntry } from '@/types'

// AI-processable step fields (Steps A, B, S2-S13)
const AI_STEPS = [
  'page_qa_comments', 'categories',
  'recommended_versions', 'fact_check_scores', 'duplicate_analysis',
  'ab_tests', 'organiser_trigger_risk', 'tov_score', 'grammar_style',
  'reviewer_output', 'resolver_output', 'seo_analysis', 'fact_check_final',
  'ranked_versions',
]

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

    // Headers: ### or ## or #
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h4 key={i} className="text-sm font-semibold text-pl-gold mt-3 mb-1">
          {trimmed.slice(4)}
        </h4>
      )
      return
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h3 key={i} className="text-sm font-bold text-pl-gold mt-4 mb-1.5">
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

    // Bullet points â match -, â¢, *, â, âº, â¸, â¦, â, â, â, â¬¥, â¬ and any non-alphanumeric single-char prefix followed by space
    const bulletMatch = trimmed.match(/^(?:[-â¢*ââºâ¸â¦ââââ¬¥â¬â§â¶â¦¿ââ£â¡â]|\p{So}|\p{Sk})\s+(.*)/u)
    if (bulletMatch) {
      elements.push(
        <div key={i} className="flex gap-2 ml-2 my-0.5">
          <span className="text-pl-gold/60 mt-0.5 flex-shrink-0">â¢</span>
          <span className="text-sm text-pl-text-dim leading-relaxed">{renderInline(bulletMatch[1])}</span>
        </div>
      )
      return
    }

    // Numbered list
    const numMatch = trimmed.match(/^(\d+)[.)]\s+(.*)/)
    if (numMatch) {
      elements.push(
        <div key={i} className="flex gap-2 ml-2 my-0.5">
          <span className="text-pl-gold/60 font-mono text-xs mt-0.5 flex-shrink-0 w-5 text-right">{numMatch[1]}.</span>
          <span className="text-sm text-pl-text-dim leading-relaxed">{renderInline(numMatch[2])}</span>
        </div>
      )
      return
    }

    // Score lines (e.g., "Score: 8/10" or "Rating: High")
    const scoreMatch = trimmed.match(/^(Score|Rating|Grade|Risk|Result|Verdict|Overall|Total|Final)[:\s]+(.+)/i)
    if (scoreMatch) {
      elements.push(
        <div key={i} className="flex items-center gap-2 my-1.5 px-3 py-1.5 rounded-lg bg-pl-navy/60 border border-pl-border/50">
          <span className="text-xs font-semibold text-pl-text-dim uppercase tracking-wider">{scoreMatch[1]}</span>
          <span className="text-sm font-bold text-pl-gold">{scoreMatch[2]}</span>
        </div>
      )
      return
    }

    // Version labels (e.g., "Version A:" or "Option 1:")
    const versionMatch = trimmed.match(/^(Version\s+[A-Z0-9]+|Option\s+\d+|Variant\s+\d+)[:\s]+(.*)$/i)
    if (versionMatch) {
      elements.push(
        <div key={i} className="mt-3 mb-1">
          <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded mb-1">
            {versionMatch[1]}
          </span>
          {versionMatch[2] && (
            <p className="text-sm text-pl-text-dim leading-relaxed ml-1">{renderInline(versionMatch[2])}</p>
          )}
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
    // Bold
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/)
    // Inline code
    const codeMatch = remaining.match(/`(.+?)`/)
    // Italic
    const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/)

    // Find the earliest match
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
      parts.push(<code key={key++} className="text-xs bg-pl-dark px-1.5 py-0.5 rounded font-mono text-pl-gold/80">{match[1]}</code>)
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

export default function EventDetailPage() {
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

    // Steps A & B can run without original_description (they use screenshots/URL)
    // S2+ requires original_description
    const optionalSteps = ['page_qa_comments', 'categories']
    for (const stepField of AI_STEPS) {
      if (!optionalSteps.includes(stepField) && !entry?.original_description) continue

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
    if (!confirm('Are you sure you want to remove this event?')) return
    setDeletingEntry(true)
    const { error } = await supabase.from('content_entries').delete().eq('id', params.id)
    if (!error) {
      router.push('/dashboard/events')
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
        alert('The event page is behind queue protection (Cloudflare). Please open the event URL in your browser, copy the description text, and paste it into Step S1 below.')
      } else {
        alert(data.error || 'Could not fetch description from URL')
      }
    } catch (err: any) {
      alert('Network error: ' + err.message)
    } finally {
      setFetchingDesc(false)
    }
  }

  function getExportData() {
    if (!entry) return null
    // 33 columns (A-AG) matching EXCEL_COLUMN_MAP exactly
    const headers = [
      'Event ID', 'Event Title', 'Event URL', 'Page QA (Step A)',
      'Categories (Step B)', 'Tags', '', '',
      'Original Description (S1)', '', 'Recommended Versions (S2)', '', '',
      'Fact Check Scores (S3)', '', 'Duplicate Analysis (S4)', '',
      'A/B Tests (S5)', '', 'Organiser Trigger Risk (S6)', '',
      'TOV Score (S7)', '', 'Grammar & Style (S8)', '',
      'Reviewer (S9)', '', 'Resolver (S10)', '',
      'Prev Original Description', 'SEO Analysis (S11)',
      'Fact Check Final (S12)', 'Ranked Top Versions (S13)',
    ]
    const row = [
      entry.event_id, entry.event_title, entry.event_url,
      entry.page_qa_comments, entry.categories, entry.tags, '', '',
      entry.original_description, '', entry.recommended_versions, '', '',
      entry.fact_check_scores, '', entry.duplicate_analysis, '',
      entry.ab_tests, '', entry.organiser_trigger_risk, '',
      entry.tov_score, '', entry.grammar_style, '',
      entry.reviewer_output, '', entry.resolver_output, '',
      entry.prev_original_description, entry.seo_analysis,
      entry.fact_check_final, entry.ranked_versions,
    ]
    return { headers, row }
  }

  function exportToCSV() {
    const data = getExportData()
    if (!data) return
    const escapeCSV = (val: string) => {
      if (!val) return ''
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`
      }
      return val
    }
    const csv = [data.headers.map(escapeCSV).join(','), data.row.map(escapeCSV).join(',')].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rockstary-event-${entry?.event_id}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function openInGoogleSheets() {
    const data = getExportData()
    if (!data) return
    // Build TSV (Google Sheets natively parses pasted TSV into cells)
    const escapeTSV = (val: string) => {
      if (!val) return ''
      // Replace tabs and newlines so they don't break cell boundaries
      return val.replace(/\t/g, ' ').replace(/\n/g, ' | ')
    }
    const tsv = [data.headers.map(escapeTSV).join('\t'), data.row.map(escapeTSV).join('\t')].join('\n')
    // Copy TSV to clipboard
    try {
      await navigator.clipboard.writeText(tsv)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = tsv
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    // Open a new Google Sheet
    window.open('https://sheets.new', '_blank')
    // Show a brief toast-like alert
    const toast = document.createElement('div')
    toast.textContent = 'Data copied! Paste (Ctrl+V) into the new sheet.'
    toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#c8a832;color:#1a1a2e;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;z-index:9999;transition:opacity 0.5s;'
    document.body.appendChild(toast)
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => document.body.removeChild(toast), 500) }, 3500)
  }

  async function exportToExcel() {
    const data = getExportData()
    if (!data || !entry) return

    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet([data.headers, data.row])
    ws['!cols'] = data.headers.map(() => ({ wch: 30 }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Event Pipeline')
    XLSX.writeFile(wb, `rockstary-event-${entry.event_id}.xlsx`)
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-10 h-10 border-4 border-pl-gold/30 border-t-pl-gold rounded-full animate-spin" />
    </div>
  )

  if (!entry) return (
    <div className="p-8 text-center">
      <p className="text-pl-muted">Entry not found</p>
      <button onClick={() => router.push('/dashboard/events')} className="pl-btn-secondary mt-4">
        Back to Events
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

  const completedCount = STEPS_CONFIG.filter(s => getStepStatus(s.field) === 'done').length
  const totalSteps = STEPS_CONFIG.length
  const canRunAI = (field: string) => AI_STEPS.includes(field)
  const anyStepProcessing = Object.values(aiProcessing).some(v => v)

  return (
    <div className="p-8 max-w-5xl">
      {/* Back button & Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.push('/dashboard/events')} className="p-2 rounded-lg hover:bg-pl-card transition-colors text-pl-muted hover:text-white">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="bg-pl-gold/10 text-pl-gold font-mono font-bold px-3 py-1 rounded-lg text-sm">
              #{entry.event_id}
            </span>
            <h1 className="text-xl font-bold text-white">{entry.event_title}</h1>
          </div>
          <p className="text-sm text-pl-muted mt-1">{entry.event_url}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Run All AI Button */}
          <button
            onClick={runAllAISteps}
            disabled={runningAll || !entry.original_description}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            title={!entry.original_description ? 'Add original description first' : 'Run all AI steps sequentially'}
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
          {/* Export dropdown group */}
          <div className="flex items-center rounded-lg border border-pl-border overflow-hidden">
            <button onClick={exportToExcel} className="flex items-center gap-1.5 text-xs px-3 py-2 bg-pl-card hover:bg-pl-border/30 text-pl-text-dim transition-colors" title="Download as Excel">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              XLSX
            </button>
            <div className="w-px h-6 bg-pl-border" />
            <button onClick={exportToCSV} className="flex items-center gap-1.5 text-xs px-3 py-2 bg-pl-card hover:bg-pl-border/30 text-pl-text-dim transition-colors" title="Download as CSV">
              CSV
            </button>
            <div className="w-px h-6 bg-pl-border" />
            <button onClick={openInGoogleSheets} className="flex items-center gap-1.5 text-xs px-3 py-2 bg-pl-card hover:bg-pl-border/30 text-pl-text-dim transition-colors" title="Copy data to clipboard and open a new Google Sheet — just paste">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.5 3h-15A1.5 1.5 0 003 4.5v15A1.5 1.5 0 004.5 21h15a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0019.5 3zM9 17H6v-3h3v3zm0-5H6V9h3v3zm5 5h-4v-3h4v3zm0-5h-4V9h4v3zm4 5h-3v-3h3v3zm0-5h-3V9h3v3z"/>
              </svg>
              Sheets
            </button>
          </div>
          <button
            onClick={deleteEntry}
            disabled={deletingEntry}
            className="p-2 rounded-lg text-pl-muted hover:text-red-400 hover:bg-red-600/10 transition-all"
            title="Remove event"
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
      {!entry.original_description && entry.event_url && (
        <div className="pl-card p-4 mb-4 border-amber-500/30 bg-amber-500/5 flex items-center gap-4">
          <svg className="w-5 h-5 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-amber-200 flex-1">Original description is needed before AI can process. Fetch it from the event URL or enter it manually in Step S1.</p>
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

      {/* Progress Bar */}
      <div className="pl-card p-4 mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-pl-text-dim">Pipeline Progress</span>
          <span className="text-sm font-medium text-pl-gold">{completedCount}/{totalSteps} steps</span>
        </div>
        <div className="w-full h-3 bg-pl-dark rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-pl-gold-dark via-pl-gold to-pl-gold-light rounded-full transition-all duration-500"
            style={{ width: `${(completedCount / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {STEPS_CONFIG.map((step, idx) => {
          const status = getStepStatus(step.field)
          const isActive = activeStep === step.step
          const value = getFieldValue(step.field)
          const isAIStep = canRunAI(step.field)
          const isProcessing = aiProcessing[step.field]

          return (
            <div key={step.step} className={`pl-card overflow-hidden transition-all ${isActive ? 'border-pl-gold/40 shadow-lg shadow-pl-gold/5' : ''} ${isProcessing ? 'border-purple-500/40 shadow-lg shadow-purple-500/5' : ''}`}>
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
                      ? 'bg-purple-500/20 text-purple-400'
                      : status === 'done'
                        ? 'bg-pl-success/20 text-pl-success'
                        : 'bg-pl-muted/20 text-pl-muted'
                  }`}>
                    {isProcessing ? (
                      <div className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                    ) : status === 'done' ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : idx + 1}
                  </div>

                  {/* Step info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-pl-gold/60">Step {step.step}</span>
                      <span className="text-xs text-pl-muted">Col {step.column}</span>
                      {step.optional && <span className="text-[10px] bg-pl-muted/20 text-pl-muted px-2 py-0.5 rounded-full">Optional</span>}
                      {isAIStep && <span className="text-[10px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">AI</span>}
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
                      isProcessing ? 'bg-purple-500/20 text-purple-400' :
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

                {/* AI Run Button (outside the expand button) */}
                {isAIStep && !isActive && (
                  <button
                    onClick={(e) => { e.stopPropagation(); runAIStep(step.field) }}
                    disabled={isProcessing || runningAll || anyStepProcessing}
                    className="mr-4 p-2 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 hover:text-purple-300 transition-all disabled:opacity-30"
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
                      className={`text-xs px-3 py-1 rounded-md transition-all ${!editMode ? 'bg-pl-gold/20 text-pl-gold font-medium' : 'text-pl-muted hover:text-white'}`}
                    >
                      View
                    </button>
                    <button
                      onClick={() => { setEditMode(true); setEditValue(value) }}
                      className={`text-xs px-3 py-1 rounded-md transition-all ${editMode ? 'bg-pl-gold/20 text-pl-gold font-medium' : 'text-pl-muted hover:text-white'}`}
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
                        disabled={isProcessing || runningAll || anyStepProcessing}
                        className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-md bg-purple-600 hover:bg-purple-500 text-white font-medium disabled:opacity-40 transition-all"
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
                          placeholder={`Enter ${step.label} content...`}
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

