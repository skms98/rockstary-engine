// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import type { AttractionEntry } from './page'

// ── Inline Field Note (per-section comment box) ───────────────────────────────
function InlineFieldNote({
  entry,
  fieldKey,
}: {
  entry: AttractionEntry
  fieldKey: string
}) {
  const existing = (entry.field_notes as Record<string, string> | null)?.[fieldKey] || ''
  const [text, setText] = useState(existing)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')

  useEffect(() => {
    setText((entry.field_notes as Record<string, string> | null)?.[fieldKey] || '')
  }, [entry.field_notes, fieldKey])

  const postNote = async () => {
    if (!text.trim()) return
    setSaving(true)
    setStatus('idle')
    try {
      const res = await fetch('/api/attractions/post-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attractionId: entry.id,
          type: 'field_note',
          fieldKey,
          note: text.trim(),
          authorName: 'Marketing',
          attractionTitle: entry.title,
        }),
      })
      if (res.ok) {
        setStatus('saved')
        setTimeout(() => setStatus('idle'), 3000)
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-4 pb-3 pt-2 bg-gray-900/50 border-t border-gray-700/30">
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setStatus('idle') }}
        placeholder={`Notes for ${fieldKey.replace(/_/g, ' ')}…`}
        rows={2}
        className="w-full bg-gray-800/80 border border-gray-700/50 rounded-lg px-3 py-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
      />
      <div className="flex items-center justify-end gap-2 mt-1.5">
        {status === 'saved' && <span className="text-emerald-400 text-xs">✓ Saved &amp; notified</span>}
        {status === 'error' && <span className="text-red-400 text-xs">Error saving</span>}
        <button
          onClick={postNote}
          disabled={saving || !text.trim()}
          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium rounded transition-colors"
        >
          {saving ? 'Saving…' : 'Post'}
        </button>
      </div>
    </div>
  )
}

// ── Overall Notes Box (SEO-level or Attraction-level) ─────────────────────────
function NotesBox({
  entry,
  type,
  label,
  placeholder,
}: {
  entry: AttractionEntry
  type: 'seo' | 'attraction'
  label: string
  placeholder: string
}) {
  const existingNote = type === 'seo' ? entry.seo_notes : entry.attraction_notes
  const [text, setText] = useState(existingNote || '')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')

  useEffect(() => {
    setText(type === 'seo' ? (entry.seo_notes || '') : (entry.attraction_notes || ''))
  }, [entry.seo_notes, entry.attraction_notes, type])

  const postNote = async () => {
    if (!text.trim()) return
    setSaving(true)
    setStatus('idle')
    try {
      const res = await fetch('/api/attractions/post-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attractionId: entry.id,
          type,
          note: text.trim(),
          authorName: 'Marketing',
          attractionTitle: entry.title,
        }),
      })
      if (res.ok) {
        setStatus('saved')
        setTimeout(() => setStatus('idle'), 3000)
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 p-4">
      <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wide mb-2">{label}</h4>
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setStatus('idle') }}
        placeholder={placeholder}
        rows={3}
        className="w-full bg-gray-900/60 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none leading-relaxed"
      />
      <div className="flex items-center justify-end mt-2 gap-2">
        {status === 'saved' && <span className="text-emerald-400 text-xs">✓ Saved &amp; notified</span>}
        {status === 'error' && <span className="text-red-400 text-xs">Error saving</span>}
        <button
          onClick={postNote}
          disabled={saving || !text.trim()}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
        >
          {saving ? 'Posting…' : 'Post Note'}
        </button>
      </div>
    </div>
  )
}

// Helper: render keyword annotations like (keyword) [1], (merged) [1, 2], (synonym) [3*] with highlights
function HighlightedText({ text }: { text: string }) {
  if (!text) return null
  const parts = text.split(/(\([^)]+\)\s*\[[^\]]+\])/)
  return (
    <span>
      {parts.map((part, i) => {
        if (/^\([^)]+\)\s*\[[^\]]+\]$/.test(part)) {
          const isSynonym = /\[\d+\*\]$/.test(part)
          const isMerged = /\[\d+\s*,\s*\d+/.test(part)
          const colorClass = isSynonym
            ? 'text-purple-400 font-medium bg-purple-500/10 px-1 rounded'
            : isMerged
            ? 'text-cyan-400 font-medium bg-cyan-500/10 px-1 rounded'
            : 'text-blue-400 font-medium bg-blue-500/10 px-1 rounded'
          return <span key={i} className={colorClass}>{part}</span>
        }
        return <span key={i}>{part}</span>
      })}
    </span>
  )
}

// Section card for SEO content — with inline per-field note toggle
function SeoSection({
  label,
  content,
  isTitle,
  entry,
  fieldKey,
}: {
  label: string
  content: string
  isTitle?: boolean
  entry?: AttractionEntry
  fieldKey?: string
}) {
  const [showNote, setShowNote] = useState(false)
  if (!content || content.trim() === '') return null

  const hasNote = entry && fieldKey && !!(entry.field_notes as any)?.[fieldKey]

  return (
    <div className="border border-gray-700/40 rounded-lg overflow-hidden">
      <div className="px-4 py-2 bg-gray-700/30 border-b border-gray-700/40 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</span>
        {entry && fieldKey && (
          <button
            onClick={() => setShowNote(!showNote)}
            className={`text-xs flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${
              showNote
                ? 'bg-blue-500/20 text-blue-400'
                : hasNote
                ? 'text-amber-400 hover:text-amber-300'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            💬 {hasNote && !showNote ? 'Edit Note' : showNote ? 'Hide' : 'Add Note'}
          </button>
        )}
      </div>
      <div className={`px-4 py-3 ${isTitle ? 'text-white text-base font-semibold' : 'text-gray-300 text-sm'}`}>
        {content.split('\n').map((line, i) => (
          <p key={i} className={`${i > 0 ? 'mt-1.5' : ''} leading-relaxed`}>
            <HighlightedText text={line} />
          </p>
        ))}
      </div>
      {showNote && entry && fieldKey && (
        <InlineFieldNote entry={entry} fieldKey={fieldKey} />
      )}
    </div>
  )
}

// ── SEO Tab ───────────────────────────────────────────────────────────────────
export function SeoTab({ entry, save, saving }: { entry: AttractionEntry; save: (u: Partial<AttractionEntry>) => Promise<void>; saving: boolean }) {
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [kwFilter, setKwFilter] = useState<'all' | 'used' | 'merged' | 'synonym'>('all')
  const [editWriter, setEditWriter] = useState(entry.assigned_writer || '')
  const [editTranslator, setEditTranslator] = useState(entry.assigned_translator || '')
  const [savingAssignment, setSavingAssignment] = useState(false)

  useEffect(() => {
    setEditWriter(entry.assigned_writer || '')
    setEditTranslator(entry.assigned_translator || '')
  }, [entry.assigned_writer, entry.assigned_translator])

  const saveAssignment = async () => {
    setSavingAssignment(true)
    await save({
      assigned_writer: editWriter || null,
      assigned_translator: editTranslator || null,
    } as Partial<AttractionEntry>)
    setSavingAssignment(false)
  }

  const seo = entry.seo_content || {}
  const hasSeoCont = Object.keys(seo).length > 0 && Object.values(seo).some(v => v && String(v).trim() !== '')

  const mainSections = [
    { label: 'H1 Headline', keys: ['h1'], fieldKey: 'h1', isTitle: true },
    { label: 'Teaser', keys: ['teaser'], fieldKey: 'teaser' },
    { label: 'What To Expect', keys: ['what_to_expect'], fieldKey: 'what_to_expect' },
    { label: 'Highlights', keys: ['highlights'], fieldKey: 'highlights' },
    { label: "What's Included", keys: ['inclusions'], fieldKey: 'inclusions' },
    { label: 'Exclusions', keys: ['exclusions'], fieldKey: 'exclusions' },
    { label: 'Ticket Information', keys: ['ticket_info'], fieldKey: 'ticket_info' },
    { label: 'Important Info', keys: ['important_info'], fieldKey: 'important_info' },
    { label: 'Cancellation Policy', keys: ['cancellation'], fieldKey: 'cancellation' },
    { label: 'Location & Directions', keys: ['by_car', 'by_public_transport', 'by_taxi'], fieldKey: 'location' },
  ]

  const generateSeoContent = async () => {
    setGenerating(true)
    setGenerateError(null)
    try {
      const res = await fetch('/api/attractions/generate-seo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attractionId: entry.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        setGenerateError(data.error || 'Failed to generate SEO content')
      } else {
        await save({})
      }
    } catch (err: any) {
      setGenerateError(err.message || 'Unknown error')
    } finally {
      setGenerating(false)
    }
  }

  const markSeoComplete = async () => {
    await save({ seo_status: 'completed' } as Partial<AttractionEntry>)
  }

  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6">

      {/* ── Writer / Translator Assignment ── */}
      <div className="flex items-center gap-3 mb-5 p-3 bg-gray-700/20 rounded-lg border border-gray-700/40">
        <span className="text-xs text-gray-400 font-medium shrink-0">Assigned to:</span>
        <div className="flex items-center gap-3 flex-1">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="text-xs text-gray-500 shrink-0">✍️ Writer</span>
            <input
              value={editWriter}
              onChange={e => setEditWriter(e.target.value)}
              placeholder="Assign writer…"
              className="flex-1 min-w-0 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="text-xs text-gray-500 shrink-0">🌐 Translator</span>
            <input
              value={editTranslator}
              onChange={e => setEditTranslator(e.target.value)}
              placeholder="Assign translator…"
              className="flex-1 min-w-0 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={saveAssignment}
            disabled={savingAssignment}
            className="px-3 py-1 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 text-white text-xs rounded transition-colors shrink-0"
          >
            {savingAssignment ? '…' : 'Save'}
          </button>
        </div>
      </div>

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-white font-semibold">SEO Optimization — Column D Rewrite</h3>
        <div className="flex items-center gap-3">
          {hasSeoCont && (
            <button
              onClick={generateSeoContent}
              disabled={generating}
              className="px-3 py-1 bg-amber-600/80 text-white text-xs font-medium rounded-full hover:bg-amber-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              {generating ? (
                <><span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" /> Regenerating…</>
              ) : (
                <>℻ Regenerate</>
              )}
            </button>
          )}
          {hasSeoCont && entry.seo_status !== 'completed' && (
            <button
              onClick={markSeoComplete}
              disabled={saving}
              className="px-3 py-1 bg-emerald-600 text-white text-xs font-medium rounded-full hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : '✓ Mark SEO Complete'}
            </button>
          )}
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            entry.seo_status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
            entry.seo_status === 'processing' ? 'bg-amber-500/20 text-amber-400' :
            'bg-gray-600/30 text-gray-400'
          }`}>{entry.seo_status}</span>
        </div>
      </div>

      {/* ── Two-column content view ── */}
      <div className="grid grid-cols-2 gap-6">

        {/* Column C: Original Content */}
        <div>
          <h4 className="text-gray-400 text-xs font-medium mb-2 uppercase tracking-wide">Original Content (Column C)</h4>
          <div className="bg-gray-900/50 rounded-lg p-4 text-gray-300 text-sm whitespace-pre-wrap max-h-[700px] overflow-y-auto leading-relaxed">
            {entry.raw_text || 'No content yet'}
          </div>
          <div className="mt-3">
            <NotesBox
              entry={entry}
              type="attraction"
              label="Attraction Notes"
              placeholder="Notes about the original content or attraction details…"
            />
          </div>
        </div>

        {/* Column D: SEO Optimised */}
        <div>
          <h4 className="text-gray-400 text-xs font-medium mb-2 uppercase tracking-wide">SEO Optimised (Column D)</h4>
          {hasSeoCont ? (
            <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
              {mainSections.map((section) => {
                const values = section.keys.map(k => seo[k] ? String(seo[k]).trim() : '').filter(Boolean)
                if (values.length === 0) return null
                const combined = values.join('\n')
                return (
                  <SeoSection
                    key={section.label}
                    label={section.label}
                    content={combined}
                    isTitle={section.isTitle}
                    entry={entry}
                    fieldKey={section.fieldKey}
                  />
                )
              })}
              {/* Catch any extra keys not in mainSections */}
              {Object.entries(seo).filter(([k, v]) => {
                const knownKeys = mainSections.flatMap(s => s.keys)
                const titleKeys = ['h1', 'what_to_expect_title', 'highlights_title', 'inclusions_title', 'exclusions_title', 'timing_title', 'ticket_info_title', 'important_info_title', 'cancellation_title', 'address_title', 'how_to_get_there_title']
                return !knownKeys.includes(k) && !titleKeys.includes(k) && v && String(v).trim() !== ''
              }).map(([k, v]) => (
                <SeoSection
                  key={k}
                  label={k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  content={String(v)}
                  entry={entry}
                  fieldKey={k}
                />
              ))}
              <div className="mt-3">
                <NotesBox
                  entry={entry}
                  type="seo"
                  label="SEO Notes (Overall)"
                  placeholder="Overall feedback on the SEO content quality…"
                />
              </div>
            </div>
          ) : (
            <div className="bg-gray-900/50 rounded-lg p-6 flex flex-col items-center justify-center gap-4 min-h-[200px]">
              {generateError && (
                <p className="text-red-400 text-xs text-center mb-1">{generateError}</p>
              )}
              <p className="text-gray-500 text-sm text-center">
                {entry.raw_text
                  ? 'Column C has content — ready to generate SEO copy.'
                  : 'No raw content yet (Column C is empty).'}
              </p>
              <button
                onClick={generateSeoContent}
                disabled={generating || !entry.raw_text}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                {generating ? (
                  <>
                    <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                    Generating SEO Content…
                  </>
                ) : (
                  <>✦ Generate SEO Content</>
                )}
              </button>
              {generating && (
                <p className="text-gray-500 text-xs">This may take 20–40 seconds…</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Keywords section ── */}
      {entry.keywords_list && (
        <div className="mt-5 pt-5 border-t border-gray-700/50">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-gray-400 text-xs font-medium uppercase tracking-wide">Keywords ({entry.keywords_used ?? 0}/{entry.keywords_total ?? 0} used)</h4>
            {hasSeoCont && (
              <div className="flex items-center gap-1">
                {(['all', 'used', 'merged', 'synonym'] as const).map((filter) => {
                  const colors = {
                    all: kwFilter === 'all' ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-500 hover:text-gray-300',
                    used: kwFilter === 'used' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-500 hover:text-gray-300',
                    merged: kwFilter === 'merged' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-gray-800 text-gray-500 hover:text-gray-300',
                    synonym: kwFilter === 'synonym' ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-800 text-gray-500 hover:text-gray-300',
                  }
                  const dots = { all: 'bg-gray-400', used: 'bg-emerald-400', merged: 'bg-cyan-400', synonym: 'bg-purple-400' }
                  return (
                    <button key={filter} onClick={() => setKwFilter(filter)} className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors flex items-center gap-1 ${colors[filter]}`}>
                      {filter !== 'all' && <span className={`w-1.5 h-1.5 rounded-full ${dots[filter]} inline-block`} />}
                      {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {entry.keywords_list.split('\n').filter(Boolean).map((kw, i) => {
              const mapping = Array.isArray(entry.keywords_mapping)
                ? entry.keywords_mapping.find((m: any) => m.id === i + 1)
                : null
              const kwType = mapping
                ? mapping.action === 'used' ? 'used'
                : mapping.action?.startsWith('merged') ? 'merged'
                : mapping.action === 'synonym' ? 'synonym'
                : 'used'
                : 'used'
              if (kwFilter !== 'all' && kwType !== kwFilter) return null
              const actionColor = mapping
                ? mapping.action === 'used' ? 'border-emerald-500/40 bg-emerald-500/5'
                : mapping.action?.startsWith('merged') ? 'border-cyan-500/40 bg-cyan-500/5'
                : mapping.action === 'synonym' ? 'border-purple-500/40 bg-purple-500/5'
                : 'border-gray-700/50 bg-gray-900/50'
                : 'border-gray-700/50 bg-gray-900/50'
              return (
                <span key={i} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border ${actionColor}`}>
                  <span className="text-blue-400 font-mono font-medium text-xs">[{i + 1}]</span>
                  <span className="text-blue-300">{kw.trim()}</span>
                  {mapping && mapping.action?.startsWith('merged') && mapping.merged_ids && (
                    <span className="text-cyan-400 text-[10px] font-medium ml-1">
                      ⇒ merged [{mapping.merged_ids.join(', ')}]
                    </span>
                  )}
                  {mapping && mapping.action === 'synonym' && (
                    <span className="text-purple-400 text-[10px] font-medium ml-1">
                      ⇒ "{mapping.as_written}" [{mapping.id}*]
                    </span>
                  )}
                  {mapping && <span className="text-gray-500 text-[10px] ml-0.5">×{mapping.times ?? 0}</span>}
                </span>
              )
            })}
          </div>
          {hasSeoCont && (
            <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Standard</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" /> Merged</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400 inline-block" /> Synonym</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tagging Tab ───────────────────────────────────────────────────────────────
export function TaggingTab({ entry, save, saving }: { entry: AttractionEntry; save: (u: Partial<AttractionEntry>) => Promise<void>; saving: boolean }) {
  const [editDomain, setEditDomain] = useState(entry.domain || '')
  const [editP1, setEditP1] = useState(entry.primary_category || '')
  const [editP2, setEditP2] = useState(entry.secondary_category || '')
  const [editP3, setEditP3] = useState(entry.tertiary_category || '')
  const [editP4, setEditP4] = useState(entry.quaternary_category || '')
  const [editTags, setEditTags] = useState((entry.marketing_tags || []).join(', '))

  useEffect(() => {
    setEditDomain(entry.domain || '')
    setEditP1(entry.primary_category || '')
    setEditP2(entry.secondary_category || '')
    setEditP3(entry.tertiary_category || '')
    setEditP4(entry.quaternary_category || '')
    setEditTags((entry.marketing_tags || []).join(', '))
  }, [entry])

  const saveTagging = () => save({
    domain: (editDomain as 'ATTRACTION' | 'EVENT') || null,
    primary_category: editP1 || null, secondary_category: editP2 || null,
    tertiary_category: editP3 || null, quaternary_category: editP4 || null,
    marketing_tags: editTags.split(',').map(t => t.trim()).filter(Boolean),
  })

  const phases = [
    { key: 'gathering', label: 'Phase 1: Gather', desc: 'Fact Sheet compilation', icon: '🔍' },
    { key: 'classifying', label: 'Phase 2: Classify', desc: 'Domain + Categories + Tags', icon: '📋' },
    { key: 'validating', label: 'Phase 3: Validate', desc: '6 gates verification', icon: '🔒' },
    { key: 'completed', label: 'Phase 4: Output', desc: 'Final classification', icon: '✅' },
  ]
  const phaseKeys = phases.map(p => p.key)

  return (
    <div className="space-y-6">
      <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-5">
        <h3 className="text-white font-semibold mb-3">4-Phase Tagging Workflow</h3>
        <div className="grid grid-cols-4 gap-3">
          {phases.map((phase) => {
            const isActive = entry.tagging_status === phase.key
            const isPast = phaseKeys.indexOf(entry.tagging_status) > phaseKeys.indexOf(phase.key)
            return (
              <div key={phase.key} className={`p-3 rounded-lg border transition-all ${
                isActive ? 'border-purple-500/50 bg-purple-500/10' :
                isPast ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-gray-700 bg-gray-800/30'
              }`}>
                <div className="flex items-center gap-2">
                  <span>{phase.icon}</span>
                  <span className={`text-xs font-medium ${isActive ? 'text-purple-400' : isPast ? 'text-emerald-400' : 'text-gray-500'}`}>{phase.label}</span>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">{phase.desc}</p>
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
          <span>Validation: <strong className={entry.validation_gates_passed === 6 ? 'text-emerald-400' : 'text-amber-400'}>{entry.validation_gates_passed}/6</strong> gates</span>
          <span>Loops: <strong>{entry.tagging_loops}/5</strong></span>
          <span>Status: <strong className={entry.tagging_status === 'completed' ? 'text-emerald-400' : 'text-purple-400'}>{entry.tagging_status}</strong></span>
        </div>
      </div>

      <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-5">
        <h3 className="text-white font-semibold mb-4">Classification Output</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Domain</label>
            <select value={editDomain} onChange={e => setEditDomain(e.target.value)} className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
              <option value="">Not set</option>
              <option value="ATTRACTION">ATTRACTION</option>
              <option value="EVENT">EVENT</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">P1 — Primary Category (leaf, mandatory)</label>
            <input value={editP1} onChange={e => setEditP1(e.target.value)} placeholder="e.g. Sightseeing and Tours (Attrs)" className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">P2 — Secondary Category (optional leaf)</label>
            <input value={editP2} onChange={e => setEditP2(e.target.value)} placeholder="e.g. Indoor Attractions (Attrs)" className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">P3 — Tertiary Category (optional leaf)</label>
            <input value={editP3} onChange={e => setEditP3(e.target.value)} placeholder="e.g. Must-see Attractions (Attrs)" className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">P4 — Quaternary Category (optional leaf)</label>
            <input value={editP4} onChange={e => setEditP4(e.target.value)} placeholder="null" className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-400 mb-1">Marketing Tags (comma-separated)</label>
            <input value={editTags} onChange={e => setEditTags(e.target.value)} placeholder="Attractions, Tours, Family, Kids, ..." className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
        </div>
        <button onClick={saveTagging} disabled={saving} className="mt-4 px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors">
          {saving ? 'Saving...' : 'Save Classification'}
        </button>
      </div>

      {Object.keys(entry.fact_sheet).length > 0 && (
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-5">
          <h3 className="text-white font-semibold mb-3">Fact Sheet (Phase 1 Output)</h3>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(entry.fact_sheet).map(([key, value]) => (
              <div key={key} className="bg-gray-900/40 rounded-lg px-3 py-2">
                <span className="text-xs text-gray-500 font-medium">{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                <p className="text-gray-300 text-sm mt-0.5">{Array.isArray(value) ? value.join(', ') : String(value)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {entry.tagging_log && entry.tagging_log.length > 0 && (
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-5">
          <h3 className="text-white font-semibold mb-3">Tagging Log</h3>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {entry.tagging_log.map((log, i) => (
              <pre key={i} className="text-gray-400 text-xs font-mono bg-gray-900/30 p-2 rounded">{JSON.stringify(log, null, 2)}</pre>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Review Tab ────────────────────────────────────────────────────────────────
export function ReviewTab({ entry, save, saving, advanceStage }: { entry: AttractionEntry; save: (u: Partial<AttractionEntry>) => Promise<void>; saving: boolean; advanceStage: () => Promise<void> }) {
  const [reviewNotes, setReviewNotes] = useState(entry.review_notes || '')

  useEffect(() => { setReviewNotes(entry.review_notes || '') }, [entry])

  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6">
      <h3 className="text-white font-semibold mb-4">Review &amp; Approval</h3>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900/50 rounded-lg p-4">
          <p className="text-gray-400 text-xs mb-1">Domain</p>
          <p className="text-white font-medium">{entry.domain || 'Not classified'}</p>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-4">
          <p className="text-gray-400 text-xs mb-1">Primary Category</p>
          <p className="text-white font-medium">{entry.primary_category || 'Not set'}</p>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-4">
          <p className="text-gray-400 text-xs mb-1">Validation</p>
          <p className={`font-medium ${entry.validation_gates_passed === 6 ? 'text-emerald-400' : 'text-amber-400'}`}>{entry.validation_gates_passed}/6 gates passed</p>
        </div>
      </div>
      {(entry.assigned_writer || entry.assigned_translator) && (
        <div className="flex items-center gap-4 mb-4 text-xs text-gray-400">
          {entry.assigned_writer && <span>✍️ Writer: <strong className="text-white">{entry.assigned_writer}</strong></span>}
          {entry.assigned_translator && <span>🌐 Translator: <strong className="text-white">{entry.assigned_translator}</strong></span>}
        </div>
      )}
      <div className="mb-4">
        <label className="block text-xs text-gray-400 mb-1">Review Notes</label>
        <textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} rows={4} placeholder="Add notes, flag issues, or approve..." className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => save({ review_notes: reviewNotes || null })} disabled={saving} className="px-4 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-500 disabled:opacity-50 transition-colors">Save Notes</button>
        {entry.stage === 'review' && (
          <button onClick={advanceStage} className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors">Approve &amp; Export ⚡</button>
        )}
      </div>
      {entry.reviewed_at && (
        <p className="text-gray-500 text-xs mt-3">Last reviewed: {new Date(entry.reviewed_at).toLocaleString()} {entry.reviewed_by && `by ${entry.reviewed_by}`}</p>
      )}
    </div>
  )
}
