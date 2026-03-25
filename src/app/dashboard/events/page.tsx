'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { parseExcelFile, type ParsedRow } from '@/lib/excel-parser'
import type { InputMethod, EventEntry } from '@/types'

export default function EventsDashboard() {
  const [entries, setEntries] = useState<EventEntry[]>([])
  const [showNewForm, setShowNewForm] = useState(false)
  const [inputMethod, setInputMethod] = useState<InputMethod>('url_only')
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [excelPreview, setExcelPreview] = useState<ParsedRow[]>([])
  const [importingExcel, setImportingExcel] = useState(false)
  const [formData, setFormData] = useState({
    event_id: '',
    event_title: '',
    event_url: '',
    raw_text: '',
    screenshot_file: null as File | null,
  })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadEntries()
  }, [])

  async function loadEntries() {
    const { data } = await supabase
      .from('content_entries')
      .select('*')
      .eq('mode', 'events')
      .order('created_at', { ascending: false })
    setEntries((data as EventEntry[]) || [])
    setLoading(false)
  }

  async function handleExcelFile(file: File) {
    setExcelFile(file)
    const buffer = await file.arrayBuffer()
    const rows = await parseExcelFile(buffer)
    setExcelPreview(rows)
  }

  async function handleExcelImport() {
    if (excelPreview.length === 0) return
    setImportingExcel(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const entries = excelPreview.map(row => ({
      user_id: user.id,
      mode: 'events' as const,
      event_id: row.event_id,
      event_title: row.event_title,
      event_url: row.event_url,
      input_method: 'excel_upload' as const,
      screenshot_url: '',
      original_description: row.original_description,
      recommended_versions: row.recommended_versions,
      fact_check_scores: row.fact_check_scores,
      duplicate_analysis: row.duplicate_analysis,
      ab_tests: row.ab_tests,
      organiser_trigger_risk: row.organiser_trigger_risk,
      tov_score: row.tov_score,
      grammar_style: row.grammar_style,
      reviewer_output: row.reviewer_output,
      resolver_output: row.resolver_output,
      prev_original_description: row.prev_original_description,
      seo_analysis: row.seo_analysis,
      fact_check_final: row.fact_check_final,
      ranked_versions: row.ranked_versions,
      categories: row.categories,
      tags: row.tags,
      page_qa_comments: row.page_qa_comments,
      status: 'draft',
    }))

    const { error } = await supabase.from('content_entries').insert(entries)
    if (!error) {
      setShowNewForm(false)
      setExcelFile(null)
      setExcelPreview([])
      loadEntries()
    }
    setImportingExcel(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (inputMethod === 'excel_upload') {
      await handleExcelImport()
      return
    }

    setSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let screenshot_url = ''
    if (inputMethod === 'screenshot_url' && formData.screenshot_file) {
      const fileName = `${Date.now()}-${formData.screenshot_file.name}`
      const { data: uploadData } = await supabase.storage
        .from('screenshots')
        .upload(fileName, formData.screenshot_file)
      if (uploadData) {
        const { data: urlData } = supabase.storage.from('screenshots').getPublicUrl(fileName)
        screenshot_url = urlData.publicUrl
      }
    }

    const entry = {
      user_id: user.id,
      mode: 'events' as const,
      event_id: formData.event_id,
      event_title: formData.event_title,
      event_url: formData.event_url,
      input_method: inputMethod,
      screenshot_url,
      original_description: inputMethod === 'rawtext_url' ? formData.raw_text : '',
      recommended_versions: '',
      fact_check_scores: '',
      duplicate_analysis: '',
      ab_tests: '',
      organiser_trigger_risk: '',
      tov_score: '',
      grammar_style: '',
      reviewer_output: '',
      resolver_output: '',
      prev_original_description: '',
      seo_analysis: '',
      fact_check_final: '',
      ranked_versions: '',
      categories: '',
      tags: '',
      page_qa_comments: '',
      status: 'draft',
    }

    const { error } = await supabase.from('content_entries').insert([entry])
    if (!error) {
      setShowNewForm(false)
      setFormData({ event_id: '', event_title: '', event_url: '', raw_text: '', screenshot_file: null })
      loadEntries()
    }
    setSubmitting(false)
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'completed': return 'bg-pl-success/20 text-pl-success'
      case 'in_progress': return 'bg-pl-accent/20 text-pl-accent-light'
      case 'review': return 'bg-pl-warning/20 text-pl-warning'
      default: return 'bg-pl-muted/20 text-pl-muted'
    }
  }

  function getCompletedSteps(entry: EventEntry): number {
    const fields = [
      entry.original_description,
      entry.recommended_versions,
      entry.fact_check_scores,
      entry.duplicate_analysis,
      entry.ab_tests,
      entry.organiser_trigger_risk,
      entry.tov_score,
      entry.grammar_style,
      entry.reviewer_output,
      entry.resolver_output,
      entry.seo_analysis,
      entry.fact_check_final,
      entry.ranked_versions,
    ]
    return fields.filter(f => f && f.trim() !== '').length
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Events Content Pipeline</h1>
          <p className="text-pl-text-dim text-sm mt-1">Process event descriptions through the 13-step content engine</p>
        </div>
        <button onClick={() => setShowNewForm(true)} className="pl-btn-primary flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Event
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total', value: entries.length, color: 'text-white' },
          { label: 'In Progress', value: entries.filter(e => e.status === 'in_progress').length, color: 'text-pl-accent-light' },
          { label: 'Review', value: entries.filter(e => e.status === 'review').length, color: 'text-pl-warning' },
          { label: 'Completed', value: entries.filter(e => e.status === 'completed').length, color: 'text-pl-success' },
        ].map((stat) => (
          <div key={stat.label} className="pl-card p-4">
            <p className="text-xs text-pl-muted uppercase tracking-wider">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* New Entry Form */}
      {showNewForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-pl-navy border border-pl-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-pl-border flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">New Event Entry</h2>
              <button onClick={() => setShowNewForm(false)} className="text-pl-muted hover:text-white">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Input Method Selection */}
              <div>
                <label className="block text-sm text-pl-text-dim mb-3">How are you providing the content?</label>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { value: 'screenshot_url' as InputMethod, icon: '📸', label: 'Screenshot + URL', desc: 'Upload screenshot and provide URL' },
                    { value: 'rawtext_url' as InputMethod, icon: '📝', label: 'Raw Text + URL', desc: 'Paste description text with URL' },
                    { value: 'url_only' as InputMethod, icon: '🔗', label: 'URL Only', desc: 'Just provide the event URL' },
                    { value: 'excel_upload' as InputMethod, icon: '📊', label: 'Excel File', desc: 'Import from reference XLSX' },
                  ].map((method) => (
                    <button
                      key={method.value}
                      type="button"
                      onClick={() => setInputMethod(method.value)}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        inputMethod === method.value
                          ? 'border-pl-gold bg-pl-gold/5'
                          : 'border-pl-border bg-pl-card hover:border-pl-border'
                      }`}
                    >
                      <span className="text-2xl">{method.icon}</span>
                      <p className="font-medium text-sm text-white mt-2">{method.label}</p>
                      <p className="text-xs text-pl-muted mt-1">{method.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Excel Upload Mode */}
              {inputMethod === 'excel_upload' && (
                <div>
                  <label className="block text-sm text-pl-text-dim mb-2">Upload Reference Excel</label>
                  <div className="border-2 border-dashed border-pl-border rounded-xl p-8 text-center hover:border-pl-gold/30 transition-colors">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={(e) => e.target.files?.[0] && handleExcelFile(e.target.files[0])}
                      className="hidden"
                      id="excel-upload"
                    />
                    <label htmlFor="excel-upload" className="cursor-pointer">
                      <svg className="w-8 h-8 text-pl-muted mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-sm text-pl-text-dim">
                        {excelFile ? excelFile.name : 'Click to upload .xlsx file'}
                      </p>
                    </label>
                  </div>

                  {/* Excel Preview */}
                  {excelPreview.length > 0 && (
                    <div className="mt-4 bg-pl-dark/30 rounded-xl p-4 border border-pl-border">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium text-pl-gold">
                          {excelPreview.length} event{excelPreview.length > 1 ? 's' : ''} found
                        </p>
                        <span className="text-xs text-pl-muted">Empty fields will be left blank</span>
                      </div>
                      <div className="max-h-[250px] overflow-y-auto space-y-2">
                        {excelPreview.map((row, idx) => {
                          const filledFields = Object.entries(row).filter(([k, v]) => v && v.trim() !== '' && k !== 'event_id' && k !== 'event_title' && k !== 'event_url').length
                          return (
                            <div key={idx} className="flex items-center gap-3 p-2 bg-pl-card rounded-lg">
                              <span className="bg-pl-gold/10 text-pl-gold font-mono text-xs px-2 py-1 rounded">#{row.event_id}</span>
                              <span className="text-sm text-white flex-1 truncate">{row.event_title}</span>
                              <span className="text-xs text-pl-muted">{filledFields} fields filled</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Common Fields (hidden for Excel upload) */}
              {inputMethod !== 'excel_upload' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-pl-text-dim mb-2">Event ID</label>
                      <input
                        type="text"
                        value={formData.event_id}
                        onChange={(e) => setFormData({ ...formData, event_id: e.target.value })}
                        placeholder="e.g. 12345"
                        className="pl-input"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-pl-text-dim mb-2">Event Title</label>
                      <input
                        type="text"
                        value={formData.event_title}
                        onChange={(e) => setFormData({ ...formData, event_title: e.target.value })}
                        placeholder="Event name"
                        className="pl-input"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-pl-text-dim mb-2">Event URL</label>
                    <input
                      type="url"
                      value={formData.event_url}
                      onChange={(e) => setFormData({ ...formData, event_url: e.target.value })}
                      placeholder="https://platinumlist.net/event/..."
                      className="pl-input"
                      required
                    />
                  </div>
                </>
              )}

              {/* Screenshot Upload */}
              {inputMethod === 'screenshot_url' && (
                <div>
                  <label className="block text-sm text-pl-text-dim mb-2">Screenshot</label>
                  <div className="border-2 border-dashed border-pl-border rounded-xl p-8 text-center hover:border-pl-gold/30 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setFormData({ ...formData, screenshot_file: e.target.files?.[0] || null })}
                      className="hidden"
                      id="screenshot-upload"
                    />
                    <label htmlFor="screenshot-upload" className="cursor-pointer">
                      <svg className="w-8 h-8 text-pl-muted mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm text-pl-text-dim">
                        {formData.screenshot_file ? formData.screenshot_file.name : 'Click to upload screenshot'}
                      </p>
                    </label>
                  </div>
                </div>
              )}

              {/* Raw Text */}
              {inputMethod === 'rawtext_url' && (
                <div>
                  <label className="block text-sm text-pl-text-dim mb-2">Original Description</label>
                  <textarea
                    value={formData.raw_text}
                    onChange={(e) => setFormData({ ...formData, raw_text: e.target.value })}
                    placeholder="Paste the event description here..."
                    className="pl-input min-h-[200px] resize-y"
                    required
                  />
                </div>
              )}

              {/* Submit */}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowNewForm(false)} className="pl-btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={submitting || importingExcel} className="pl-btn-primary flex-1 flex items-center justify-center gap-2">
                  {(submitting || importingExcel) ? (
                    <div className="w-5 h-5 border-2 border-pl-dark/30 border-t-pl-dark rounded-full animate-spin" />
                  ) : (
                    inputMethod === 'excel_upload' ? `Import ${excelPreview.length} Event${excelPreview.length !== 1 ? 's' : ''}` : 'Create Entry'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Entries List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-pl-gold/30 border-t-pl-gold rounded-full animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="pl-card p-16 text-center">
          <svg className="w-16 h-16 text-pl-muted mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="text-lg font-medium text-white mb-2">No events yet</h3>
          <p className="text-pl-text-dim mb-6">Start by adding your first event to the content pipeline</p>
          <button onClick={() => setShowNewForm(true)} className="pl-btn-primary">
            Add First Event
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <a
              key={entry.id}
              href={`/dashboard/events/${entry.id}`}
              className="pl-card p-5 flex items-center gap-6 group block"
            >
              {/* Event ID Badge */}
              <div className="bg-pl-gold/10 text-pl-gold font-mono font-bold px-3 py-2 rounded-lg text-sm min-w-[60px] text-center">
                #{entry.event_id}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white group-hover:text-pl-gold transition-colors truncate">
                  {entry.event_title}
                </h3>
                <p className="text-xs text-pl-muted mt-1 truncate">{entry.event_url}</p>
              </div>

              {/* Progress */}
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs text-pl-muted">Steps</p>
                  <p className="text-sm font-medium text-white">{getCompletedSteps(entry)}/13</p>
                </div>
                <div className="w-24 h-2 bg-pl-dark rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-pl-gold to-pl-gold-light rounded-full transition-all"
                    style={{ width: `${(getCompletedSteps(entry) / 13) * 100}%` }}
                  />
                </div>
              </div>

              {/* Status */}
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(entry.status)}`}>
                {entry.status.replace('_', ' ')}
              </span>

              {/* Arrow */}
              <svg className="w-5 h-5 text-pl-muted group-hover:text-pl-gold transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
