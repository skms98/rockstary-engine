'use client'

import { useState } from 'react'
import { plSupabase } from '@/lib/pl-supabase'
import { parseAttractionExcel, type AttractionParsedRow } from '@/lib/attraction-excel-parser'

type AttractionStage = 'intake' | 'seo_optimization' | 'tagging' | 'review' | 'exported'

interface AttractionModalProps {
  show: boolean
  onClose: () => void
  onSuccess: () => void
}

export function AttractionModal({ show, onClose, onSuccess }: AttractionModalProps) {
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [excelPreview, setExcelPreview] = useState<AttractionParsedRow[]>([])
  const [importingExcel, setImportingExcel] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    url: '',
    raw_text: '',
    keywords_list: '',
    country: '',
    city: '',
  })
  const [submitting, setSubmitting] = useState(false)
  // DB import state
  const [dbSearch, setDbSearch] = useState('')
  const [dbResults, setDbResults] = useState<{event_id:string;event_name_en:string;url:string;country:string;city:string}[]>([])
  const [dbSelected, setDbSelected] = useState<Set<string>>(new Set())
  const [dbSearching, setDbSearching] = useState(false)
  const [dbImporting, setDbImporting] = useState(false)

  const searchDb = async (q: string) => {
    if (!q.trim()) { setDbResults([]); return }
    setDbSearching(true)
    try {
      const res = await fetch(`/api/events-db?search=${encodeURIComponent(q)}&type=attraction&page=1`)
      const data = await res.json()
      setDbResults(data.events || [])
    } catch { setDbResults([]) }
    setDbSearching(false)
  }

  const handleDbImport = async () => {
    if (dbSelected.size === 0) return
    setDbImporting(true)
    const toImport = dbResults.filter(r => dbSelected.has(String(r.event_id)))
    const inserts = toImport.map(r => ({
      title: r.event_name_en || '',
      url: r.url || null,
      country: r.country || null,
      city: r.city || null,
      attraction_id: String(r.event_id),
      stage: 'intake' as AttractionStage,
    }))
    const { error } = await plSupabase.from('attractions').insert(inserts)
    if (!error) {
      setDbSearch(''); setDbResults([]); setDbSelected(new Set())
      onSuccess(); onClose()
    }
    setDbImporting(false)
  }

  const handleExcelUpload = async (file: File) => {
    setExcelFile(file)
    try {
      const buffer = await file.arrayBuffer()
      const rows = await parseAttractionExcel(buffer)
      setExcelPreview(rows)
    } catch {
      setExcelPreview([])
    }
  }

  const importExcelSheets = async () => {
    if (!excelFile || excelPreview.length === 0) return
    setImportingExcel(true)
    const batchId = crypto.randomUUID()
    const batchName = excelFile.name.replace(/\.xlsx?$/i, '')
    const now = new Date().toISOString()

    const inserts = excelPreview.map((row) => ({
      title: row.title || row.sheetName || 'Untitled',
      url: row.url || null,
      country: row.country || null,
      city: row.city || null,
      stage: 'intake' as AttractionStage,
      raw_text: row.rawText || null,
      keywords_list: row.keywords || null,
      excel_sheet_name: row.sheetName || null,
      original_content: row.sections || {},
      batch_id: batchId,
      batch_name: batchName,
      created_at: now,
    }))

    const { error } = await plSupabase.from('attractions').insert(inserts)
    if (!error) {
      setExcelFile(null)
      setExcelPreview([])
      onSuccess()
      onClose()
    }
    setImportingExcel(false)
  }

  const handleManualAdd = async () => {
    if (!formData.title.trim()) return
    setSubmitting(true)
    const { error } = await plSupabase.from('attractions').insert({
      title: formData.title.trim(),
      url: formData.url.trim() || null,
      raw_text: formData.raw_text.trim() || null,
      keywords_list: formData.keywords_list.trim() || null,
      country: formData.country.trim() || null,
      city: formData.city.trim() || null,
      stage: 'intake',
    })
    if (!error) {
      setFormData({ title: '', url: '', raw_text: '', keywords_list: '', country: '', city: '' })
      onSuccess()
      onClose()
    }
    setSubmitting(false)
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Add Attraction to Funnel</h2>
          <p className="text-gray-400 text-sm mt-1">Upload an Excel file or add manually</p>
        </div>

        <div className="p-6 space-y-6">
          {/* DB Import */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">🗄️ Search from Platinumlist Database</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={dbSearch}
                onChange={e => setDbSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchDb(dbSearch)}
                placeholder="Search attraction name…"
                className="flex-1 px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="button" onClick={() => searchDb(dbSearch)} disabled={dbSearching}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {dbSearching ? '…' : 'Search'}
              </button>
            </div>
            {dbResults.length > 0 && (
              <div className="max-h-52 overflow-y-auto space-y-1 border border-gray-600 rounded-xl p-2 bg-gray-900/40">
                {dbResults.map(r => (
                  <label key={r.event_id} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${dbSelected.has(String(r.event_id)) ? 'bg-blue-600/20 border border-blue-500/40' : 'hover:bg-gray-700/40'}`}>
                    <input type="checkbox" checked={dbSelected.has(String(r.event_id))}
                      onChange={e => { const s = new Set(dbSelected); e.target.checked ? s.add(String(r.event_id)) : s.delete(String(r.event_id)); setDbSelected(s) }}
                      className="accent-blue-500" />
                    <span className="text-blue-400 font-mono text-xs px-1.5 py-0.5 bg-blue-900/30 rounded shrink-0">#{r.event_id}</span>
                    <span className="text-sm text-white flex-1 truncate">{r.event_name_en}</span>
                    <span className="text-xs text-gray-400 shrink-0">{r.city}</span>
                  </label>
                ))}
              </div>
            )}
            {dbSelected.size > 0 && (
              <button type="button" onClick={handleDbImport} disabled={dbImporting}
                className="w-full mt-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {dbImporting ? 'Importing…' : `Import ${dbSelected.size} Attraction${dbSelected.size > 1 ? 's' : ''} from DB`}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-gray-700"></div>
            <span className="text-gray-500 text-xs">OR UPLOAD EXCEL</span>
            <div className="flex-1 border-t border-gray-700"></div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Excel Upload (one sheet per attraction)</label>
            <div className="border-2 border-dashed border-gray-600 rounded-xl p-6 text-center hover:border-blue-500/50 transition-colors">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => e.target.files?.[0] && handleExcelUpload(e.target.files[0])}
                className="hidden"
                id="excel-upload"
              />
              <label htmlFor="excel-upload" className="cursor-pointer">
                <div className="text-3xl mb-2">📊</div>
                <p className="text-gray-300 text-sm font-medium">{excelFile ? excelFile.name : 'Drop .xlsx or click to upload'}</p>
                {excelPreview.length > 0 && (
                  <p className="text-blue-400 text-xs mt-1">{excelPreview.length} sheets detected</p>
                )}
              </label>
            </div>
            {excelPreview.length > 0 && (
              <div className="mt-3 space-y-1">
                {excelPreview.map((row, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-400 bg-gray-700/30 px-3 py-1.5 rounded-lg">
                    <span className="text-blue-400 font-mono">{row.sheetName}</span>
                    <span>{row.title || 'Untitled'}</span>
                  </div>
                ))}
                <button
                  onClick={importExcelSheets}
                  disabled={importingExcel}
                  className="w-full mt-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {importingExcel ? 'Importing...' : `Import ${excelPreview.length} Attractions`}
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-gray-700"></div>
            <span className="text-gray-500 text-xs">OR ADD MANUALLY</span>
            <div className="flex-1 border-t border-gray-700"></div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Attraction Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Warner Bros. Studio Tour London"
                className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">URL</label>
                <input
                  type="text"
                  value={formData.url}
                  onChange={(e) => setFormData(f => ({ ...f, url: e.target.value }))}
                  placeholder="https://platinumlist.net/..."
                  className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Country</label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData(f => ({ ...f, country: e.target.value }))}
                    placeholder="UAE"
                    className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData(f => ({ ...f, city: e.target.value }))}
                    placeholder="Dubai"
                    className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Keywords List</label>
              <textarea
                value={formData.keywords_list}
                onChange={(e) => setFormData(f => ({ ...f, keywords_list: e.target.value }))}
                placeholder="One keyword per line..."
                rows={3}
                className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Raw Content (Column C)</label>
              <textarea
                value={formData.raw_text}
                onChange={(e) => setFormData(f => ({ ...f, raw_text: e.target.value }))}
                placeholder="Paste the original content here..."
                rows={5}
                className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <button
              onClick={handleManualAdd}
              disabled={!formData.title.trim() || submitting}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm font-medium rounded-lg hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 transition-all"
            >
              {submitting ? 'Adding...' : 'Add to Intake'}
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-gray-700 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-gray-400 text-sm hover:text-white transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
