'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { STEPS_CONFIG, type EventEntry } from '@/types'

// AI-processable step fields (Steps S2-S13)
const AI_STEPS = [
  'recommended_versions', 'fact_check_scores', 'duplicate_analysis',
  'ab_tests', 'organiser_trigger_risk', 'tov_score', 'grammar_style',
  'reviewer_output', 'resolver_output', 'seo_analysis', 'fact_check_final',
  'ranked_versions',
]

export default function AttractionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [entry, setEntry] = useState<EventEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeStep, setActiveStep] = useState<string | null>(null)
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
      setActiveStep(null)
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

    // Run steps sequentially
    for (const stepField of AI_STEPS) {
      // Skip if original_description is empty (can't process without it)
      if (!entry?.original_description && stepField !== 'recommended_versions') continue
      if (stepField === 'recommended_versions' && !entry?.original_description) continue

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

    // Reload to get fresh data
    await loadEntry()
    setRunningAll(false)
  }

  async function deleteEntry() {
    if (!confirm('Are you sure you want to remove this event?')) return
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

    // Dynamic import to avoid SSR issues
    const XLSX = await import('xlsx')

    const headers = [
      'Event ID', 'Event Title', 'Event URL', 'Page QA (Step A)', 'Categories (Step B)',
      'Tags (Step B)', '', 'Original Description (H)', '',
      'Recommended Versions (J)', '', 'Fact Check Scores (Step 3)',
      'Duplicate Analysis (Step 4)', 'A/B Tests (Step 5)',
      'Organiser Trigger Risk (Step 6)', 'TOV Score (Step 7)',
      'Grammar & Style (Step 8)', '', '', '', '', '',
      'Reviewer (W - Step 9)', '', 'Resolver (Y - Step 10)', '',
      '', '', 'Prev Original (AC)', '', 'SEO Analysis (AA - Step 11)',
      '', 'Fact Check Final (Step 12)', '', '', '', '',
      'Ranked Top Versions (AG - Step 13)'
    ]

    const row = [
      entry.event_id, entry.event_title, entry.event_url,
      entry.page_qa_comments, entry.categories, entry.tags,
      '', entry.original_description, '',
      entry.recommended_versions, '', entry.fact_check_scores,
      entry.duplicate_analysis, entry.ab_tests,
      entry.organiser_trigger_risk, entry.tov_score,
      entry.grammar_style, '', '', '', '', '',
      entry.reviewer_output, '', entry.resolver_output, '',
      '', '', entry.prev_original_description, '', entry.seo_analysis,
      '', entry.fact_check_final, '', '', '', '',
      entry.ranked_versions,
    ]

    const ws = XLSX.utils.aoa_to_sheet([headers, row])
    ws['!cols'] = headers.map(() => ({ wch: 30 }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Attraction Pipeline')
    XLSX.writeFile(wb, `rockstary-attraction-${entry.event_id}.xlsx`)
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-10 h-10 border-4 border-pl-gold/30 border-t-pl-gold rounded-full animate-spin" />
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

  const completedCount = STEPS_CONFIG.filter(s => getStepStatus(s.field) === 'done').length
  const totalSteps = STEPS_CONFIG.length
  const canRunAI = (field: string) => AI_STEPS.includes(field)

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

      {/* Fetch Description Banner - shows when original_description is empty */}
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
            <div key={step.step} className={`pl-card overflow-hidden ${isActive ? 'border-pl-gold/40' : ''} ${isProcessing ? 'border-purple-500/40' : ''}`}>
              {/* Step Header */}
              <div className="flex items-center">
                <button
                  onClick={() => {
                    if (isActive) {
                      setActiveStep(null)
                    } else {
                      setActiveStep(step.step)
                      setEditValue(value)
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
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-pl-gold/60">Step {step.step}</span>
                      <span className="text-xs text-pl-muted">Col {step.column}</span>
                      {step.optional && <span className="text-[10px] bg-pl-muted/20 text-pl-muted px-2 py-0.5 rounded-full">Optional</span>}
                      {isAIStep && <span className="text-[10px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">AI</span>}
                    </div>
                    <p className="font-medium text-white text-sm mt-0.5">{step.label}</p>
                  </div>

                  {/* Status */}
                  <span className={`px-2 py-1 rounded text-xs ${
                    isProcessing ? 'bg-purple-500/20 text-purple-400' :
                    status === 'done' ? 'badge-done' : 'badge-pending'
                  }`}>
                    {isProcessing ? 'Processing...' : status === 'done' ? 'Done' : 'Pending'}
                  </span>

                  {/* Expand icon */}
                  <svg className={`w-5 h-5 text-pl-muted transition-transform ${isActive ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* AI Run Button (outside the expand button) */}
                {isAIStep && !isActive && (
                  <button
                    onClick={(e) => { e.stopPropagation(); runAIStep(step.field) }}
                    disabled={isProcessing || runningAll}
                    className="mr-4 p-2 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 hover:text-purple-300 transition-all disabled:opacity-30"
                    title={`Run AI for ${step.label}`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Expanded Editor */}
              {isActive && (
                <div className="border-t border-pl-border p-4 bg-pl-dark/30">
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
                      ) : 'Save'}
                    </button>
                    {isAIStep && (
                      <button
                        onClick={() => runAIStep(step.field)}
                        disabled={isProcessing || runningAll}
                        className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium disabled:opacity-40 transition-all"
                      >
                        {isProcessing ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Running...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Run AI
                          </>
                        )}
                      </button>
                    )}
                    <button onClick={() => setActiveStep(null)} className="pl-btn-secondary text-sm">
                      Cancel
                    </button>
                    {value && (
                      <span className="text-xs text-pl-muted ml-auto">
                        {value.length} characters
                      </span>
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
