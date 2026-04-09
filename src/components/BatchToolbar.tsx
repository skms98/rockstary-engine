'use client'

import { useState } from 'react'
import VariableLoader from './VariableLoader'

interface BatchToolbarProps {
  selectedIds: string[]
  type: 'events' | 'attractions'
  onClear: () => void
}

export default function BatchToolbar({ selectedIds, type, onClear }: BatchToolbarProps) {
  const [variables, setVariables] = useState<Record<string, unknown>>({
    authToken: '',
    adminKey: '',
    mode: 'b2c',
    steps: ['seo', 'classify']
  })
  const [showVarLoader, setShowVarLoader] = useState(false)
  const [running, setRunning] = useState(false)

  if (selectedIds.length === 0) return null

  const handleRunBatch = async () => {
    setRunning(true)
    try {
      // 1. Create the persistent job record
      const createRes = await fetch('/api/batch/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          item_ids: selectedIds,
          variables,
          label: `${type} batch — ${selectedIds.length} item${selectedIds.length !== 1 ? 's' : ''}`
        })
      })
      const { jobId } = await createRes.json()

      // 2. Fire-and-forget: start parallel AI run in background
      fetch('/api/batch/run-many', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId })
      }).catch(console.error)

      // 3. Go to batch jobs page to watch progress
      window.location.href = '/dashboard/batch-jobs'
    } catch (err) {
      alert('Failed to start batch: ' + String(err))
      setRunning(false)
    }
  }

  const hasToken = Boolean(variables.authToken)

  return (
    <>
      {showVarLoader && (
        <VariableLoader
          type={type}
          variables={variables}
          onApply={(v) => { setVariables(v); setShowVarLoader(false) }}
          onClose={() => setShowVarLoader(false)}
        />
      )}

      {/* Floating bottom toolbar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#0e0e1a] border border-orange-500/30 rounded-2xl px-5 py-3.5 shadow-2xl shadow-black/60 backdrop-blur-sm">
        {/* Selection count */}
        <div className="flex items-center gap-2 pr-1">
          <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
          <span className="text-white font-semibold text-sm">
            {selectedIds.length} {type === 'events' ? 'event' : 'attraction'}{selectedIds.length !== 1 ? 's' : ''} selected
          </span>
        </div>

        <div className="w-px h-5 bg-white/10" />

        {/* Variables button */}
        <button
          onClick={() => setShowVarLoader(true)}
          className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
        >
          <span>⚙</span>
          <span>Variables</span>
          <span className={`w-1.5 h-1.5 rounded-full ml-0.5 ${hasToken ? 'bg-green-400' : 'bg-yellow-400'}`} />
        </button>

        {/* Run button */}
        <button
          onClick={handleRunBatch}
          disabled={running}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all"
        >
          {running ? (
            <><span className="inline-block animate-spin">⟳</span> Starting…</>
          ) : (
            <>▶ Run AI Batch</>
          )}
        </button>

        {/* Clear selection */}
        <button
          onClick={onClear}
          className="text-gray-500 hover:text-gray-300 text-lg leading-none transition-colors px-1"
          title="Clear selection"
        >
          ✕
        </button>
      </div>
    </>
  )
}
