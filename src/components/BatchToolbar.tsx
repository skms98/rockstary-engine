'use client'

import { useState } from 'react'

interface BatchToolbarProps {
    selectedIds: string[]
    type: 'events' | 'attractions'
    onClear: () => void
}

// All 13 AI pipheline steps for events, in dependency order
const EVENT_STEPS = [
    'page_qa_comments',
    'recommended_versions',
    'fact_check_scores',
    'duplicate_analysis',
    'ab_tests',
    'organiser_trigger_risk',
    'tov_score',
    'grammar_style',
    'reviewer_output',
    'resolver_output',
    'seo_analysis',
    'fact_check_final',
    'ranked_versions',
  ]

// Attractions steps (server-side, short pipeline)
const ATTRACTION_VARS = { steps: ['seo', 'classify', 'evaluate'] }

// Always reads the live Supabase session token - never stale
const getFreshToken = (): string => {
    try {
          const raw = localStorage.getItem('rockstary-supabase')
          if (!raw) return ''
          const session = JSON.parse(raw)
          return session?.access_token || ''
    } catch {
          return ''
    }
}

export default function BatchToolbar({ selectedIds, type, onClear }: BatchToolbarProps) {
    const [running, setRunning] = useState(false)
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
    const [error, setError] = useState<string | null>(null)

  if (selectedIds.length === 0) return null

  const label = type === 'events' ? 'event' : 'attraction'

  const handleRunBatch = async () => {
        if (running) return
        setRunning(true)
        setError(null)
        setProgress(null)

        if (type === 'attractions') {
                // Attractions: delegate to server (short pipeline, no timeout risk)
          fetch('/api/batch/run-many', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ jobId: null, type, item_ids: selectedIds, variables: ATTRACTION_VARS }),
          }).catch(console.error)
                setRunning(false)
                setTimeout(() => { onClear() }, 2000)
                return
        }

        // Events: run all 14 steps client-side to avoid Vercel timeout
        const authToken = getFreshToken()
        if (!authToken) {
                setError('Session expired - please refresh and log back in')
                setRunning(false)
                return
        }

        const total = selectedIds.length * EVENT_STEPS.length
        let done = 0
        setProgress({ done: 0, total })

        const processStep = async (entryId: string, stepField: string): Promise<void> => {
                try {
                          await fetch('/api/ai/process', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ entryId, stepField, authToken, adminKey: '' }),
                          })
                } catch {
                          console.error('Step failed: ' + stepField + ' for ' + entryId)
                }
                done++
                setProgress({ done, total })
        }

        const processEvent = async (id: string): Promise<void> => {
                for (const step of EVENT_STEPS) {
                          await processStep(id, step)
                }
        }

        await Promise.all(selectedIds.map(id => processEvent(id)))

        setRunning(false)
        setProgress(null)
        onClear()
  }

    const progressLabel = progress ? progress.done + '/' + progress.total : null

      return (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#12121e] border border-white/10 rounded-full px-5 py-3 shadow-2xl">
                <span className="h-2 w-2 rounded-full bg-orange-400 animate-pulse" />
                      <span className="text-sm text-white/70">
                              {selectedIds.length} {label}{selectedIds.length !== 1 ? 's' : ''} selected
                                    </span>
                                          {error && (
                                                  <span className="text-sm text-red-400">{error}</span>
                                                        )}
                                                              <button onClick={handleRunBatch} disabled={running}
                                                                      className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-semibold rounded-full px-5 py-1.5 transition-all">
                                                                              {running ? (
                                                                                        <>
                                                                                                    <span className="inline-block h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                                                                                {progressLabel ? progressLabel + ' done' : 'Starting...'}
                                                                                                                          </>
                                                                                                                                  ) : (
                                                                                                                                            <>Run AI Batch</>
                                                                                                                                                    )}
                                                                                                                                                          </button>
                                                                                                                                                                <button onClick={onClear}
                                                                                                                                                                        className="text-white/30 hover:text-white/60 text-lg leading-none transition-colors" title="Clear selection">
                                                                                                                                                                                ×
                                                                                                                                                                                      </button>
                                                                                                                                                                                          </div>
                                                                                                                                                                                            )
                                                                                                                                                                                            }