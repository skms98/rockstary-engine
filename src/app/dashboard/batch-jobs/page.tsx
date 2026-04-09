'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type ItemStatus = 'queued' | 'running' | 'completed' | 'failed'
type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'partial'

interface BatchItem {
  id: string
  status: ItemStatus
  error?: string
}

interface BatchProgress {
  total: number
  completed: number
  failed: number
  items: BatchItem[]
}

interface BatchJob {
  id: string
  type: 'events' | 'attractions'
  label: string
  status: JobStatus
  item_ids: string[]
  variables: Record<string, unknown>
  progress: BatchProgress
  created_at: string
  updated_at: string
  completed_at?: string
}

const STATUS_BADGE: Record<JobStatus, string> = {
  queued:    'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  running:   'text-blue-400 bg-blue-400/10 border-blue-400/20',
  completed: 'text-green-400 bg-green-400/10 border-green-400/20',
  failed:    'text-red-400 bg-red-400/10 border-red-400/20',
  partial:   'text-orange-400 bg-orange-400/10 border-orange-400/20'
}

const STATUS_DOT: Record<JobStatus, string> = {
  queued:    'bg-yellow-400',
  running:   'bg-blue-400 animate-pulse',
  completed: 'bg-green-400',
  failed:    'bg-red-400',
  partial:   'bg-orange-400'
}

const ITEM_DOT: Record<ItemStatus, string> = {
  queued:    'bg-gray-600',
  running:   'bg-blue-400 animate-pulse',
  completed: 'bg-green-400',
  failed:    'bg-red-400'
}

export default function BatchJobsPage() {
  const [jobs, setJobs] = useState<BatchJob[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/batch/jobs')
      if (res.ok) setJobs(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchJobs()
    const interval = setInterval(fetchJobs, 4000)
    return () => clearInterval(interval)
  }, [fetchJobs])

  const deleteJob = async (id: string) => {
    if (!confirm('Remove this batch job from history?')) return
    await fetch(`/api/batch/${id}`, { method: 'DELETE' })
    setJobs(prev => prev.filter(j => j.id !== id))
  }

  const toggleExpand = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const activeJobs = jobs.filter(j => j.status === 'running' || j.status === 'queued')
  const doneJobs   = jobs.filter(j => j.status !== 'running' && j.status !== 'queued')

  if (loading) return <div className="p-8 text-gray-500 text-sm">Loading jobs…</div>

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold text-white">Batch Jobs</h1>
          <p className="text-gray-500 text-sm mt-1">Background AI runs — all selected events &amp; attractions processed in parallel.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/events" className="px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">← Events</Link>
          <Link href="/dashboard/attractions" className="px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">← Attractions</Link>
        </div>
      </div>

      {jobs.length === 0 && (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">📭</div>
          <p className="text-gray-400 font-medium">No batch jobs yet</p>
          <p className="text-gray-600 text-sm mt-2">Select events or attractions, then click <span className="text-orange-400 font-semibold">▶ Run AI Batch</span></p>
        </div>
      )}

      {activeJobs.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Active ({activeJobs.length})</h2>
          <div className="space-y-2">
            {activeJobs.map(job => <JobCard key={job.id} job={job} expanded={expanded.has(job.id)} onToggle={() => toggleExpand(job.id)} onDelete={() => deleteJob(job.id)} />)}
          </div>
        </section>
      )}

      {doneJobs.length > 0 && (
        <section>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">History ({doneJobs.length})</h2>
          <div className="space-y-2">
            {doneJobs.map(job => <JobCard key={job.id} job={job} expanded={expanded.has(job.id)} onToggle={() => toggleExpand(job.id)} onDelete={() => deleteJob(job.id)} />)}
          </div>
        </section>
      )}
    </div>
  )
}

function JobCard({ job, expanded, onToggle, onDelete }: { job: BatchJob; expanded: boolean; onToggle: () => void; onDelete: () => void }) {
  const done  = job.progress.completed + job.progress.failed
  const total = job.progress.total
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0
  const ts    = new Date(job.created_at).toLocaleString()

  return (
    <div className="bg-[#13131f] border border-white/8 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${STATUS_DOT[job.status]}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="text-white text-sm font-semibold truncate">{job.label}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_BADGE[job.status]}`}>{job.status}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-gray-500 border border-white/5">{job.type}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-36 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${job.status === 'failed' ? 'bg-red-500' : job.status === 'partial' ? 'bg-orange-400' : 'bg-orange-500'}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-gray-500">{job.progress.completed}/{total} done{job.progress.failed > 0 && <span className="text-red-400 ml-1">· {job.progress.failed} failed</span>}</span>
          </div>
          <p className="text-xs text-gray-600 mt-1">{ts}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onToggle} className="text-xs text-gray-500 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/5 transition-colors">{expanded ? 'Hide' : 'Details'}</button>
          <button onClick={onDelete} className="text-xs text-red-500 hover:text-red-400 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors">Delete</button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-white/5 px-4 py-3 max-h-56 overflow-y-auto">
          <div className="space-y-1.5">
            {job.progress.items.map(item => (
              <div key={item.id} className="flex items-center gap-2 text-xs">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${ITEM_DOT[item.status]}`} />
                <span className="text-gray-400 font-mono text-xs truncate flex-1">{item.id}</span>
                <span className={`flex-shrink-0 ${item.status === 'completed' ? 'text-green-400' : item.status === 'failed' ? 'text-red-400' : item.status === 'running' ? 'text-blue-400' : 'text-gray-600'}`}>{item.status}</span>
                {item.error && <span className="text-red-300 text-xs truncate max-w-[140px]" title={item.error}>⚠ {item.error}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
        }
