'use client'

import { useState, useEffect } from 'react'
import type { AttractionEntry } from './page'

// ── SEO Tab ────────────────────────────────────────────────────
export function SeoTab({ entry }: { entry: AttractionEntry }) {
  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold">SEO Optimization — Column D Rewrite</h3>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          entry.seo_status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
          entry.seo_status === 'processing' ? 'bg-amber-500/20 text-amber-400' :
          'bg-gray-600/30 text-gray-400'
        }`}>{entry.seo_status}</span>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h4 className="text-gray-400 text-xs font-medium mb-2 uppercase tracking-wide">Original Content (Column C)</h4>
          <div className="bg-gray-900/50 rounded-lg p-4 text-gray-300 text-sm whitespace-pre-wrap max-h-[500px] overflow-y-auto font-mono text-xs">
            {entry.raw_text || 'No content yet'}
          </div>
        </div>
        <div>
          <h4 className="text-gray-400 text-xs font-medium mb-2 uppercase tracking-wide">SEO Optimised (Column D)</h4>
          <div className="bg-gray-900/50 rounded-lg p-4 text-gray-300 text-sm whitespace-pre-wrap max-h-[500px] overflow-y-auto font-mono text-xs">
            {Object.keys(entry.seo_content).length > 0
              ? JSON.stringify(entry.seo_content, null, 2)
              : 'Not yet processed — advance to SEO stage to begin optimization'}
          </div>
        </div>
      </div>
      {entry.keywords_list && (
        <div className="mt-4 pt-4 border-t border-gray-700/50">
          <h4 className="text-gray-400 text-xs font-medium mb-2 uppercase tracking-wide">Keywords ({entry.keywords_used}/{entry.keywords_total} used)</h4>
          <div className="bg-gray-900/50 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-700/50">
                  <th className="text-left px-3 py-2 text-gray-500 font-medium w-16">#</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Keyword</th>
                </tr>
              </thead>
              <tbody>
                {entry.keywords_list.split('\n').filter(Boolean).map((kw, i) => (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-3 py-1.5 text-blue-400 font-mono font-medium">{i + 1}</td>
                    <td className="px-3 py-1.5 text-blue-300">{i + 1} ({kw.trim()})</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tagging Tab ───────────────────────────────────────────────
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
          <pre className="text-gray-300 text-xs font-mono bg-gray-900/50 rounded-lg p-4 overflow-x-auto">{JSON.stringify(entry.fact_sheet, null, 2)}</pre>
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

// ── Review Tab ─────────────────────────────────────────────────
export function ReviewTab({ entry, save, saving, advanceStage }: { entry: AttractionEntry; save: (u: Partial<AttractionEntry>) => Promise<void>; saving: boolean; advanceStage: () => Promise<void> }) {
  const [reviewNotes, setReviewNotes] = useState(entry.review_notes || '')

  useEffect(() => { setReviewNotes(entry.review_notes || '') }, [entry])

  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6">
      <h3 className="text-white font-semibold mb-4">Review & Approval</h3>
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
      <div className="mb-4">
        <label className="block text-xs text-gray-400 mb-1">Review Notes</label>
        <textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} rows={4} placeholder="Add notes, flag issues, or approve..." className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => save({ review_notes: reviewNotes || null })} disabled={saving} className="px-4 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-500 disabled:opacity-50 transition-colors">Save Notes</button>
        {entry.stage === 'review' && (
          <button onClick={advanceStage} className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors">Approve & Export →</button>
        )}
      </div>
      {entry.reviewed_at && (
        <p className="text-gray-500 text-xs mt-3">Last reviewed: {new Date(entry.reviewed_at).toLocaleString()} {entry.reviewed_by && `by ${entry.reviewed_by}`}</p>
      )}
    </div>
  )
}
