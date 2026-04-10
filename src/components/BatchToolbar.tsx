'use client'

import { useState } from 'react'

interface BatchToolbarProps {
  selectedIds: string[]
  type: 'events' | 'attractions'
  onClear: () => void
}

// Default variables per type — no form needed, just run
const DEFAULT_VARS = {
  events: { mode: 'b2c' },
  attractions: { steps: ['seo', 'classify', 'evaluate'] }
}

export default function BatchToolbar({ selectedIds, type, onClear }: BatchToolbarProps) {
  const [running, setRunning] = useState(false)
  const [queued, setQueued] = useState(false)

  if (selectedIds.length === 0) return null

  const label = type === 'events' ? 'event' : 'attraction'

  const handleRunBatch = async () => {
    if (running) return
    setRunning(true)
    setQueued(false)

    // Fire-and-forget — runs all pipeline steps in parallel on the server
    fetch('/api/batch/run-many', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId: null,
        type,
        item_ids: selectedIds,
        variables: DEFAULT_VARS[type]
      })
    }).catch(console.error)

    // Stay on page — show confirmation, then clear selection
    setQueued(true)
    setRunning(false)
    setTimeout(() => {
      onClear()
      setQueued(false)
    }, 2000)
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#12121e] border border-white/10 rounded-full px-5 py-3 shadow-2xl">
      <span className="h-2 w-2 rounded-full bg-orange-400 animate-pulse" />
      <span className="text-sm text-white/70">
        {selectedIds.length} {label}{selectedIds.length !== 1 ? 's' : ''} selected
      </span>
      <button
        onClick={handleRunBatch}
        disabled={running || queued}
        className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-semibold rounded-full px-5 py-1.5 transition-all"
      >
        {running ? (
          <>
            <span className="inline-block h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Starting...
          </>
        ) : queued ? (
          <>✓ Running in background</>
        ) : (
          <>▶ Run AI Batch</>
        )}
      </button>
      <button
        onClick={onClear}
        className="text-white/30 hover:text-white/60 text-lg leading-none transition-colors"
        title="Clear selection"
      >
        ×
      </button>
    </div>
  )
}
