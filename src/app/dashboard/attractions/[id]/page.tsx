'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { STEPS_CONFIG, type EventEntry } from '@/types'

export default function AttractionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [entry, setEntry] = useState<EventEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeStep, setActiveStep] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  useEffect(() => { loadEntry() }, [params.id])

  async function loadEntry() {
    const { data } = await supabase.from('content_entries').select('*').eq('id', params.id).single()
    if (data) setEntry(data as EventEntry)
    setLoading(false)
  }

  async function saveField(field: string, value: string) {
    setSaving(true)
    const { error } = await supabase.from('content_entries').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', params.id)
    if (!error) { setEntry(prev => prev ? { ...prev, [field]: value } : null); setActiveStep(null) }
    setSaving(false)
  }

  async function updateStatus(status: string) {
    await supabase.from('content_entries').update({ status, updated_at: new Date().toISOString() }).eq('id', params.id)
    setEntry(prev => prev ? { ...prev, status: status as EventEntry['status'] } : null)
  }

  async function exportToExcel() {
    if (!entry) return
    const XLSX = await import('xlsx')
    const headers = ['ID', 'Name', 'URL', 'Page QA', 'Categories', 'Tags', '', 'Original Description', '', 'Recommended Versions', '', 'Fact Check', 'Duplicate', 'A/B Tests', 'Trigger Risk', 'TOV', 'Grammar', '', '', '', '', '', 'Reviewer', '', 'Resolver', '', '', '', 'Prev Original', '', 'SEO', '', 'Fact Check Final', '', '', '', '', 'Ranked']
    const row = [entry.event_id, entry.event_title, entry.event_url, entry.page_qa_comments, entry.categories, entry.tags, '', entry.original_description, '', entry.recommended_versions, '', entry.fact_check_scores, entry.duplicate_analysis, entry.ab_tests, entry.organiser_trigger_risk, entry.tov_score, entry.grammar_style, '', '', '', '', '', entry.reviewer_output, '', entry.resolver_output, '', '', '', entry.prev_original_description, '', entry.seo_analysis, '', entry.fact_check_final, '', '', '', '', entry.ranked_versions]
    const ws = XLSX.utils.aoa_to_sheet([headers, row])
    ws['!cols'] = headers.map(() => ({ wch: 30 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Attraction Pipeline')
    XLSX.writeFile(wb, `rockstary-attraction-${entry.event_id}.xlsx`)
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="w-10 h-10 border-4 border-pl-gold/30 border-t-pl-gold rounded-full animate-spin" /></div>
  if (!entry) return <div className="p-8 text-center"><p className="text-pl-muted">Not found</p><button onClick={() => router.push('/dashboard/attractions')} className="pl-btn-secondary mt-4">Back</button></div>

  const getFieldValue = (field: string): string => (entry as any)[field] || ''
  const getStepStatus = (field: string) => getFieldValue(field).trim() !== '' ? 'done' as const : 'pending' as const
  const completedCount = STEPS_CONFIG.filter(s => getStepStatus(s.field) === 'done').length

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.push('/dashboard/attractions')} className="p-2 rounded-lg hover:bg-pl-card transition-colors text-pl-muted hover:text-white">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="bg-pl-accent/10 text-pl-accent-light font-mono font-bold px-3 py-1 rounded-lg text-sm">#{entry.event_id}</span>
            <h1 className="text-xl font-bold text-white">{entry.event_title}</h1>
          </div>
          <p className="text-sm text-pl-muted mt-1">{entry.event_url}</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={entry.status} onChange={(e) => updateStatus(e.target.value)} className="pl-input text-sm w-auto">
            <option value="draft">Draft</option>
            <option value="in_progress">In Progress</option>
            <option value="review">Review</option>
            <option value="completed">Completed</option>
          </select>
          <button onClick={exportToExcel} className="pl-btn-secondary flex items-center gap-2 text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Export XLSX
          </button>
        </div>
      </div>

      <div className="pl-card p-4 mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-pl-text-dim">Pipeline Progress</span>
          <span className="text-sm font-medium text-pl-accent-light">{completedCount}/{STEPS_CONFIG.length} steps</span>
        </div>
        <div className="w-full h-3 bg-pl-dark rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-pl-accent to-pl-accent-light rounded-full transition-all duration-500" style={{ width: `${(completedCount / STEPS_CONFIG.length) * 100}%` }} />
        </div>
      </div>

      <div className="space-y-3">
        {STEPS_CONFIG.map((step, idx) => {
          const status = getStepStatus(step.field)
          const isActive = activeStep === step.step
          const value = getFieldValue(step.field)
          return (
            <div key={step.step} className={`pl-card overflow-hidden ${isActive ? 'border-pl-accent/40' : ''}`}>
              <button onClick={() => { if (isActive) { setActiveStep(null) } else { setActiveStep(step.step); setEditValue(value) } }} className="w-full flex items-center gap-4 p-4 text-left hover:bg-pl-card/50 transition-colors">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${status === 'done' ? 'bg-pl-success/20 text-pl-success' : 'bg-pl-muted/20 text-pl-muted'}`}>
                  {status === 'done' ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> : idx + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-pl-accent/60">Step {step.step}</span>
                    <span className="text-xs text-pl-muted">Col {step.column}</span>
                    {step.optional && <span className="text-[10px] bg-pl-muted/20 text-pl-muted px-2 py-0.5 rounded-full">Optional</span>}
                  </div>
                  <p className="font-medium text-white text-sm mt-0.5">{step.label}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${status === 'done' ? 'badge-done' : 'badge-pending'}`}>{status === 'done' ? 'Done' : 'Pending'}</span>
                <svg className={`w-5 h-5 text-pl-muted transition-transform ${isActive ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {isActive && (
                <div className="border-t border-pl-border p-4 bg-pl-dark/30">
                  <textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} placeholder={`Enter ${step.label} content...`} className="pl-input min-h-[200px] resize-y font-mono text-sm" />
                  <div className="flex items-center gap-3 mt-3">
                    <button onClick={() => saveField(step.field, editValue)} disabled={saving} className="pl-btn-primary text-sm flex items-center gap-2">{saving ? <div className="w-4 h-4 border-2 border-pl-dark/30 border-t-pl-dark rounded-full animate-spin" /> : 'Save'}</button>
                    <button onClick={() => setActiveStep(null)} className="pl-btn-secondary text-sm">Cancel</button>
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
'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { STEPS_CONFIG, type EventEntry } from '@/types'
import * as XLSX from 'xlsx'

export default function AttractionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [entry, setEntry] = useState<EventEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeStep, setActiveStep] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  useEffect(() => { loadEntry() }, [params.id])

  async function loadEntry() {
    const { data } = await supabase.from('content_entries').select('*').eq('id', params.id).single()
    if (data) setEntry(data as EventEntry)
    setLoading(false)
  }

  async function saveField(field: string, value: string) {
    setSaving(true)
    const { error } = await supabase.from('content_entries').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', params.id)
    if (!error) { setEntry(prev => prev ? { ...prev, [field]: value } : null); setActiveStep(null) }
    setSaving(false)
  }

  async function updateStatus(status: string) {
    await supabase.from('content_entries').update({ status, updated_at: new Date().toISOString() }).eq('id', params.id)
    setEntry(prev => prev ? { ...prev, status: status as EventEntry['status'] } : null)
  }

  function exportToExcel() {
    if (!entry) return
    const headers = ['ID', 'Name', 'URL', 'Page QA', 'Categories', 'Tags', '', 'Original Description', '', 'Recommended Versions', '', 'Fact Check', 'Duplicate', 'A/B Tests', 'Trigger Risk', 'TOV', 'Grammar', '', '', '', '', '', 'Reviewer', '', 'Resolver', '', '', '', 'Prev Original', '', 'SEO', '', 'Fact Check Final', '', '', '', '', 'Ranked']
    const row = [entry.event_id, entry.event_title, entry.event_url, entry.page_qa_comments, entry.categories, entry.tags, '', entry.original_description, '', entry.recommended_versions, '', entry.fact_check_scores, entry.duplicate_analysis, entry.ab_tests, entry.organiser_trigger_risk, entry.tov_score, entry.grammar_style, '', '', '', '', '', entry.reviewer_output, '', entry.resolver_output, '', '', '', entry.prev_original_description, '', entry.seo_analysis, '', entry.fact_check_final, '', '', '', '', entry.ranked_versions]
    const ws = XLSX.utils.aoa_to_sheet([headers, row])
    ws['!cols'] = headers.map(() => ({ wch: 30 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Attraction Pipeline')
    XLSX.writeFile(wb, `rockstary-attraction-${entry.event_id}.xlsx`)
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="w-10 h-10 border-4 border-pl-gold/30 border-t-pl-gold rounded-full animate-spin" /></div>
  if (!entry) return <div className="p-8 text-center"><p className="text-pl-muted">Not found</p><button onClick={() => router.push('/dashboard/attractions')} className="pl-btn-secondary mt-4">Back</button></div>

  const getFieldValue = (field: string): string => (entry as any)[field] || ''
  const getStepStatus = (field: string) => getFieldValue(field).trim() !== '' ? 'done' as const : 'pending' as const
  const completedCount = STEPS_CONFIG.filter(s => getStepStatus(s.field) === 'done').length

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.push('/dashboard/attractions')} className="p-2 rounded-lg hover:bg-pl-card transition-colors text-pl-muted hover:text-white">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="bg-pl-accent/10 text-pl-accent-light font-mono font-bold px-3 py-1 rounded-lg text-sm">#{entry.event_id}</span>
            <h1 className="text-xl font-bold text-white">{entry.event_title}</h1>
          </div>
          <p className="text-sm text-pl-muted mt-1">{entry.event_url}</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={entry.status} onChange={(e) => updateStatus(e.target.value)} className="pl-input text-sm w-auto">
            <option value="draft">Draft</option>
            <option value="in_progress">In Progress</option>
            <option value="review">Review</option>
            <option value="completed">Completed</option>
          </select>
          <button onClick={exportToExcel} className="pl-btn-secondary flex items-center gap-2 text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Export XLSX
          </button>
        </div>
      </div>

      <div className="pl-card p-4 mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-pl-text-dim">Pipeline Progress</span>
          <span className="text-sm font-medium text-pl-accent-light">{completedCount}/{STEPS_CONFIG.length} steps</span>
        </div>
        <div className="w-full h-3 bg-pl-dark rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-pl-accent to-pl-accent-light rounded-full transition-all duration-500" style={{ width: `${(completedCount / STEPS_CONFIG.length) * 100}%` }} />
        </div>
      </div>

      <div className="space-y-3">
        {STEPS_CONFIG.map((step, idx) => {
          const status = getStepStatus(step.field)
          const isActive = activeStep === step.step
          const value = getFieldValue(step.field)
          return (
            <div key={step.step} className={`pl-card overflow-hidden ${isActive ? 'border-pl-accent/40' : ''}`}>
              <button onClick={() => { if (isActive) { setActiveStep(null) } else { setActiveStep(step.step); setEditValue(value) } }} className="w-full flex items-center gap-4 p-4 text-left hover:bg-pl-card/50 transition-colors">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${status === 'done' ? 'bg-pl-success/20 text-pl-success' : 'bg-pl-muted/20 text-pl-muted'}`}>
                  {status === 'done' ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> : idx + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-pl-accent/60">Step {step.step}</span>
                    <span className="text-xs text-pl-muted">Col {step.column}</span>
                    {step.optional && <span className="text-[10px] bg-pl-muted/20 text-pl-muted px-2 py-0.5 rounded-full">Optional</span>}
                  </div>
                  <p className="font-medium text-white text-sm mt-0.5">{step.label}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${status === 'done' ? 'badge-done' : 'badge-pending'}`}>{status === 'done' ? 'Done' : 'Pending'}</span>
                <svg className={`w-5 h-5 text-pl-muted transition-transform ${isActive ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {isActive && (
                <div className="border-t border-pl-border p-4 bg-pl-dark/30">
                  <textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} placeholder={`Enter ${step.label} content...`} className="pl-input min-h-[200px] resize-y font-mono text-sm" />
                  <div className="flex items-center gap-3 mt-3">
                    <button onClick={() => saveField(step.field, editValue)} disabled={saving} className="pl-btn-primary text-sm flex items-center gap-2">{saving ? <div className="w-4 h-4 border-2 border-pl-dark/30 border-t-pl-dark rounded-full animate-spin" /> : 'Save'}</button>
                    <button onClick={() => setActiveStep(null)} className="pl-btn-secondary text-sm">Cancel</button>
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
