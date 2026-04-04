// @ts-nocheck
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const RS_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const RS_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

type Mode = 'categories' | 'tags' | 'both' | 'no-tags'

interface QAEvent {
  event_id: number
  event_name: string
  status: string
  url: string
  country: string
  city: string
  start_date: string
  is_attraction: boolean
  applied_categories: string[]
  applied_tags: string[]
  wrong_categories: string[]
  wrong_tags: string[]
}

const LS_CATS = 'qa_excluded_categories'
const LS_TAGS = 'qa_excluded_tags'

export default function QATaggingPage() {
  const [mode, setMode] = useState<Mode>('both')
  const [scanSize, setScanSize] = useState<'50' | '300' | 'full'>('300')
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState('')
  const [events, setEvents] = useState<QAEvent[]>([])
  const [scanned, setScanned] = useState(0)
  const [search, setSearch] = useState('')
  const [excludedCats, setExcludedCats] = useState<Set<string>>(new Set())
  const [excludedTags, setExcludedTags] = useState<Set<string>>(new Set())
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [hasScanned, setHasScanned] = useState(false)

  useEffect(() => {
    try {
      setExcludedCats(new Set(JSON.parse(localStorage.getItem(LS_CATS) || '[]')))
      setExcludedTags(new Set(JSON.parse(localStorage.getItem(LS_TAGS) || '[]')))
    } catch {}
    const rs = createClient(RS_URL, RS_ANON)
    rs.auth.getSession().then(({ data }) => {
      if (data.session) setToken(data.session.access_token)
    })
  }, [])

  const persist = (cats: Set<string>, tags: Set<string>) => {
    localStorage.setItem(LS_CATS, JSON.stringify([...cats]))
    localStorage.setItem(LS_TAGS, JSON.stringify([...tags]))
  }

  const skipCats = (id: number) => {
    const next = new Set(excludedCats).add(String(id))
    setExcludedCats(next); persist(next, excludedTags)
  }
  const skipTags = (id: number) => {
    const next = new Set(excludedTags).add(String(id))
    setExcludedTags(next); persist(excludedCats, next)
  }
  const skipAll = (id: number) => {
    const nc = new Set(excludedCats).add(String(id))
    const nt = new Set(excludedTags).add(String(id))
    setExcludedCats(nc); setExcludedTags(nt); persist(nc, nt)
  }
  const restore = (id: number) => {
    const nc = new Set(excludedCats); nc.delete(String(id))
    const nt = new Set(excludedTags); nt.delete(String(id))
    setExcludedCats(nc); setExcludedTags(nt); persist(nc, nt)
  }

  const isExcluded = (id: number) => {
    const s = String(id)
    if (mode === 'categories') return excludedCats.has(s)
    if (mode === 'tags') return excludedTags.has(s)
    return excludedCats.has(s) && excludedTags.has(s)
  }

  const scan = async () => {
    if (!token) { setError('Not authenticated'); return }
    setScanning(true); setError(''); setEvents([]); setHasScanned(false)
    setProgress('Running AI scan on events… this may take up to 60s')

    const allExcluded = [...new Set([...excludedCats, ...excludedTags])].join(',')
    const params = new URLSearchParams({ mode, search, excluded: allExcluded })
    if (scanSize === 'full') { params.set('full', 'true') } else { params.set('max', scanSize) }

    try {
      const res = await fetch(`/api/qa/categories-tags?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error || 'Scan failed')
      }
      const data = await res.json()
      setEvents(data.events || [])
      setScanned(data.scanned || 0)
      setHasScanned(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setScanning(false); setProgress('')
    }
  }

  const visible = events.filter((ev) => !isExcluded(ev.event_id))
  const allExcludedIds = [...new Set([...excludedCats, ...excludedTags])]

  const modeConfig = {
    categories: { label: 'Categories', color: 'orange', icon: '⚠' },
    tags: { label: 'Tags', color: 'red', icon: '🏷' },
    both: { label: 'Both', color: 'yellow', icon: '⚡' },
    'no-tags': { label: 'No Tags', color: 'red', icon: '🚫' },
  }

  const scanSizeConfig = [
    { id: '50' as const, label: '⚡ Quick (50)' },
    { id: '300' as const, label: '📊 Normal (300)' },
    { id: 'full' as const, label: '📍 900+ Max Scan' },
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-pl-text">QA: Tags &amp; Categories</h1>
        <p className="text-sm text-pl-text-dim mt-1">
          AI-powered audit — detects misapplied categories and tags on events and attractions
        </p>
      </div>

      {/* Scan Size selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-pl-text-dim font-medium">Scan size:</span>
        {scanSizeConfig.map((s) => (
          <button
            key={s.id}
            onClick={() => setScanSize(s.id)}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
              scanSize === s.id
                ? 'bg-pl-gold text-black'
                : 'bg-pl-card border border-pl-border text-pl-text-dim hover:text-pl-text'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Mode selector + Search + Scan */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Mode tabs */}
        <div className="flex rounded-lg overflow-hidden border border-pl-border">
          {(['categories', 'tags', 'both', 'no-tags'] as Mode[]).map((m) => {
            const cfg = modeConfig[m]
            const active = mode === m
            const activeClass =
              m === 'categories'
                ? 'bg-orange-500/15 text-orange-400 border-r border-orange-500/30'
                : m === 'tags'
                ? 'bg-red-500/15 text-red-400 border-r border-red-500/30'
                : m === 'no-tags'
                ? 'bg-red-900/30 text-red-300'
                : 'bg-yellow-500/15 text-yellow-400'
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-4 py-2 text-sm font-medium transition-all ${
                  active ? activeClass : 'bg-pl-card text-pl-text-dim hover:text-pl-text border-r border-pl-border last:border-r-0'
                }`}
              >
                {cfg.icon} {cfg.label}
              </button>
            )
          })}
        </div>

        <input
          type="text"
          placeholder="Filter by event name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && scan()}
          className="flex-1 min-w-[200px] bg-pl-card border border-pl-border rounded-lg px-3 py-2 text-sm text-pl-text placeholder-pl-text-dim focus:outline-none focus:border-yellow-500/50"
        />

        <button
          onClick={scan}
          disabled={scanning}
          className="px-6 py-2 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-semibold rounded-lg text-sm transition-colors"
        >
          {scanning ? 'Scanning…' : 'Scan'}
        </button>
      </div>

      {/* Mode description */}
      <div className="text-xs text-pl-text-dim bg-pl-card border border-pl-border rounded-lg px-4 py-2">
        {mode === 'categories' && '⚠ Scanning for wrong categories only — tags are ignored'}
        {mode === 'tags' && '🏷 Scanning for wrong tags only — categories are ignored'}
        {mode === 'both' && '⚡ Scanning both categories and tags for mismatches — issues in either will surface the event'}
        {mode === 'no-tags' && '🚫 Finding events with no marketing tags assigned — no AI needed, instant results'}
      </div>

      {/* Progress */}
      {progress && (
        <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3 text-sm text-yellow-400">
          <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          {progress}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
          ✕ {error}
        </div>
      )}

      {/* Stats bar */}
      {hasScanned && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Events scanned', value: scanned, color: 'text-pl-text' },
            { label: 'Issues found', value: events.length, color: 'text-yellow-400' },
            { label: 'Visible now', value: visible.length, color: 'text-pl-text' },
            { label: 'Skipped', value: allExcludedIds.length, color: 'text-zinc-400' },
          ].map((s) => (
            <div key={s.label} className="bg-pl-card border border-pl-border rounded-xl px-4 py-3">
              <div className="text-xs text-pl-text-dim mb-1">{s.label}</div>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Results table */}
      {visible.length > 0 && (
        <div className="bg-pl-card border border-pl-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-pl-border text-[10px] uppercase tracking-wider text-pl-text-dim">
                <th className="px-4 py-3 text-left">Event / Attraction</th>
                <th className="px-4 py-3 text-left">Location</th>
                <th className="px-4 py-3 text-left">Status</th>
                {mode !== 'tags' && <th className="px-4 py-3 text-left">⚠ Wrong Categories</th>}
                {mode !== 'categories' && <th className="px-4 py-3 text-left">⚠ Wrong Tags</th>}
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((ev, i) => (
                <tr
                  key={ev.event_id}
                  className={`border-b border-pl-border/40 ${i % 2 === 1 ? 'bg-white/[0.015]' : ''}`}
                >
                  {/* Event name */}
                  <td className="px-4 py-3 max-w-[260px]">
                    <div className="font-medium text-pl-text leading-snug">{ev.event_name}</div>
                    <div className="text-[11px] text-pl-text-dim mt-0.5">
                      {ev.is_attraction ? '🏛 Attraction' : '🎭 Event'} · #{ev.event_id}
                    </div>
                    {ev.url && (
                      <a
                        href={ev.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-yellow-400/80 hover:text-yellow-400 hover:underline"
                      >
                        View on site →
                      </a>
                    )}
                  </td>

                  {/* Location */}
                  <td className="px-4 py-3 text-pl-text-dim text-xs">
                    {[ev.city, ev.country].filter(Boolean).join(', ') || '—'}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                        ev.status === 'active'
                          ? 'bg-green-500/15 text-green-400'
                          : 'bg-zinc-500/15 text-zinc-400'
                      }`}
                    >
                      {ev.status || '—'}
                    </span>
                  </td>

                  {/* Wrong categories */}
                  {mode !== 'tags' && (
                    <td className="px-4 py-3">
                      {ev.wrong_categories?.length > 0 ? (
                        <div>
                          <div className="flex flex-wrap gap-1 mb-1">
                            {ev.wrong_categories.map((c) => (
                              <span
                                key={c}
                                className="px-2 py-0.5 bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs rounded"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                          <div className="text-[10px] text-pl-text-dim">
                            All: {ev.applied_categories.join(' · ')}
                          </div>
                        </div>
                      ) : (
                        <span className="text-pl-text-dim text-xs">—</span>
                      )}
                    </td>
                  )}

                  {/* Wrong tags */}
                  {mode !== 'categories' && (
                    <td className="px-4 py-3">
                      {ev.wrong_tags?.length > 0 ? (
                        <div>
                          <div className="flex flex-wrap gap-1 mb-1">
                            {ev.wrong_tags.map((t) => (
                              <span
                                key={t}
                                className="px-2 py-0.5 bg-red-500/20 border border-red-500/30 text-red-400 text-xs rounded"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                          <div className="text-[10px] text-pl-text-dim">
                            All: {ev.applied_tags.join(' · ')}
                          </div>
                        </div>
                      ) : (
                        <span className="text-pl-text-dim text-xs">—</span>
                      )}
                    </td>
                  )}

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      {mode !== 'tags' && (ev.wrong_categories?.length ?? 0) > 0 && (
                        <button
                          onClick={() => skipCats(ev.event_id)}
                          className="text-[11px] px-2 py-1 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 rounded transition-colors text-left"
                        >
                          Skip categories
                        </button>
                      )}
                      {mode !== 'categories' && (ev.wrong_tags?.length ?? 0) > 0 && (
                        <button
                          onClick={() => skipTags(ev.event_id)}
                          className="text-[11px] px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition-colors text-left"
                        >
                          Skip tags
                        </button>
                      )}
                      <button
                        onClick={() => skipAll(ev.event_id)}
                        className="text-[11px] px-2 py-1 bg-zinc-500/10 hover:bg-zinc-500/20 text-zinc-400 rounded transition-colors text-left"
                      >
                        Skip all
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state after scan */}
      {hasScanned && !scanning && visible.length === 0 && (
        <div className="text-center py-16 bg-pl-card border border-pl-border rounded-xl text-pl-text-dim">
          <div className="text-4xl mb-3">✅</div>
          <div className="font-medium text-pl-text">No issues found</div>
          <div className="text-sm mt-1">
            {scanned} events scanned — all {mode === 'both' ? 'categories and tags' : mode} look correct
          </div>
        </div>
      )}

      {/* Exclusions manager */}
      {allExcludedIds.length > 0 && (
        <div className="bg-pl-card border border-pl-border rounded-xl p-4">
          <div className="text-xs font-medium text-pl-text-dim uppercase tracking-wider mb-3">
            Skipped events ({allExcludedIds.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {allExcludedIds.map((id) => (
              <div
                key={id}
                className="flex items-center gap-2 bg-zinc-800/50 border border-zinc-700/50 rounded-md px-2 py-1 text-xs"
              >
                <span className="text-zinc-400">#{id}</span>
                <span className="text-zinc-600 text-[10px]">
                  {excludedCats.has(id) && excludedTags.has(id)
                    ? 'all'
                    : excludedCats.has(id)
                    ? 'cats'
                    : 'tags'}
                </span>
                <button
                  onClick={() => restore(Number(id))}
                  className="text-zinc-600 hover:text-zinc-300 transition-colors ml-1"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
