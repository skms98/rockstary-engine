// @ts-nocheck
'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const INP = 'bg-[#0f1a2e] border border-[#1e3a5f] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c9a84c]'
const EXCL_KEY_CATS = 'qa_excluded_categories'
const EXCL_KEY_TAGS = 'qa_excluded_tags'

function fmt(d) {
  return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
}

function loadExcluded(key: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')) } catch { return new Set() }
}
function saveExcluded(key: string, set: Set<string>) {
  localStorage.setItem(key, JSON.stringify([...set]))
}

function IssueBadge({ label, type }: { label: string; type: 'cat' | 'tag' }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${
      type === 'cat'
        ? 'bg-orange-900/40 text-orange-300 border-orange-700/40'
        : 'bg-red-900/40 text-red-300 border-red-700/40'
    }`}>
      {type === 'cat' ? '📁' : '🏷'} {label}
    </span>
  )
}

export default function QATaggingPage() {
  const [events, setEvents] = useState([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('') // '' | 'categories' | 'tags'
  const [taxInfo, setTaxInfo] = useState<{ categories: number; tags: number } | null>(null)

  // Exclusions are stored separately per type so excluding from cats scan ≠ excluding from tags scan
  const [excludedCats, setExcludedCats] = useState<Set<string>>(new Set())
  const [excludedTags, setExcludedTags] = useState<Set<string>>(new Set())
  const [justExcluded, setJustExcluded] = useState<Set<string>>(new Set())

  useEffect(() => {
    setExcludedCats(loadExcluded(EXCL_KEY_CATS))
    setExcludedTags(loadExcluded(EXCL_KEY_TAGS))
  }, [])

  const combinedExcluded = new Set([...excludedCats, ...excludedTags])

  const fetchIssues = useCallback(async (pg: number) => {
    setLoading(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      // Build excluded list based on current filter
      const excSet = filter === 'categories' ? excludedCats : filter === 'tags' ? excludedTags : combinedExcluded
      const excParam = [...excSet].join(',')

      const params = new URLSearchParams({
        page: String(pg),
        ...(search && { search }),
        ...(filter && { filter }),
        ...(excParam && { excluded: excParam }),
      })

      const res = await fetch(`/api/qa/categories-tags?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setEvents(data.events || [])
      setTotal(data.total || 0)
      setPages(data.pages || 1)
      if (data.taxonomy) setTaxInfo(data.taxonomy)
    } catch {
      setError('Failed to load QA data')
    } finally {
      setLoading(false)
    }
  }, [search, filter, excludedCats, excludedTags])

  useEffect(() => { setPage(1); fetchIssues(1) }, [fetchIssues])

  const go = (p: number) => { setPage(p); fetchIssues(p) }

  function excludeFromCats(eventId: string) {
    const next = new Set(excludedCats)
    next.add(eventId)
    setExcludedCats(next)
    saveExcluded(EXCL_KEY_CATS, next)
    setJustExcluded(prev => new Set([...prev, `cat-${eventId}`]))
  }

  function excludeFromTags(eventId: string) {
    const next = new Set(excludedTags)
    next.add(eventId)
    setExcludedTags(next)
    saveExcluded(EXCL_KEY_TAGS, next)
    setJustExcluded(prev => new Set([...prev, `tag-${eventId}`]))
  }

  function excludeAll(eventId: string) {
    excludeFromCats(eventId)
    excludeFromTags(eventId)
  }

  function restoreEvent(eventId: string) {
    const nc = new Set(excludedCats); nc.delete(eventId)
    const nt = new Set(excludedTags); nt.delete(eventId)
    setExcludedCats(nc); setExcludedTags(nt)
    saveExcluded(EXCL_KEY_CATS, nc); saveExcluded(EXCL_KEY_TAGS, nt)
  }

  const totalExcluded = combinedExcluded.size

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="text-yellow-400">⚠</span> QA: Categories &amp; Tags
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Events with categories or tags not found in the authorized taxonomy
          </p>
        </div>
        {taxInfo && (
          <div className="flex gap-3 text-xs text-zinc-500">
            <span className="bg-[#0f1a2e] border border-[#1e3a5f] rounded-lg px-3 py-1.5">
              📁 {taxInfo.categories} authorized categories
            </span>
            <span className="bg-[#0f1a2e] border border-[#1e3a5f] rounded-lg px-3 py-1.5">
              🏷 {taxInfo.tags} authorized tags
            </span>
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#0f1a2e] border border-orange-700/30 rounded-xl p-4">
          <div className="text-2xl font-bold text-orange-300">{total}</div>
          <div className="text-xs text-zinc-500 mt-1">Issues found</div>
        </div>
        <div className="bg-[#0f1a2e] border border-[#1e3a5f] rounded-xl p-4">
          <div className="text-2xl font-bold text-zinc-300">{totalExcluded}</div>
          <div className="text-xs text-zinc-500 mt-1">
            Excluded from scan
            {totalExcluded > 0 && (
              <button
                onClick={() => {
                  setExcludedCats(new Set()); setExcludedTags(new Set())
                  saveExcluded(EXCL_KEY_CATS, new Set()); saveExcluded(EXCL_KEY_TAGS, new Set())
                }}
                className="ml-2 text-red-400 hover:text-red-300 underline"
              >clear all</button>
            )}
          </div>
        </div>
        <div className="bg-[#0f1a2e] border border-[#1e3a5f] rounded-xl p-4">
          <div className="text-2xl font-bold text-zinc-300">{total + totalExcluded}</div>
          <div className="text-xs text-zinc-500 mt-1">Total scanned (approx)</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-xl p-4">
        <div className="flex gap-3 flex-wrap items-center">
          <input
            className={`${INP} flex-1 min-w-[200px]`}
            placeholder="Search event name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className={INP} value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="">All issues</option>
            <option value="categories">Category issues only</option>
            <option value="tags">Tag issues only</option>
          </select>
          <button
            onClick={() => fetchIssues(page)}
            className="px-4 py-2 rounded-lg bg-[#c9a84c] text-black font-medium text-sm hover:bg-yellow-400 transition"
          >
            Rescan
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-zinc-500">
            Page {page} of {pages} · {events.length} rows shown · {total} total issues
          </span>
          {filter !== '' && (
            <button onClick={() => setFilter('')} className="text-xs text-zinc-500 hover:text-white">
              ✕ Clear filter
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-900/20 border border-red-700/30 rounded-lg px-4 py-2">{error}</div>
      )}

      {/* Issues table */}
      <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e3a5f]">
                {['Event', 'Date', 'Location', 'Status', '⚠ Category Issues', '⚠ Tag Issues', 'Actions'].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">Scanning…</td></tr>
              ) : events.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                  {total === 0 && !loading ? '✅ No issues found — taxonomy looks clean' : 'No results'}
                </td></tr>
              ) : events.map(row => {
                const isAttr = row.is_attraction === true
                const catExcluded = excludedCats.has(String(row.event_id))
                const tagExcluded = excludedTags.has(String(row.event_id))
                const catJustDone = justExcluded.has(`cat-${row.event_id}`)
                const tagJustDone = justExcluded.has(`tag-${row.event_id}`)

                return (
                  <tr key={String(row.event_id)} className="border-b border-[#0f1a2e] hover:bg-[#0d1f3a] transition-colors">
                    {/* Event name */}
                    <td className="px-4 py-3 min-w-[220px]">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded border ${isAttr ? 'bg-teal-900/50 text-teal-300 border-teal-700/40' : 'bg-violet-900/50 text-violet-300 border-violet-700/40'}`}>
                          {isAttr ? '🏛' : '🎭'}
                        </span>
                        <div>
                          <div className="text-white font-medium leading-snug">{row.event_name_en}</div>
                          <div className="text-zinc-600 text-xs font-mono">#{row.event_id}</div>
                        </div>
                      </div>
                      {row.url && (
                        <a href={row.url} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] text-[#c9a84c] hover:text-yellow-300 underline mt-0.5 block truncate max-w-[200px]">
                          {row.url}
                        </a>
                      )}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-300">
                      {fmt(row.event_start_datetime)}
                      {row.event_end_datetime && row.event_end_datetime !== row.event_start_datetime && (
                        <div className="text-zinc-500">→ {fmt(row.event_end_datetime)}</div>
                      )}
                    </td>

                    {/* Location */}
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-300">
                      <div>{row.city || '—'}</div>
                      {row.country && <div className="text-zinc-500">{row.country}</div>}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs px-2 py-0.5 rounded-full border bg-zinc-800/60 text-zinc-400 border-zinc-700/40">
                        {row.status || '—'}
                      </span>
                    </td>

                    {/* Category issues */}
                    <td className="px-4 py-3 max-w-[260px]">
                      {catExcluded ? (
                        <span className="text-xs text-zinc-600 italic">excluded from scan</span>
                      ) : catJustDone ? (
                        <span className="text-xs text-emerald-400">✓ excluded</span>
                      ) : row.cat_issues?.length > 0 ? (
                        <div className="space-y-1">
                          {row.cat_issues.map((c, i) => <IssueBadge key={i} label={c} type="cat" />)}
                          {row.all_categories && (
                            <div className="text-[10px] text-zinc-600 mt-1">
                              Full: {row.all_categories}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-emerald-400">✓ OK</span>
                      )}
                    </td>

                    {/* Tag issues */}
                    <td className="px-4 py-3 max-w-[260px]">
                      {tagExcluded ? (
                        <span className="text-xs text-zinc-600 italic">excluded from scan</span>
                      ) : tagJustDone ? (
                        <span className="text-xs text-emerald-400">✓ excluded</span>
                      ) : row.tag_issues?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {row.tag_issues.map((t, i) => <IssueBadge key={i} label={t} type="tag" />)}
                        </div>
                      ) : (
                        <span className="text-xs text-emerald-400">✓ OK</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col gap-1.5">
                        {row.cat_issues?.length > 0 && !catExcluded && !catJustDone && (
                          <button
                            onClick={() => excludeFromCats(String(row.event_id))}
                            className="text-xs px-2 py-1 rounded bg-orange-900/30 border border-orange-700/40 text-orange-300 hover:bg-orange-900/50 transition whitespace-nowrap"
                          >
                            Skip categories
                          </button>
                        )}
                        {row.tag_issues?.length > 0 && !tagExcluded && !tagJustDone && (
                          <button
                            onClick={() => excludeFromTags(String(row.event_id))}
                            className="text-xs px-2 py-1 rounded bg-red-900/30 border border-red-700/40 text-red-300 hover:bg-red-900/50 transition whitespace-nowrap"
                          >
                            Skip tags
                          </button>
                        )}
                        {(row.cat_issues?.length > 0 || row.tag_issues?.length > 0) && !catExcluded && !tagExcluded && (
                          <button
                            onClick={() => excludeAll(String(row.event_id))}
                            className="text-xs px-2 py-1 rounded bg-zinc-800 border border-zinc-700/40 text-zinc-400 hover:text-white transition whitespace-nowrap"
                          >
                            Skip all
                          </button>
                        )}
                        {(catExcluded || tagExcluded) && (
                          <button
                            onClick={() => restoreEvent(String(row.event_id))}
                            className="text-xs px-2 py-1 rounded bg-zinc-800 border border-zinc-700/40 text-zinc-500 hover:text-white transition"
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => go(page - 1)}
            className="px-3 py-1.5 rounded-lg bg-[#1e3a5f] text-gray-300 text-sm disabled:opacity-40 hover:bg-[#2a4d7a] transition">
            ← Prev
          </button>
          <span className="text-sm text-gray-400">Page {page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => go(page + 1)}
            className="px-3 py-1.5 rounded-lg bg-[#1e3a5f] text-gray-300 text-sm disabled:opacity-40 hover:bg-[#2a4d7a] transition">
            Next →
          </button>
        </div>
      )}

      {/* Exclusions manager */}
      {totalExcluded > 0 && (
        <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-xl p-4">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            Excluded events ({totalExcluded}) — these are treated as correct and skipped in scans
          </h3>
          <div className="flex flex-wrap gap-2">
            {[...combinedExcluded].map(id => (
              <span key={id} className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg bg-zinc-800 border border-zinc-700/40 text-zinc-400">
                #{id}
                <span className="text-zinc-600">
                  {excludedCats.has(id) && excludedTags.has(id) ? '(all)' : excludedCats.has(id) ? '(cats)' : '(tags)'}
                </span>
                <button onClick={() => restoreEvent(id)} className="text-zinc-600 hover:text-red-400 ml-0.5">✕</button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
