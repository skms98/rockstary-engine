'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface EventRow {
  event_id: string
  event_name_en: string
  event_name_ar: string | null
  event_start_datetime: string | null
  event_end_datetime: string | null
  description_en: string | null
  description_ar: string | null
  country: string | null
  city: string | null
  venue: string | null
  min_price: number | null
  currency: string | null
  status: string | null
  is_active: boolean | null
  url: string | null
  event_organiser: string | null
  event_manager: string | null
  marketing_tags: string[] | null
  updated_at: string | null
}

interface TaxonomyEntry {
  name: string
  parent_group: string | null
  is_selectable: boolean
  domain: string | null
}

function isAttraction(row: EventRow) {
  return Array.isArray(row.marketing_tags) && row.marketing_tags.includes('attractions')
}

function formatDate(dt: string | null) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatPrice(price: number | null, currency: string | null) {
  if (price === null || price === undefined) return '—'
  return `${price} ${currency || ''}`.trim()
}

function getCategories(tags: string[] | null, primarySet: Set<string>, secondaryMap: Map<string, string>) {
  if (!tags || tags.length === 0) return { primary: null, secondary: null }
  const lowerTags = tags.map(t => t.toLowerCase())
  const primary = lowerTags.find(t => primarySet.has(t)) || null
  const secondary = lowerTags.find(t => secondaryMap.has(t) && t !== primary) || null
  return { primary, secondary }
}

export default function EventsDBPage() {
  const router = useRouter()
  const [events, setEvents] = useState<EventRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')
  const [active, setActive] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const [countries, setCountries] = useState<string[]>([])
  const [primarySet, setPrimarySet] = useState<Set<string>>(new Set())
  const [secondaryMap, setSecondaryMap] = useState<Map<string, string>>(new Map())

  const [expanded, setExpanded] = useState<string | null>(null)

  const totalPages = Math.ceil(total / 50)

  // Load countries and taxonomy on mount
  useEffect(() => {
    fetch('/api/events-db?countries=1')
      .then(r => r.json())
      .then(d => setCountries(d.countries || []))
      .catch(() => {})

    fetch('/api/events-db?taxonomy=1')
      .then(r => r.json())
      .then(d => {
        const tax: TaxonomyEntry[] = d.taxonomy || []
        // Primary = selectable top-level categories (no parent_group) — e.g. "Concerts", "Live Music"
        const pSet = new Set<string>(
          tax.filter(t => t.is_selectable && !t.parent_group).map(t => t.name.toLowerCase())
        )
        // Secondary = selectable subcategories under a parent — e.g. "Arabic concerts", "Museums"
        const sMap = new Map<string, string>()
        tax.forEach(t => {
          if (t.is_selectable && t.parent_group) sMap.set(t.name.toLowerCase(), t.parent_group.toLowerCase())
        })
        setPrimarySet(pSet)
        setSecondaryMap(sMap)
      })
      .catch(() => {})
  }, [])

  const fetchEvents = useCallback(async (pg: number) => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams({
      page: String(pg),
      ...(search && { search }),
      ...(country && { country }),
      ...(city && { city }),
      ...(active && { active }),
      ...(typeFilter && { type: typeFilter }),
    })
    try {
      const res = await fetch(`/api/events-db?${params}`)
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setEvents(data.events || [])
      setTotal(data.total || 0)
    } catch {
      setError('Failed to load events')
    } finally {
      setLoading(false)
    }
  }, [search, country, city, active, typeFilter])

  useEffect(() => {
    setPage(1)
    fetchEvents(1)
  }, [fetchEvents])

  function handlePageChange(p: number) {
    setPage(p)
    fetchEvents(p)
  }

  function clearFilters() {
    setSearch(''); setCountry(''); setCity(''); setActive(''); setTypeFilter('')
    setPage(1)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Events DB</h1>
        <p className="text-sm pl-muted mt-1">{total.toLocaleString()} records total</p>
      </div>

      {/* Filters */}
      <div className="pl-card pl-border rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <input
            className="bg-[#0f1a2e] border border-[#1e3a5f] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#c9a84c] col-span-2 md:col-span-1"
            placeholder="Search event name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="bg-[#0f1a2e] border border-[#1e3a5f] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c9a84c]"
            value={country}
            onChange={e => setCountry(e.target.value)}
          >
            <option value="">All Countries</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            className="bg-[#0f1a2e] border border-[#1e3a5f] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#c9a84c]"
            placeholder="City…"
            value={city}
            onChange={e => setCity(e.target.value)}
          />
          <select
            className="bg-[#0f1a2e] border border-[#1e3a5f] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c9a84c]"
            value={active}
            onChange={e => setActive(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          <select
            className="bg-[#0f1a2e] border border-[#1e3a5f] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c9a84c]"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="event">Events only</option>
            <option value="attraction">Attractions only</option>
          </select>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs pl-muted">
            Page {page} of {totalPages || 1} · showing {events.length} rows
          </span>
          <button
            onClick={clearFilters}
            className="text-xs px-3 py-1.5 rounded-lg bg-[#1e3a5f] text-gray-300 hover:text-white hover:bg-[#2a4d7a] transition"
          >
            Clear filters
          </button>
        </div>
      </div>

      {/* Error */}
      {error && <div className="text-red-400 text-sm">{error}</div>}

      {/* Table */}
      <div className="pl-card pl-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e3a5f] bg-[#0a1628]">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Primary Cat.</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Secondary Cat.</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Country</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">City</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Venue</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Price</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Organiser</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Link</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={12} className="px-4 py-12 text-center text-gray-500">Loading…</td></tr>
              ) : events.length === 0 ? (
                <tr><td colSpan={12} className="px-4 py-12 text-center text-gray-500">No events found</td></tr>
              ) : events.map(row => {
                const attr = isAttraction(row)
                const { primary, secondary } = getCategories(row.marketing_tags, primarySet, secondaryMap)
                const isOpen = expanded === row.event_id
                const tags = row.marketing_tags || []
                return (
                  <>
                    <tr
                      key={row.event_id}
                      onClick={() => setExpanded(isOpen ? null : row.event_id)}
                      className={`border-b border-[#0f1a2e] cursor-pointer transition-colors ${isOpen ? 'bg-[#0d2040]' : 'hover:bg-[#0d1f3a]'}`}
                    >
                      {/* Type badge */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {attr ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-900/60 text-teal-300 border border-teal-700/40">
                            🏛 Attraction
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-900/60 text-violet-300 border border-violet-700/40">
                            🎭 Event
                          </span>
                        )}
                      </td>
                      {/* Name */}
                      <td className="px-4 py-3 min-w-[200px]">
                        <div className="text-white font-medium leading-snug">{row.event_name_en}</div>
                        {row.event_name_ar && (
                          <div className="text-gray-500 text-xs mt-0.5" dir="rtl">{row.event_name_ar}</div>
                        )}
                      </td>
                      {/* Primary Category */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {primary ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/40 text-blue-300 border border-blue-700/30 capitalize">
                            {primary}
                          </span>
                        ) : <span className="text-gray-600 text-xs">—</span>}
                      </td>
                      {/* Secondary Category */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {secondary ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-900/40 text-indigo-300 border border-indigo-700/30 capitalize">
                            {secondary}
                          </span>
                        ) : <span className="text-gray-600 text-xs">—</span>}
                      </td>
                      {/* Date */}
                      <td className="px-4 py-3 whitespace-nowrap text-gray-300 text-xs">
                        {formatDate(row.event_start_datetime)}
                        {row.event_end_datetime && row.event_end_datetime !== row.event_start_datetime && (
                          <span className="text-gray-500"> → {formatDate(row.event_end_datetime)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-300 text-xs">{row.country || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-300 text-xs">{row.city || '—'}</td>
                      <td className="px-4 py-3 text-gray-300 text-xs max-w-[160px] truncate">{row.venue || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-300 text-xs">{formatPrice(row.min_price, row.currency)}</td>
                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          row.is_active
                            ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-700/40'
                            : 'bg-red-900/40 text-red-400 border border-red-700/30'
                        }`}>
                          {row.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs max-w-[140px] truncate">{row.event_organiser || '—'}</td>
                      {/* Link */}
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        {row.url ? (
                          <a
                            href={row.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[#c9a84c] hover:text-yellow-300 underline underline-offset-2"
                          >
                            View ↗
                          </a>
                        ) : <span className="text-gray-600 text-xs">—</span>}
                      </td>
                    </tr>

                    {/* Expanded detail panel */}
                    {isOpen && (
                      <tr key={`${row.event_id}-detail`} className="bg-[#071429]">
                        <td colSpan={12} className="px-6 py-5">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Left: descriptions */}
                            <div className="space-y-4">
                              {row.description_en && (
                                <div>
                                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Description (EN)</div>
                                  <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{row.description_en}</p>
                                </div>
                              )}
                              {row.description_ar && (
                                <div>
                                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Description (AR)</div>
                                  <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap" dir="rtl">{row.description_ar}</p>
                                </div>
                              )}
                              {!row.description_en && !row.description_ar && (
                                <p className="text-gray-600 text-sm italic">No description available</p>
                              )}
                            </div>
                            {/* Right: metadata */}
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                <div>
                                  <span className="text-gray-500 text-xs">Event ID</span>
                                  <div className="text-gray-300 font-mono text-xs mt-0.5">{row.event_id}</div>
                                </div>
                                <div>
                                  <span className="text-gray-500 text-xs">Manager</span>
                                  <div className="text-gray-300 text-xs mt-0.5">{row.event_manager || '—'}</div>
                                </div>
                                <div>
                                  <span className="text-gray-500 text-xs">Start</span>
                                  <div className="text-gray-300 text-xs mt-0.5">{formatDate(row.event_start_datetime)}</div>
                                </div>
                                <div>
                                  <span className="text-gray-500 text-xs">End</span>
                                  <div className="text-gray-300 text-xs mt-0.5">{formatDate(row.event_end_datetime)}</div>
                                </div>
                                <div>
                                  <span className="text-gray-500 text-xs">Last Updated</span>
                                  <div className="text-gray-300 text-xs mt-0.5">{formatDate(row.updated_at)}</div>
                                </div>
                                <div>
                                  <span className="text-gray-500 text-xs">Status</span>
                                  <div className="text-gray-300 text-xs mt-0.5">{row.status || '—'}</div>
                                </div>
                              </div>
                              {/* All tags */}
                              {tags.length > 0 && (
                                <div>
                                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">All Tags</div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {tags.map(tag => {
                                      const isPrimary = primarySet.has(tag.toLowerCase())
                                      const isSecondary = secondaryMap.has(tag.toLowerCase())
                                      return (
                                        <span
                                          key={tag}
                                          className={`text-xs px-2 py-0.5 rounded-full border capitalize ${
                                            isPrimary
                                              ? 'bg-blue-900/40 text-blue-300 border-blue-700/30'
                                              : isSecondary
                                              ? 'bg-indigo-900/40 text-indigo-300 border-indigo-700/30'
                                              : 'bg-[#1e3a5f] text-gray-400 border-[#2a4d7a]'
                                          }`}
                                        >
                                          {isPrimary ? '◆ ' : isSecondary ? '◇ ' : ''}{tag}
                                        </span>
                                      )
                                    })}
                                  </div>
                                  <div className="flex gap-3 mt-1.5 text-xs text-gray-600">
                                    <span>◆ primary</span>
                                    <span>◇ secondary</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => handlePageChange(page - 1)}
            className="px-3 py-1.5 rounded-lg bg-[#1e3a5f] text-gray-300 text-sm disabled:opacity-40 hover:bg-[#2a4d7a] transition"
          >
            ← Prev
          </button>
          <span className="text-sm text-gray-400">Page {page} / {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => handlePageChange(page + 1)}
            className="px-3 py-1.5 rounded-lg bg-[#1e3a5f] text-gray-300 text-sm disabled:opacity-40 hover:bg-[#2a4d7a] transition"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
