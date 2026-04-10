'use client'

import { useState, useEffect, useCallback } from 'react'
import { plSupabase } from '@/lib/pl-supabase'
import Link from 'next/link'
import { AttractionCard, SeoStatusBadge, TaggingStatusBadge } from './attraction-components'
import { AttractionModal } from './attraction-modal'
import BatchToolbar from '@/components/BatchToolbar'

type AttractionStage = 'intake' | 'seo_optimization' | 'tagging' | 'review' | 'exported'
type SeoStatus = 'pending' | 'processing' | 'completed' | 'failed'
type TaggingStatus = 'pending' | 'gathering' | 'classifying' | 'validating' | 'completed' | 'failed' | 'unclassifiable'

interface AttractionEntry {
  id: string
  title: string
  url: string | null
  country: string | null
  city: string | null
  stage: AttractionStage
  seo_status: SeoStatus
  keywords_used: number
  keywords_total: number
  tagging_status: TaggingStatus
  validation_gates_passed: number
  batch_name: string | null
  created_at: string
  updated_at: string
}

interface StageConfig {
  key: AttractionStage
  label: string
  color: string
  bgColor: string
  borderColor: string
  icon: string
}

const STAGES: StageConfig[] = [
  { key: 'intake', label: 'Intake', color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30', icon: '●' },
  { key: 'seo_optimization', label: 'SEO Optimization', color: 'text-amber-400', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/30', icon: '◆' },
  { key: 'tagging', label: 'Tagging', color: 'text-purple-400', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/30', icon: '▲' },
  { key: 'review', label: 'Review', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/30', icon: '★' },
  { key: 'exported', label: 'Exported', color: 'text-gray-400', bgColor: 'bg-gray-500/10', borderColor: 'border-gray-500/30', icon: '✓' },
]

async function downloadTemplate() {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  const sheetData = [
    ['Title', 'Dubai Aquarium & Underwater Zoo'],
    ['URL', 'https://www.example.com/dubai-aquarium'],
    ['Country', 'UAE'],
    ['City', 'Dubai'],
    ['Keywords', 'dubai aquarium, underwater zoo, dubai mall aquarium, things to do in dubai'],
    ['Description', 'Explore one of the largest suspended aquariums in the world, home to hundreds of species of aquatic animals including sharks and rays. Located inside The Dubai Mall.'],
    [],
    ['─── Instructions ───', ''],
    ['• Each sheet = one attraction', ''],
    ['• Column A = field label, Column B = value', ''],
    ['• Title is required, other fields are optional', ''],
    ['• Keywords field is optional (used for SEO)', ''],
    ['• Duplicate the sheet for multiple attractions', ''],
    ['• Delete this instructions section before submitting', ''],
  ]

  const ws = XLSX.utils.aoa_to_sheet(sheetData)
  ws['!cols'] = [{ wch: 22 }, { wch: 70 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Attraction Name Here')

  const sheetData2 = [
    ['Title', 'Burj Khalifa At The Top'],
    ['URL', 'https://www.example.com/burj-khalifa'],
    ['Country', 'UAE'],
    ['City', 'Dubai'],
    ['Keywords', 'burj khalifa tickets, at the top, tallest building, dubai observation deck'],
    ['Description', 'Visit the observation deck of the world\'s tallest building for panoramic views of Dubai. Choose from Level 124, 125, or the premium Level 148 experience.'],
  ]

  const ws2 = XLSX.utils.aoa_to_sheet(sheetData2)
  ws2['!cols'] = [{ wch: 22 }, { wch: 70 }]
  XLSX.utils.book_append_sheet(wb, ws2, 'Burj Khalifa')

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'attraction-template.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}

export default function AttractionsFunnel() {
  const [entries, setEntries] = useState<AttractionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'funnel' | 'list'>('funnel')
  const [showNewForm, setShowNewForm] = useState(false)
  const [filterStage, setFilterStage] = useState<AttractionStage | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBatch, setSelectedBatch] = useState<string | 'all'>('all')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    const { data } = await plSupabase.from('attractions').select('*').order('created_at', { ascending: false })
    if (data) setEntries(data as AttractionEntry[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  const advanceStage = async (id: string, currentStage: AttractionStage) => {
    const order: AttractionStage[] = ['intake', 'seo_optimization', 'tagging', 'review', 'exported']
    const idx = order.indexOf(currentStage)
    if (idx >= order.length - 1) return
    const nextStage = order[idx + 1]

    // Fetch full entry data for validation
    const { data: fullEntry } = await plSupabase.from('attractions').select('*').eq('id', id).single()
    if (!fullEntry) return

    // Gate: Intake -> SEO Optimization
    if (currentStage === 'intake' && nextStage === 'seo_optimization') {
      if (!fullEntry.raw_text || fullEntry.raw_text.trim() === '') {
        window.alert('Cannot advance: Raw Content (Column C) must be populated first.')
        return
      }
    }

    // Gate: SEO Optimization -> Tagging
    if (currentStage === 'seo_optimization' && nextStage === 'tagging') {
      if (fullEntry.seo_status !== 'completed') {
        window.alert('Cannot advance: SEO optimization must be completed first.')
        return
      }
      if (!fullEntry.seo_content || Object.keys(fullEntry.seo_content).length === 0) {
        window.alert('Cannot advance: SEO content (Column D) must have data.')
        return
      }
    }

    // Gate: Tagging -> Review
    if (currentStage === 'tagging' && nextStage === 'review') {
      if (fullEntry.tagging_status !== 'completed') {
        window.alert('Cannot advance: Tagging must be completed first.')
        return
      }
      if (fullEntry.validation_gates_passed !== 6) {
        window.alert('Cannot advance: All 6 validation gates must pass first.')
        return
      }
    }

    const { error } = await plSupabase.from('attractions').update({ stage: nextStage }).eq('id', id)
    if (!error) fetchEntries()
  }

  const deleteEntry = async (id: string) => {
    const { error } = await plSupabase.from('attractions').delete().eq('id', id)
    if (!error) fetchEntries()
  }

  const batches = [...new Set(entries.filter(e => e.batch_name).map(e => e.batch_name!))]
  const filtered = entries.filter(e => {
    if (filterStage !== 'all' && e.stage !== filterStage) return false
    if (selectedBatch !== 'all' && e.batch_name !== selectedBatch) return false
    if (searchQuery && !e.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  const entriesByStage = (stage: AttractionStage) => filtered.filter(e => e.stage === stage)
  const stageCounts = STAGES.map(s => ({ ...s, count: entries.filter(e => e.stage === s.key).length }))

  return (
    <div className="min-h-screen p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Attractions Funnel</h1>
          <p className="text-gray-400 text-sm mt-1">{entries.length} attractions</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-800 rounded-lg p-1">
                        <button onClick={() => setView('list')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'list' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>
              List
            </button>
          </div>
          <button onClick={downloadTemplate} className="px-4 py-2 bg-gray-700 text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-600 transition-colors border border-gray-600">
            ↓ Template
          </button>
          <button onClick={() => setShowNewForm(true)} className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm font-medium rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all">
            + Add
          </button>
        </div>
      </div>

      
      <div className="flex items-center gap-3 mb-6">
        <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1 px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        {batches.length > 0 && (
          <select value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)} className="px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">All batches</option>
            {batches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        )}
        {filterStage !== 'all' && <button onClick={() => setFilterStage('all')} className="px-3 py-2 bg-gray-700 text-gray-300 text-sm rounded-lg hover:bg-gray-600">Clear</button>}
      </div>

      {loading && <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div></div>}

      
      {!loading && view === 'list' && (
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="p-3 w-8"></th>
                <th className="text-left p-3 text-gray-400 font-medium">Title</th>
                <th className="text-left p-3 text-gray-400 font-medium">Stage</th>
                <th className="text-left p-3 text-gray-400 font-medium">SEO</th>
                <th className="text-left p-3 text-gray-400 font-medium">Tag</th>
                <th className="text-left p-3 text-gray-400 font-medium">Batch</th>
                <th className="text-left p-3 text-gray-400 font-medium">Updated</th>
                <th className="text-right p-3 text-gray-400 font-medium">Act</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => {
                const stageConf = STAGES.find(s => s.key === entry.stage)!
                return (
                  <tr key={entry.id} className="border-b border-gray-700/50 hover:bg-gray-700/20 transition-colors">
                  <td className="p-3 w-8">
                    <label className="flex items-center justify-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(entry.id)}
                      onChange={() => setSelectedIds(prev =>
                        prev.includes(entry.id) ? prev.filter(i => i !== entry.id) : [...prev, entry.id]
                      )}
                      className="rounded border-gray-600 bg-white/5 text-orange-500 focus:ring-orange-500 cursor-pointer"
                    />
                    </label>
                  </td>
                    <td className="p-3"><Link href={`/dashboard/attractions/${entry.id}`} className="text-white hover:text-blue-400 font-medium">{entry.title}</Link>{entry.city && <span className="text-gray-500 text-xs ml-2">{entry.city}{entry.country ? `, ${entry.country}` : ''}</span>}</td>
                    <td className="p-3"><span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${stageConf.bgColor} ${stageConf.color}`}><span>{stageConf.icon}</span> {stageConf.label}</span></td>
                    <td className="p-3"><SeoStatusBadge status={entry.seo_status} used={entry.keywords_used} total={entry.keywords_total} /></td>
                    <td className="p-3"><TaggingStatusBadge status={entry.tagging_status} gates={entry.validation_gates_passed} /></td>
                    <td className="p-3 text-gray-400 text-xs">{entry.batch_name || '—'}</td>
                    <td className="p-3 text-gray-500 text-xs">{new Date(entry.updated_at).toLocaleDateString()}</td>
                    <td className="p-3 text-right"><div className="flex items-center justify-end gap-2"><Link href={`/dashboard/attractions/${entry.id}`} className="text-blue-400 hover:text-blue-300 text-xs">Open</Link>{entry.stage !== 'exported' && <button onClick={() => advanceStage(entry.id, entry.stage)} className="text-emerald-400 hover:text-emerald-300 text-xs">Adv</button>}</div></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-gray-500 text-center py-12">No attractions</p>}
        </div>
      )}

      <BatchToolbar selectedIds={selectedIds} type="attractions" onClear={() => setSelectedIds([])} />
      <AttractionModal show={showNewForm} onClose={() => setShowNewForm(false)} onSuccess={fetchEntries} />
    </div>
  )
}
