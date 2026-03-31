'use client'

import { useState } from 'react'
import Link from 'next/link'

type AttractionStage = 'intake' | 'seo_optimization' | 'tagging' | 'review' | 'exported'
type SeoStatus = 'pending' | 'processing' | 'completed' | 'failed'
type TaggingStatus = 'pending' | 'gathering' | 'classifying' | 'validating' | 'completed' | 'failed' | 'unclassifiable'

interface AttractionEntry {
  id: string
  title: string
  city: string | null
  country: string | null
  stage: AttractionStage
  seo_status: SeoStatus
  keywords_used: number
  keywords_total: number
  tagging_status: TaggingStatus
  validation_gates_passed: number
  batch_name: string | null
  updated_at: string
}

interface StageConfig {
  key: AttractionStage
  label: string
  color: string
  bgColor: string
}

export function AttractionCard({
  entry,
  stageConfig,
  onAdvance,
  onDelete,
}: {
  entry: AttractionEntry
  stageConfig: StageConfig
  onAdvance: () => void
  onDelete: () => void
}) {
  const [showMenu, setShowMenu] = useState(false)

  return (
    <div className="bg-gray-800/80 rounded-lg border border-gray-700/50 p-3 hover:border-gray-600 transition-all group">
      <Link href={`/dashboard/attractions/${entry.id}`} className="block">
        <h4 className="text-white text-sm font-medium truncate group-hover:text-blue-400 transition-colors">
          {entry.title}
        </h4>
        {entry.city && (
          <p className="text-gray-500 text-xs mt-0.5">{entry.city}{entry.country ? `, ${entry.country}` : ''}</p>
        )}
      </Link>

      <div className="flex items-center gap-2 mt-2">
        {entry.stage === 'seo_optimization' && <SeoStatusBadge status={entry.seo_status} used={entry.keywords_used} total={entry.keywords_total} />}
        {entry.stage === 'tagging' && <TaggingStatusBadge status={entry.tagging_status} gates={entry.validation_gates_passed} />}
        {entry.batch_name && (
          <span className="text-gray-500 text-[10px] bg-gray-700/50 px-1.5 py-0.5 rounded truncate max-w-[100px]">{entry.batch_name}</span>
        )}
      </div>

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-700/30">
        <span className="text-gray-600 text-[10px]">{new Date(entry.updated_at).toLocaleDateString()}</span>
        <div className="flex items-center gap-1">
          {entry.stage !== 'exported' && (
            <button onClick={onAdvance} className="text-[10px] text-emerald-400 hover:text-emerald-300 px-1.5 py-0.5 rounded hover:bg-emerald-500/10" title="Advance to next stage">
              Next →
            </button>
          )}
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="text-gray-500 hover:text-gray-300 px-1">•••</button>
            {showMenu && (
              <div className="absolute right-0 top-6 bg-gray-700 border border-gray-600 rounded-lg shadow-xl z-10 py-1 min-w-[120px]">
                <Link href={`/dashboard/attractions/${entry.id}`} className="block px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-600">
                  Open
                </Link>
                <button onClick={() => { onDelete(); setShowMenu(false) }} className="block w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-gray-600">
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function SeoStatusBadge({ status, used, total }: { status: string; used: number; total: number }) {
  const colors: Record<string, string> = {
    pending: 'bg-gray-600/30 text-gray-400',
    processing: 'bg-amber-500/20 text-amber-400',
    completed: 'bg-emerald-500/20 text-emerald-400',
    failed: 'bg-red-500/20 text-red-400',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[status] || colors.pending}`}>
      {status === 'completed' && total > 0 ? `${used}/${total} kw` : status}
    </span>
  )
}

export function TaggingStatusBadge({ status, gates }: { status: string; gates: number }) {
  const colors: Record<string, string> = {
    pending: 'bg-gray-600/30 text-gray-400',
    gathering: 'bg-blue-500/20 text-blue-400',
    classifying: 'bg-purple-500/20 text-purple-400',
    validating: 'bg-amber-500/20 text-amber-400',
    completed: 'bg-emerald-500/20 text-emerald-400',
    failed: 'bg-red-500/20 text-red-400',
    unclassifiable: 'bg-red-500/20 text-red-400',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[status] || colors.pending}`}>
      {status === 'completed' ? `${gates}/6 gates` : status}
    </span>
  )
}
