'use client'

import { useState, useEffect } from 'react'
import VariableLoader from './VariableLoader'

interface BatchToolbarProps {
  selectedIds: string[]
  type: 'events' | 'attractions'
  onClear: () => void
}

const VARS_KEY = (type: string) => `batch_vars_${type}`

const DEFAULT_VARS = {
  events: { authToken: '', adminKey: '', mode: 'b2c' },
  attractions: { steps: ['seo', 'classify'] }
}

export default function BatchToolbar({ selectedIds, type, onClear }: BatchToolbarProps) {
  const [variables, setVariables] = useState<Record<string, unknown>>(DEFAULT_VARS[type])
  const [showVarLoader, setShowVarLoader] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load saved variables for this type from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VARS_KEY(type))
      if (saved) setVariables(JSON.parse(saved))
      else setVariables(DEFAULT_VARS[type])
    } catch {
      setVariables(DEFAULT_VARS[type])
    }
  }, [type])

  if (selectedIds.length === 0) return null

  const handleApplyVars = (v: Record<string, unknown>) => {
    setVariables(v)
    // Persist per type so it survives navigation
    try { localStorage.setItem(VARS_KEY(type), JSON.stringify(v)) } catch {}
    setShowVarLoader(false)
  }

  const handleRunBatch = async () => {
    setRunning(true)
    setError(null)
    try {
      // 1. Create the job record (best-effort — works if batch_jobs table exists)
      let jobId: string | null = null
      try {
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
        const createData = await createRes.json()
        jobId = createData.jobId || null
      } catch {
        // Table may not exist yet — continue without tracking
      }

      // 2. Fire-and-forget: run the AI pipeline in parallel background
      fetch('/api/batch/run-many', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, type, item_ids: selectedIds, variables })
      }).catch(console.error)

      // 3. Navigate to batch jobs page (or back to list if no tracking)
      onClear()
      if (jobId) {
        window.location.href = '/dashboard/batch-jobs'
      } else {
        alert(`Batch started for ${selectedIds.length} ${type} — AI is running in background. Check the items shortly for updated results.`)
      }
    } catch (err) {
      setError(String(err))
      setRunning(false)
    }
  }

  const isEventsReady = type === 'events'
    ? Boolean(variables.authToken)
    : (variables.steps as string[] || []).length > 0

  return (
    <>
      {showVarLoader && (
        <VariableLoader
          type={type}
          variables={variables}
          onApply={handleApplyVars}
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
          <span className={`w-1.5 h-1.5 rounded-full ml-0.5 ${isEventsReady ? 'bg-green-400' : 'bg-yellow-400'}`} />
        </button>

        {/* Error */}
        {error && (
          <span className="text-red-400 text-xs max-w-[160px] truncate" title={error}>{error}</span>
        )}

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
