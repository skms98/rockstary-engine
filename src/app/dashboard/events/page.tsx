'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { parseExcelFile, type ParsedRow } from '@/lib/excel-parser'
import type { InputMethod, EventEntry } from '@/types'

export default function EventsDashboard() {
  const [entries, setEntries] = useState<EventEntry[]>([])
  const [showNewForm, setShowNewForm] = useState(false)
  const [inputMethod, setInputMethod] = useState<InputMethod>('rawtext_url')
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [excelPreview, setExcelPreview] = useState<ParsedRow[]>([])
  const [importingExcel, setImportingExcel] = useState(false)
  const [formData, setFormData] = useState({
    event_id: '',
    event_title: '',
    event_url: '',
    raw_text: '',
    screenshot_file: null as File | null,
    screenshot_files: [] as { file: File; label: string; group: number }[],
  })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // DB import state
  const [dbSearch, setDbSearch] = useState('')
  const [dbResults, setDbResults] = useState<{event_id:string;event_name_en:string;url:string;status:string;city:string;country:string}[]>([])
  const [dbSelected, setDbSelected] = useState<Set<string>>(new Set())
  const [dbSearching, setDbSearching] = useState(false)
  const [dbImporting, setDbImporting] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const dragCounterRef = useRef(0)
  const previewUrlsRef = useRef<Map<File, string>>(new Map())

  // Get or create a stable object URL for a File (avoids re-creating on every render)
  const getPreviewUrl = useCallback((file: File) => {
    const existing = previewUrlsRef.current.get(file)
    if (existing) return existing
    const url = URL.createObjectURL(file)
    previewUrlsRef.current.set(file, url)
    return url
  }, [])

  // Revoke all object URLs on unmount or when form closes
  useEffect(() => {
    if (!showNewForm) {
      previewUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
      previewUrlsRef.current.clear()
    }
    return () => {
      previewUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
      previewUrlsRef.current.clear()
    }
  }, [showNewForm])

  // Shared helper: add image files to screenshot_files array
  // Files uploaded in the same batch get the same group number (same section)
  const addScreenshotFiles = useCallback((files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'))
    if (imageFiles.length === 0) return
    setFormData(prev => {
      const maxGroup = prev.screenshot_files.reduce((max, s) => Math.max(max, s.group), 0)
      const nextGroup = maxGroup + 1
      const newFiles = imageFiles.map((file, i) => ({
        file,
        label: `Screenshot ${prev.screenshot_files.length + i + 1}`,
        group: nextGroup,
      }))
      return { ...prev, screenshot_files: [...prev.screenshot_files, ...newFiles] }
    })
  }, [])

  // Paste handler: listen for Ctrl+V / Cmd+V with images
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!showNewForm) return
      const items = e.clipboardData?.items
      if (!items) return
      const imageFiles: File[] = []
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile()
          if (file) imageFiles.push(file)
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault()
        addScreenshotFiles(imageFiles)
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [showNewForm, addScreenshotFiles])

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

  async function searchDb(q: string) {
    if (!q.trim()) { setDbResults([]); return }
    setDbSearching(true)
    try {
      const res = await fetch(`/api/events-db?search=${encodeURIComponent(q)}&page=1`)
      const data = await res.json()
      setDbResults(data.events || [])
    } catch { setDbResults([]) }
    setDbSearching(false)
  }

  async function handleDbImport() {
    if (dbSelected.size === 0) return
    setDbImporting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const toImport = dbResults.filter(r => dbSelected.has(String(r.event_id)))
    const inserts = toImport.map(r => ({
      user_id: user.id,
      mode: 'events' as const,
      event_id: String(r.event_id),
      event_title: r.event_name_en || '',
      event_url: r.url || '',
      input_method: 'db_import' as const,
      screenshot_url: '',
      original_description: '', recommended_versions: '', fact_check_scores: '',
      duplicate_analysis: '', ab_tests: '', organiser_trigger_risk: '', tov_score: '',
      grammar_style: '', reviewer_output: '', resolver_output: '',
      prev_original_description: '', seo_analysis: '', fact_check_final: '', ranked_versions: '',
      categories: '', tags: '', page_qa_comments: '', status: 'draft',
    }))
    const { error } = await supabase.from('content_entries').insert(inserts)
    if (!error) {
      setShowNewForm(false)
      setDbSearch(''); setDbResults([]); setDbSelected(new Set())
      loadEntries()
    }
    setDbImporting(false)
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

    // Upload multiple ordered screenshots
    let screenshot_url = ''
    const screenshotsArray: { order: number; url: string; label: string; group: number }[] = []

    if (formData.screenshot_files.length > 0) {
      for (let i = 0; i < formData.screenshot_files.length; i++) {
        const { file, label, group } = formData.screenshot_files[i]
        const fileName = `${Date.now()}-${i}-${file.name}`
        const { data: uploadData } = await supabase.storage
          .from('screenshots')
          .upload(fileName, file)
        if (uploadData) {
          const { data: urlData } = supabase.storage.from('screenshots').getPublicUrl(fileName)
          screenshotsArray.push({ order: i + 1, url: urlData.publicUrl, label, group })
        }
      }
      // First screenshot URL for backwards compatibility
      if (screenshotsArray.length > 0) {
        screenshot_url = screenshotsArray[0].url
      }
    } else if (formData.screenshot_file) {
      // Legacy single file fallback
      const fileName = `${Date.now()}-${formData.screenshot_file.name}`
      const { data: uploadData } = await supabase.storage
        .from('screenshots')
        .upload(fileName, formData.screenshot_file)
      if (uploadData) {
        const { data: urlData } = supabase.storage.from('screenshots').getPublicUrl(fileName)
        screenshot_url = urlData.publicUrl
        screenshotsArray.push({ order: 1, url: urlData.publicUrl, label: 'Full page', group: 1 })
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
      screenshots: screenshotsArray,
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
      previewUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
      previewUrlsRef.current.clear()
      setFormData({ event_id: '', event_title: '', event_url: '', raw_text: '', screenshot_file: null, screenshot_files: [] })
      loadEntries()
    }
    setSubmitting(false)
  }

  async function deleteEntry(id: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Are you sure you want to remove this event?')) return
    setDeleting(id)
    const { error } = await supabase.from('content_entries').delete().eq('id', id)
    if (!error) {
      setEntries(prev => prev.filter(entry => entry.id !== id))
      setSelected(prev => { const next = new Set(prev); next.delete(id); return next })
    }
    setDeleting(null)
  }

  async function deleteSelected() {
    if (selected.size === 0) return
    if (!confirm(`Remove ${selected.size} selected event${selected.size > 1 ? 's' : ''}?`)) return
    const ids = Array.from(selected)
    for (const id of ids) {
      await supabase.from('content_entries').delete().eq('id', id)
    }
    setEntries(prev => prev.filter(e => !selected.has(e.id)))
    setSelected(new Set())
  }

  function toggleSelect(id: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === entries.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(entries.map(e => e.id)))
    }
  }

  async function massExport(format: 'xlsx' | 'csv') {
    const toExport = entries.filter(e => selected.size === 0 || selected.has(e.id))
    if (toExport.length === 0) return

    const XLSX = await import('xlsx')

    const headers = [
      'Event ID', 'Event Title', 'Event URL', 'Page QA', 'Categories', 'Tags',
      'Original Description', 'Recommended Versions', 'Fact Check Scores',
      'Duplicate Analysis', 'A/B Tests', 'Organiser Trigger Risk', 'TOV Score',
      'Grammar & Style', 'Reviewer', 'Resolver', 'Prev Original',
      'SEO Analysis', 'Fact Check Final', 'Ranked Versions', 'Status'
    ]

    const rows = toExport.map(e => [
      e.event_id, e.event_title, e.event_url, e.page_qa_comments, e.categories, e.tags,
      e.original_description, e.recommended_versions, e.fact_check_scores,
      e.duplicate_analysis, e.ab_tests, e.organiser_trigger_risk, e.tov_score,
      e.grammar_style, e.reviewer_output, e.resolver_output, e.prev_original_description,
      e.seo_analysis, e.fact_check_final, e.ranked_versions, e.status
    ])

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    ws['!cols'] = headers.map(() => ({ wch: 30 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Events Pipeline')

    if (format === 'csv') {
      const csv = XLSX.utils.sheet_to_csv(ws)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rockstary-events-${toExport.length}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      XLSX.writeFile(wb, `rockstary-events-${toExport.length}.xlsx`)
    }
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
                <div className="grid grid-cols-5 gap-3">
                  {[
                    { value: 'screenshot_url' as InputMethod, icon: '📸', label: 'Screenshot + URL', desc: 'Upload screenshot and provide URL', badge: 'beta' as const },
                    { value: 'rawtext_url' as InputMethod, icon: '📝', label: 'Raw Text + URL', desc: 'Paste description text with URL', badge: 'recommended' as const },
                    { value: 'url_only' as InputMethod, icon: '🔗', label: 'URL Only', desc: 'Just provide the event URL', badge: 'beta' as const },
                    { value: 'excel_upload' as InputMethod, icon: '📊', label: 'Excel File', desc: 'Import from reference XLSX', badge: 'beta' as const },
                    { value: 'db_import' as InputMethod, icon: '🗄️', label: 'From Database', desc: 'Search and import from live PL DB', badge: 'beta' as const },
                  ].map((method) => (
                    <button
                      key={method.value}
                      type="button"
                      onClick={() => setInputMethod(method.value)}
                      className={`p-4 rounded-xl border text-left transition-all relative ${
                        inputMethod === method.value
                          ? 'border-pl-gold bg-pl-gold/5'
                          : 'border-pl-border bg-pl-card hover:border-pl-border'
                      }`}
                    >
                      {method.badge === 'recommended' && (
                        <span className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Recommended
                        </span>
                      )}
                      {method.badge === 'beta' && (
                        <span className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400/70 border border-amber-500/20">
                          Beta
                        </span>
                      )}
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

              {/* DB Import Mode */}
              {inputMethod === 'db_import' && (
                <div>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={dbSearch}
                      onChange={e => setDbSearch(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && searchDb(dbSearch)}
                      placeholder="Search event name in Platinumlist DB…"
                      className="pl-input flex-1"
                    />
                    <button type="button" onClick={() => searchDb(dbSearch)} disabled={dbSearching}
                      className="px-4 py-2 bg-pl-gold text-black text-sm font-semibold rounded-lg hover:bg-pl-gold/80 disabled:opacity-50 transition-colors">
                      {dbSearching ? '…' : 'Search'}
                    </button>
                  </div>
                  {dbResults.length > 0 && (
                    <div className="max-h-64 overflow-y-auto space-y-1 border border-pl-border rounded-xl p-2">
                      {dbResults.map(r => (
                        <label key={r.event_id} className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${dbSelected.has(String(r.event_id)) ? 'bg-pl-gold/10 border border-pl-gold/30' : 'hover:bg-pl-card'}`}>
                          <input type="checkbox" checked={dbSelected.has(String(r.event_id))}
                            onChange={e => { const s = new Set(dbSelected); e.target.checked ? s.add(String(r.event_id)) : s.delete(String(r.event_id)); setDbSelected(s) }}
                            className="accent-pl-gold" />
                          <span className="bg-pl-gold/10 text-pl-gold font-mono text-xs px-2 py-0.5 rounded shrink-0">#{r.event_id}</span>
                          <span className="text-sm text-white flex-1 truncate">{r.event_name_en}</span>
                          <span className="text-xs text-pl-muted shrink-0">{r.city}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {dbSelected.size > 0 && (
                    <button type="button" onClick={handleDbImport} disabled={dbImporting}
                      className="w-full mt-3 px-4 py-2.5 bg-pl-gold text-black text-sm font-bold rounded-lg hover:bg-pl-gold/80 disabled:opacity-50 transition-colors">
                      {dbImporting ? 'Importing…' : `Import ${dbSelected.size} Event${dbSelected.size > 1 ? 's' : ''} from DB`}
                    </button>
                  )}
                </div>
              )}

              {/* Common Fields (hidden for Excel upload and db_import) */}
              {inputMethod !== 'excel_upload' && inputMethod !== 'db_import' && (
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

              {/* Multi-Screenshot Upload — required for screenshot_url, optional for others */}
              {inputMethod !== 'excel_upload' && inputMethod !== 'db_import' && (
                <div>
                  <label className="block text-sm text-pl-text-dim mb-2">
                    Page Screenshots
                    {inputMethod === 'screenshot_url' ? (
                      <span className="text-amber-400 text-xs ml-1">(required, upload in page order: top to bottom)</span>
                    ) : (
                      <span className="text-emerald-400 text-xs ml-1">(optional, helps with QA and category tagging)</span>
                    )}
                  </label>

                  {/* Uploaded screenshots list — grouped by section */}
                  {formData.screenshot_files.length > 0 && (() => {
                    // Build ordered unique groups for display labels
                    const seenGroups: number[] = []
                    formData.screenshot_files.forEach(s => { if (!seenGroups.includes(s.group)) seenGroups.push(s.group) })
                    const groupDisplayIndex = (g: number) => seenGroups.indexOf(g) + 1
                    const groupColors = ['bg-pl-gold/20 text-pl-gold', 'bg-blue-500/20 text-blue-400', 'bg-emerald-500/20 text-emerald-400', 'bg-purple-500/20 text-purple-400', 'bg-rose-500/20 text-rose-400', 'bg-amber-500/20 text-amber-400', 'bg-cyan-500/20 text-cyan-400', 'bg-pink-500/20 text-pink-400']
                    const getGroupColor = (g: number) => groupColors[(groupDisplayIndex(g) - 1) % groupColors.length]
                    // Count per group for "part X of Y" display
                    const groupCounts: Record<number, number> = {}
                    const groupPartIndex: number[] = []
                    formData.screenshot_files.forEach(s => {
                      groupCounts[s.group] = (groupCounts[s.group] || 0) + 1
                    })
                    const groupRunning: Record<number, number> = {}
                    formData.screenshot_files.forEach(s => {
                      groupRunning[s.group] = (groupRunning[s.group] || 0) + 1
                      groupPartIndex.push(groupRunning[s.group])
                    })

                    return (
                    <div className="space-y-1 mb-3">
                      {formData.screenshot_files.map((item, index) => {
                        const gIdx = groupDisplayIndex(item.group)
                        const gCount = groupCounts[item.group]
                        const partNum = groupPartIndex[index]
                        const sectionLabel = gCount > 1 ? `S${gIdx}.${partNum}` : `S${gIdx}`
                        const prevGroup = index > 0 ? formData.screenshot_files[index - 1].group : null
                        const isGroupStart = index === 0 || item.group !== prevGroup

                        return (
                        <div key={index}>
                          {/* Group separator line for new sections */}
                          {isGroupStart && index > 0 && (
                            <div className="flex items-center gap-2 py-1 px-1">
                              <div className="flex-1 border-t border-pl-border/30" />
                              <span className="text-[10px] text-pl-muted/50 uppercase tracking-wider">Section {gIdx}</span>
                              <div className="flex-1 border-t border-pl-border/30" />
                            </div>
                          )}
                          <div className="flex items-center gap-2 bg-pl-card border border-pl-border rounded-lg px-3 py-2">
                            {/* Section badge */}
                            <div className={`flex-shrink-0 px-2 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${getGroupColor(item.group)}`}>
                              {sectionLabel}
                            </div>

                            {/* Thumbnail preview */}
                            <div className="flex-shrink-0 w-10 h-10 rounded overflow-hidden bg-pl-dark">
                              <img
                                src={getPreviewUrl(item.file)}
                                alt={sectionLabel}
                                className="w-full h-full object-cover"
                              />
                            </div>

                            {/* File name */}
                            <span className="text-xs text-pl-muted truncate flex-1 min-w-0" title={item.file.name}>
                              {item.file.name}
                            </span>

                            {/* Link/Unlink with previous — merge into same section or split */}
                            {index > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...formData.screenshot_files]
                                  if (item.group === prevGroup) {
                                    // Unlink: give this and all subsequent same-group items a new group
                                    const maxG = updated.reduce((m, s) => Math.max(m, s.group), 0)
                                    const oldGroup = item.group
                                    let splitting = false
                                    for (let i = index; i < updated.length; i++) {
                                      if (i === index) splitting = true
                                      if (splitting && updated[i].group === oldGroup) {
                                        updated[i] = { ...updated[i], group: maxG + 1 }
                                      }
                                    }
                                  } else {
                                    // Link: merge this item's group into the previous item's group
                                    const targetGroup = prevGroup!
                                    const sourceGroup = item.group
                                    for (let i = 0; i < updated.length; i++) {
                                      if (updated[i].group === sourceGroup) {
                                        updated[i] = { ...updated[i], group: targetGroup }
                                      }
                                    }
                                  }
                                  setFormData({ ...formData, screenshot_files: updated })
                                }}
                                className={`flex-shrink-0 transition-colors ${item.group === prevGroup ? 'text-pl-gold hover:text-red-400' : 'text-pl-muted/40 hover:text-pl-gold'}`}
                                title={item.group === prevGroup ? 'Unlink from section above (split into new section)' : 'Link to section above (same page area)'}
                              >
                                {item.group === prevGroup ? (
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 20L20 4" />
                                  </svg>
                                )}
                              </button>
                            )}

                            {/* Move up */}
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => {
                                const updated = [...formData.screenshot_files]
                                ;[updated[index - 1], updated[index]] = [updated[index], updated[index - 1]]
                                setFormData({ ...formData, screenshot_files: updated })
                              }}
                              className="text-pl-muted hover:text-pl-gold disabled:opacity-20 transition-colors"
                              title="Move up"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                            </button>

                            {/* Move down */}
                            <button
                              type="button"
                              disabled={index === formData.screenshot_files.length - 1}
                              onClick={() => {
                                const updated = [...formData.screenshot_files]
                                ;[updated[index], updated[index + 1]] = [updated[index + 1], updated[index]]
                                setFormData({ ...formData, screenshot_files: updated })
                              }}
                              className="text-pl-muted hover:text-pl-gold disabled:opacity-20 transition-colors"
                              title="Move down"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>

                            {/* Remove */}
                            <button
                              type="button"
                              onClick={() => {
                                const removed = formData.screenshot_files[index]
                                const url = previewUrlsRef.current.get(removed.file)
                                if (url) { URL.revokeObjectURL(url); previewUrlsRef.current.delete(removed.file) }
                                setFormData({
                                  ...formData,
                                  screenshot_files: formData.screenshot_files.filter((_, i) => i !== index),
                                })
                              }}
                              className="text-red-400/60 hover:text-red-400 transition-colors"
                              title="Remove"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        )
                      })}
                    </div>
                    )
                  })()}

                  {/* Add more screenshots — click, drag-and-drop, or paste */}
                  <div
                    ref={dropZoneRef}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
                    onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); dragCounterRef.current++; if (dragCounterRef.current === 1) setIsDragging(true) }}
                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); dragCounterRef.current--; if (dragCounterRef.current === 0) setIsDragging(false) }}
                    onDrop={(e) => {
                      e.preventDefault(); e.stopPropagation(); dragCounterRef.current = 0; setIsDragging(false)
                      const files = e.dataTransfer?.files
                      if (files && files.length > 0) addScreenshotFiles(Array.from(files))
                    }}
                    className={`border-2 border-dashed rounded-xl p-5 text-center transition-all ${
                      isDragging
                        ? 'border-pl-gold bg-pl-gold/10 scale-[1.01]'
                        : formData.screenshot_files.length > 0
                          ? 'border-pl-border/50 hover:border-pl-gold/20'
                          : 'border-pl-border hover:border-pl-gold/30'
                    }`}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        const files = e.target.files
                        if (!files) return
                        addScreenshotFiles(Array.from(files))
                        e.target.value = ''
                      }}
                      className="hidden"
                      id="multi-screenshot-upload"
                    />
                    <label htmlFor="multi-screenshot-upload" className="cursor-pointer">
                      <div className="flex flex-col items-center justify-center gap-2">
                        {isDragging ? (
                          <>
                            <svg className="w-8 h-8 text-pl-gold animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                            <p className="text-sm text-pl-gold font-medium">Drop screenshots here</p>
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5 text-pl-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <p className="text-sm text-pl-muted">
                              {formData.screenshot_files.length > 0
                                ? `Add more screenshots (${formData.screenshot_files.length} added)`
                                : 'Click, drag & drop, or paste (Ctrl+V) to add screenshots'}
                            </p>
                            <p className="text-xs text-pl-muted/60">Supports multiple files at once</p>
                          </>
                        )}
                      </div>
                    </label>
                  </div>
                  {formData.screenshot_files.length > 0 && (
                    <p className="text-xs text-pl-muted mt-2">
                      Screenshots uploaded together are auto-grouped as one section. Use the link/unlink icon to merge or split sections. Files in the same section (e.g. S1.1, S1.2) are treated as parts of the same page area.
                    </p>
                  )}
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

      {/* Bulk Actions Bar */}
      {entries.length > 0 && (
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-xs text-pl-muted hover:text-white transition-colors"
          >
            <div className={`w-4 h-4 rounded border flex items-center justify-center ${selected.size === entries.length ? 'bg-pl-gold border-pl-gold' : 'border-pl-muted/40'}`}>
              {selected.size === entries.length && (
                <svg className="w-3 h-3 text-pl-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
              )}
            </div>
            {selected.size === entries.length ? 'Deselect all' : 'Select all'}
          </button>

          {selected.size > 0 && (
            <>
              <span className="text-xs text-pl-gold">{selected.size} selected</span>
              <button onClick={() => massExport('xlsx')} className="pl-btn-secondary text-xs py-1 px-3 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Export XLSX
              </button>
              <button onClick={() => massExport('csv')} className="pl-btn-secondary text-xs py-1 px-3 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Export CSV (Google Sheets)
              </button>
              <button onClick={deleteSelected} className="text-xs py-1 px-3 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-400 hover:text-red-300 transition-all flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Remove selected
              </button>
            </>
          )}

          {selected.size === 0 && entries.length > 0 && (
            <>
              <div className="flex-1" />
              <button onClick={() => massExport('xlsx')} className="pl-btn-secondary text-xs py-1 px-3 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Export All XLSX
              </button>
              <button onClick={() => massExport('csv')} className="pl-btn-secondary text-xs py-1 px-3 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Export All CSV
              </button>
            </>
          )}
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
            <div key={entry.id} className="pl-card flex items-center group">
              {/* Checkbox */}
              <button
                onClick={(e) => toggleSelect(entry.id, e)}
                className="p-4 pr-2 flex-shrink-0"
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  selected.has(entry.id) ? 'bg-pl-gold border-pl-gold' : 'border-pl-muted/30 hover:border-pl-muted/60'
                }`}>
                  {selected.has(entry.id) && (
                    <svg className="w-3 h-3 text-pl-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  )}
                </div>
              </button>

              {/* Entry Link */}
              <a
                href={`/dashboard/events/${entry.id}`}
                className="flex-1 flex items-center gap-6 p-4 pl-2"
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

              {/* Delete Button */}
              <button
                onClick={(e) => deleteEntry(entry.id, e)}
                disabled={deleting === entry.id}
                className="p-3 mr-2 rounded-lg text-pl-muted/40 hover:text-red-400 hover:bg-red-600/10 transition-all opacity-0 group-hover:opacity-100"
                title="Remove event"
              >
                {deleting === entry.id ? (
                  <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
