'use client'

import { useState, useEffect } from 'react'
import type { AttractionEntry } from './page'

function StatusRow({ label, value, color, icon }: { label: string; value: string; color: string; icon?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-400 text-xs">{label}</span>
      <span className={`text-sm font-medium ${color}`}>{icon && `${icon} `}{value}</span>
    </div>
  )
}

const STAGE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  intake: { label: 'Intake', icon: '📥', color: 'text-blue-400' },
  seo_optimization: { label: 'SEO Optimization', icon: '✍️', color: 'text-amber-400' },
  tagging: { label: 'Tagging', icon: '🏷️', color: 'text-purple-400' },
  review: { label: 'Review', icon: '✅', color: 'text-emerald-400' },
  exported: { label: 'Exported', icon: '📤', color: 'text-gray-400' },
}

export function OverviewTab({ entry, save, saving }: { entry: AttractionEntry; save: (u: Partial<AttractionEntry>) => Promise<void>; saving: boolean }) {
  const [editTitle, setEditTitle] = useState(entry.title)
  const [editUrl, setEditUrl] = useState(entry.url || '')
  const [editRawText, setEditRawText] = useState(entry.raw_text || '')
  const [editKeywords, setEditKeywords] = useState(entry.keywords_list || '')
  const [editCountry, setEditCountry] = useState(entry.country || '')
  const [editCity, setEditCity] = useState(entry.city || '')

  useEffect(() => {
    setEditTitle(entry.title)
    setEditUrl(entry.url || '')
    setEditRawText(entry.raw_text || '')
    setEditKeywords(entry.keywords_list || '')
    setEditCountry(entry.country || '')
    setEditCity(entry.city || '')
  }, [entry])

  const saveIntake = () => save({
    title: editTitle, url: editUrl || null, raw_text: editRawText || null,
    keywords_list: editKeywords || null, country: editCountry || null, city: editCity || null,
  })

  const meta = STAGE_LABELS[entry.stage] || STAGE_LABELS.intake

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-5 space-y-4">
        <h3 className="text-white font-semibold text-sm">Intake Data</h3>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Title</label>
          <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">URL</label>
          <input value={editUrl} onChange={e => setEditUrl(e.target.value)} className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Country</label>
            <input value={editCountry} onChange={e => setEditCountry(e.target.value)} className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">City</label>
            <input value={editCity} onChange={e => setEditCity(e.target.value)} className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Keywords</label>
          <textarea value={editKeywords} onChange={e => setEditKeywords(e.target.value)} rows={3} className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Raw Content (Column C)</label>
          <textarea value={editRawText} onChange={e => setEditRawText(e.target.value)} rows={6} className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono text-xs" />
        </div>
        <button onClick={saveIntake} disabled={saving} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {saving ? 'Saving...' : 'Save Intake Data'}
        </button>
      </div>

      <div className="space-y-4">
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-5">
          <h3 className="text-white font-semibold text-sm mb-3">Pipeline Status</h3>
          <div className="space-y-3">
            <StatusRow label="Stage" value={meta.label} color={meta.color} icon={meta.icon} />
            <StatusRow label="SEO Status" value={entry.seo_status} color={entry.seo_status === 'completed' ? 'text-emerald-400' : 'text-gray-400'} />
            {entry.keywords_total > 0 && <StatusRow label="Keywords" value={`${entry.keywords_used} / ${entry.keywords_total}`} color="text-amber-400" />}
            <StatusRow label="Tagging Status" value={entry.tagging_status} color={entry.tagging_status === 'completed' ? 'text-emerald-400' : 'text-gray-400'} />
            <StatusRow label="Validation Gates" value={`${entry.validation_gates_passed} / 6`} color={entry.validation_gates_passed === 6 ? 'text-emerald-400' : 'text-amber-400'} />
            <StatusRow label="Tagging Loops" value={`${entry.tagging_loops}`} color="text-gray-400" />
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-5">
          <h3 className="text-white font-semibold text-sm mb-3">Classification</h3>
          <div className="space-y-3">
            <StatusRow label="Domain" value={entry.domain || 'Not set'} color={entry.domain ? 'text-blue-400' : 'text-gray-500'} />
            <StatusRow label="P1 (Primary)" value={entry.primary_category || 'Not set'} color={entry.primary_category ? 'text-purple-400' : 'text-gray-500'} />
            <StatusRow label="P2 (Secondary)" value={entry.secondary_category || 'null'} color="text-gray-400" />
            <StatusRow label="P3 (Tertiary)" value={entry.tertiary_category || 'null'} color="text-gray-400" />
            <StatusRow label="P4 (Quaternary)" value={entry.quaternary_category || 'null'} color="text-gray-400" />
          </div>
          {entry.marketing_tags && entry.marketing_tags.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-700/50">
              <p className="text-xs text-gray-400 mb-2">Marketing Tags</p>
              <div className="flex flex-wrap gap-1">
                {entry.marketing_tags.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 bg-purple-500/10 text-purple-400 text-xs rounded-full border border-purple-500/20">{tag}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-5">
          <h3 className="text-white font-semibold text-sm mb-2">Metadata</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-gray-400">Created</span><span className="text-gray-300">{new Date(entry.created_at).toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Updated</span><span className="text-gray-300">{new Date(entry.updated_at).toLocaleString()}</span></div>
            {entry.excel_sheet_name && <div className="flex justify-between"><span className="text-gray-400">Sheet</span><span className="text-gray-300">{entry.excel_sheet_name}</span></div>}
            {entry.batch_name && <div className="flex justify-between"><span className="text-gray-400">Batch</span><span className="text-gray-300">{entry.batch_name}</span></div>}
          </div>
        </div>
      </div>
    </div>
  )
}
