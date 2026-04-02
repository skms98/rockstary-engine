'use client'

import { useEffect, useState, useCallback } from 'react'

interface EventRow {
  event_id: string
  event_name_en: string
  event_start_datetime: string
  country: string
  city: string
  venue: string
  min_price: number | null
  currency: string
  status: string
  is_active: boolean
  url: string
  event_organiser: string
}

export default function EventsDBPage() {
  const [events, setEvents] = useState<EventRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  // filters
  const [search, setSearch] = useState('')
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')
  const [active, setActive] = useState<string>('')  // '' | 'true' | 'false'
  const [countries, setCountries] = useState<string[]>([])

  const limit = 50
  const totalPages = Math.ceil(total / limit)

  // load countries once
  useEffect(() => {
    fetch('/api/events-db?countries=1')
      .then(r => r.json())
      .then(d => setCountries(d.countries || []))
  }, [])

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (search) params.set('search', search)
    if (country) params.set('country', country)
    if (city) params.set('city', city)
    if (active) params.set('active', active)

    const res = await fetch(`/api/events-db?${params}`)
    const data = await res.json()
    setEvents(data.events || [])
    setTotal(data.total ?? 0)
    setLoading(false)
  }, [page, search, country, city, active])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const clearFilters = () => {
    setSearch(''); setCountry(''); setCity(''); setActive(''); setPage(1)
  }

  const fmtDate = (iso: string) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Events DB</h1>
        <span className="text-sm text-pl-muted">{total.toLocaleString()} events</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-pl-muted uppercase tracking-wider">Search</label>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Event name…"
            className="bg-pl-card border border-pl-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-pl-muted focus:border-pl-gold/50 focus:outline-none w-56"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-pl-muted uppercase tracking-wider">Country</label>
          <select
            value={country}
            onChange={e => { setCountry(e.target.value); setPage(1) }}
            className="bg-pl-card border border-pl-border rounded-lg px-3 py-2 text-sm text-white focus:border-pl-gold/50 focus:outline-none w-44"
          >
            <option value="">All countries</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-pl-muted uppercase tracking-wider">City</label>
          <input
            value={city}
            onChange={e => { setCity(e.target.value); setPage(1) }}
            placeholder="City…"
            className="bg-pl-card border border-pl-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-pl-muted focus:border-pl-gold/50 focus:outline-none w-40"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-pl-muted uppercase tracking-wider">Status</label>
          <select
            value={active}
            onChange={e => { setActive(e.target.value); setPage(1) }}
            className="bg-pl-card border border-pl-border rounded-lg px-3 py-2 text-sm text-white focus:border-pl-gold/50 focus:outline-none w-36"
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>

        <button
          onClick={clearFilters}
          className="px-4 py-2 text-sm text-pl-muted hover:text-white border border-pl-border rounded-lg hover:bg-pl-card transition-colors"
        >
          Clear filters
        </button>
      </div>

      {/* Table */}
      <div className="bg-pl-card border border-pl-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-pl-border text-pl-muted text-left">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Country</th>
                <th className="px-4 py-3 font-medium">City</th>
                <th className="px-4 py-3 font-medium">Venue</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Organiser</th>
                <th className="px-4 py-3 font-medium">Link</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-pl-muted">Loading…</td></tr>
              ) : events.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-pl-muted">No events found</td></tr>
              ) : events.map(ev => (
                <tr key={ev.event_id} className="border-b border-pl-border/50 hover:bg-pl-card/80 transition-colors">
                  <td className="px-4 py-3 text-white max-w-[260px] truncate">{ev.event_name_en}</td>
                  <td className="px-4 py-3 text-pl-text whitespace-nowrap">{fmtDate(ev.event_start_datetime)}</td>
                  <td className="px-4 py-3 text-pl-text">{ev.country || '—'}</td>
                  <td className="px-4 py-3 text-pl-text">{ev.city || '—'}</td>
                  <td className="px-4 py-3 text-pl-text max-w-[180px] truncate">{ev.venue || '—'}</td>
                  <td className="px-4 py-3 text-pl-text whitespace-nowrap">
                    {ev.min_price != null ? `${ev.min_price} ${ev.currency || ''}`.trim() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      ev.is_active
                        ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                        : 'bg-red-500/10 text-red-400 border border-red-500/30'
                    }`}>
                      {ev.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-pl-text max-w-[160px] truncate">{ev.event_organiser || '—'}</td>
                  <td className="px-4 py-3">
                    {ev.url ? (
                      <a href={ev.url} target="_blank" rel="noopener noreferrer" className="text-pl-gold hover:underline text-xs">
                        Open ↗
                      </a>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-pl-muted">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 text-sm rounded-lg border border-pl-border text-pl-text hover:bg-pl-card disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ← Prev
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 text-sm rounded-lg border border-pl-border text-pl-text hover:bg-pl-card disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
