// @ts-nocheck
// v2 — ID + URL search filters
'use client'
import { useEffect, useState, useCallback, Fragment } from 'react'

type R = Record<string, unknown>

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—'
const fmtFull = (d) => { try { return d ? new Date(d).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—' } catch { return d||'—' } }
const truthy = (v) => { if(!v) return false; const s=String(v).toLowerCase(); return s==='true'||s==='1'||s==='yes' }
const catFromAll = (a) => { if(!a) return null; const f=a.split(';')[0]?.trim(); return f?.split(',')[0]?.trim()||null }

const SC: Record<string,string> = {
  'on sale':'bg-emerald-900/50 text-emerald-300 border-emerald-700/50',
  'on sale and hidden in the event guide':'bg-teal-900/50 text-teal-300 border-teal-700/50',
  'coming soon':'bg-blue-900/50 text-blue-300 border-blue-700/50',
  'pre-register':'bg-violet-900/50 text-violet-300 border-violet-700/50',
  'approved':'bg-green-900/50 text-green-300 border-green-700/50',
  'sold out':'bg-orange-900/50 text-orange-300 border-orange-700/50',
  'event ended':'bg-zinc-800/60 text-zinc-500 border-zinc-700/40',
  'cancelled':'bg-red-900/50 text-red-400 border-red-700/50',
  'declined':'bg-red-900/50 text-red-400 border-red-700/50',
  'pending':'bg-yellow-900/50 text-yellow-300 border-yellow-700/50',
}
const sCls = (s) => s ? (SC[s.toLowerCase()]||'bg-zinc-800 text-zinc-400 border-zinc-700') : 'bg-zinc-800 text-zinc-500 border-zinc-700'

const CK = ['custom_block_description','custom_block_additional_description','custom_block_event_info_combined',
  'custom_block_attr_highlights','custom_block_attr_inclusions','custom_block_attr_exclusions',
  'custom_block_attr_before_you_visit','custom_block_attr_cancel_policy','custom_block_attr_featured_activities',
  'custom_block_attr_meeting_point','custom_block_attr_schedule','custom_block_attr_timings',
  'custom_block_contact_info','custom_block_event_age_limit','custom_block_event_dress_code',
  'custom_block_event_language','custom_block_event_lineup','custom_block_event_program',
  'custom_block_event_rules','custom_block_faqs','custom_block_how_to_get_there',
  'custom_block_important_updates','custom_block_limited_time_activities','custom_block_new_activities',
  'custom_block_policies','custom_block_special_offers','custom_block_terms_and_conditions',
  'custom_block_ticket_information','custom_block_what_to_expect_event_highlights',
  'custom_block_what_you_can_take_optional','custom_block_undefined']

const INP = 'bg-[#0f1a2e] border border-[#1e3a5f] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c9a84c]'

function BB({ label, val }) {
  if (val===null||val===undefined) return null
  const y = truthy(val)
  return <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${y?'bg-emerald-900/40 text-emerald-400 border-emerald-700/40':'bg-zinc-800/60 text-zinc-500 border-zinc-700/40'}`}>{y?'✓':'✗'} {label}</span>
}

function Fld({ label, value }) {
  if (value===null||value===undefined||value==='') return null
  return <div><div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">{label}</div><div className="text-xs text-zinc-200">{String(value)}</div></div>
}

function TB({ label, en, ar }) {
  if (!en&&!ar) return null
  const box = (v,dir?) => v && <div className={`bg-[#071429] border border-[#1e3a5f]/60 rounded-lg p-3`} dir={dir}><div className="text-[10px] text-zinc-600 mb-1">{dir?'AR':'EN'}</div><p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{v}</p></div>
  return <div className="space-y-2"><div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">{label}</div>{box(en)}{box(ar,'rtl')}</div>
}

function CmsB({ bk, val }) {
  if (!val) return null
  const lbl = bk.replace('custom_block_','').replace(/attr_/g,'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())
  return (
    <div className="border border-[#1e3a5f]/60 rounded-lg overflow-hidden">
      <div className="bg-[#0a1628] px-3 py-2 text-[10px] text-zinc-400 font-semibold uppercase tracking-wide border-b border-[#1e3a5f]/60">{lbl}</div>
      <div className="p-3 text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed bg-[#071429]/80 max-h-56 overflow-y-auto">{val}</div>
    </div>
  )
}

const TABS = ['Overview','Content','Venue','Tickets','Marketing','SEO & Meta','CMS Blocks']

function ExpandedRow({ row: r }) {
  const [tab, setTab] = useState('Overview')
  const ac = CK.filter(k=>r[k])
  const g4 = 'grid grid-cols-2 md:grid-cols-4 gap-3'
  const g2 = 'grid grid-cols-2 gap-3'
  const g3 = 'grid grid-cols-2 md:grid-cols-3 gap-3'
  const bbs = (pairs) => <div className="flex flex-wrap gap-2">{pairs.map(([l,v])=><BB key={l} label={l} val={v}/>)}</div>

  return (
    <div className="bg-[#071429] border-t border-[#1e3a5f]/50">
      <div className="flex items-center gap-0.5 px-4 pt-3 overflow-x-auto border-b border-[#1e3a5f]/40">
        {TABS.map(t=>(
          <button key={t} onClick={()=>setTab(t)} className={`px-3 py-1.5 text-xs font-medium rounded-t-md whitespace-nowrap transition-colors ${tab===t?'bg-[#0f1a2e] text-white border border-b-0 border-[#1e3a5f]':'text-zinc-500 hover:text-zinc-300'}`}>
            {t}{t==='CMS Blocks'&&ac.length>0&&<span className="ml-1 text-zinc-600">({ac.length})</span>}
          </button>
        ))}
      </div>
      <div className="p-4 space-y-4">
        {tab==='Overview' && <div className="space-y-4">
          <div className={g4}><Fld label="Event ID" value={r.event_id}/><Fld label="Status" value={r.status}/><Fld label="Added" value={fmt(r.added_datetime)}/><Fld label="# Dates" value={r.number_of_dates}/></div>
          <div className={g2}><Fld label="URL" value={r.url}/><Fld label="Friendly URL" value={r.friendly_url}/></div>
          <div className={g4}><Fld label="Start" value={fmtFull(r.event_start_datetime)}/><Fld label="End" value={fmtFull(r.event_end_datetime)}/><Fld label="Min Price" value={r.min_price?`${r.min_price} ${r.currency||''}`.trim():null}/><Fld label="Commission" value={r.comission}/></div>
          <div className={g3}><Fld label="Organiser" value={r.event_organiser}/><Fld label="Connected Artist" value={r.connected_artist}/><Fld label="All Categories" value={r.all_categories}/></div>
          <div className={g2}><Fld label="Primary Category" value={r.categories?String(r.categories):catFromAll(r.all_categories)}/><Fld label="Tag Categories" value={r.tag_categories?String(r.tag_categories):null}/></div>
          {(r.primary_category||r.secondary_category)&&<div className={`${g2} p-3 bg-violet-900/10 border border-violet-700/20 rounded-lg`}><Fld label="Tagged Primary" value={r.primary_category}/><Fld label="Tagged Secondary" value={r.secondary_category}/></div>}
          {bbs([['Is Attraction',r.is_attraction],['Exclusive',r.is_exclusive],['Super Event',r.is_super_event],['Video Teaser',r.has_video_teaser],['Schedule Block',r.has_schedule_block],['No Index',r.is_no_index],['Hidden in Guide',r.is_hidden_in_event_guide],['Hidden in Calendar',r.is_hidden_in_calendar]])}
          {r.marketing_tags&&<div><div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Marketing Tags</div><div className="flex flex-wrap gap-1.5">{(Array.isArray(r.marketing_tags)?r.marketing_tags:String(r.marketing_tags).split(',').map(t=>t.trim())).filter(Boolean).map(tag=><span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-[#1e3a5f] text-gray-400 border border-[#2a4d7a] capitalize">{tag}</span>)}</div></div>}
        </div>}

        {tab==='Content' && <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3"><Fld label="Short Name EN" value={r.event_short_name_en}/><Fld label="Short Name AR" value={r.event_short_name_ar}/><Fld label="Long Name EN" value={r.event_long_name_en}/><Fld label="Long Name AR" value={r.event_long_name_ar}/></div>
          <TB label="Description" en={r.description_en} ar={r.description_ar}/>
          <TB label="Overview Description" en={r.overview_description_en} ar={r.overview_description_ar}/>
          <TB label="Text Teaser" en={r.text_teaser_en} ar={r.text_teaser_ar}/>
        </div>}

        {tab==='Venue' && <div className="space-y-4">
          <div className={g4}><Fld label="Venue EN" value={r.venue}/><Fld label="Venue AR" value={r.venue_ar}/><Fld label="City" value={r.city}/><Fld label="Country" value={r.country}/></div>
          <TB label="Venue Info" en={r.venue_info_en} ar={r.venue_info_ar}/>
        </div>}

        {tab==='Tickets' && <div className="space-y-4">
          <div className={g4}><Fld label="Overall Capacity" value={r.overall_capacity}/><Fld label="Tickets Sold" value={r.ticket_sold_count}/><Fld label="Available on Site" value={r.public_tickets_available_on_site}/><Fld label="On Sale Since" value={fmtFull(r.timestamp_on_sale)}/></div>
          {bbs([['General Admission',r.is_general_admission_flag],['Mobile Tickets',r.has_mobile_tickets],['Has Resale',r.has_resale],['Dynamic Pricing',r.has_dynamic_tickets],['Resale Tooltip',r.show_tooltip_about_resale],['Mobile Tooltip',r.show_mobile_ticket_tooltip]])}
          {r.resale_time_restriction&&<Fld label="Resale Time Restriction" value={String(r.resale_time_restriction)}/>}
          <TB label="Mobile Tooltip Description" en={r.mobile_tooltip_description_en} ar={r.mobile_tooltip_description_ar}/>
        </div>}

        {tab==='Marketing' && <div className="space-y-4">
          <div className={g3}><Fld label="Artwork Label" value={r.artwork_label}/><Fld label="Promo Campaign Text" value={r.promo_campaign_text}/><Fld label="All Categories" value={r.all_categories}/></div>
          {bbs([['Banner Active',r.is_banner_active],['Super Event',r.is_super_event],['Exclusive',r.is_exclusive]])}
          {(r.promo_img||r.promo_mob_img||r.img_thumb)&&<div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Images</div>
            <div className="flex gap-3 flex-wrap">{[['Promo Desktop',r.promo_img],['Promo Mobile',r.promo_mob_img],['Thumbnail',r.img_thumb]].filter(([,v])=>v).map(([l,src])=><div key={l} className="space-y-1"><div className="text-[10px] text-zinc-600">{l}</div><img src={src} alt={l} className="h-24 rounded-lg border border-[#1e3a5f] object-cover" onError={e=>{e.target.style.display='none'}}/></div>)}</div>
            <div className="mt-3 space-y-1">{['img_orig','img_full','img_middle','img_feature_mobile','img_featured_mobile_thumb'].filter(k=>r[k]).map(k=><div key={k} className="text-[10px] text-zinc-500 font-mono truncate"><span className="text-zinc-600">{k}: </span>{r[k]}</div>)}</div>
          </div>}
        </div>}

        {tab==='SEO & Meta' && <div className="space-y-4">
          <TB label="Meta Title" en={r.meta_title_en} ar={r.meta_title_ar}/>
          <TB label="Meta Description" en={r.meta_description_en} ar={r.meta_description_ar}/>
          <TB label="Meta Keywords" en={r.meta_keywords_en} ar={r.meta_keywords_ar}/>
          <TB label="SEO Block Text" en={r.seo_block_text_en} ar={r.seo_block_text_ar}/>
          {r.seo_qa_block&&<div><div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">SEO Q&amp;A Block</div><div className="bg-[#071429] border border-[#1e3a5f]/60 rounded-lg p-3 text-xs text-zinc-300 whitespace-pre-wrap max-h-64 overflow-y-auto">{typeof r.seo_qa_block==='string'?r.seo_qa_block:JSON.stringify(r.seo_qa_block,null,2)}</div></div>}
        </div>}

        {tab==='CMS Blocks' && <div>
          {ac.length===0?<p className="text-zinc-600 text-sm py-6 text-center">No CMS content blocks set for this event.</p>:<div className="grid grid-cols-1 gap-3">{ac.map(k=><CmsB key={k} bk={k} val={r[k]}/>)}</div>}
        </div>}
      </div>
    </div>
  )
}

export default function EventsDBPage() {
  const [events,setEvents] = useState<R[]>([])
  const [total,setTotal] = useState(0)
  const [page,setPage] = useState(1)
  const [loading,setLoading] = useState(false)
  const [error,setError] = useState('')
  const [search,setSearch] = useState('')
  const [searchId,setSearchId] = useState('')
  const [searchUrl,setSearchUrl] = useState('')
  const [country,setCountry] = useState('')
  const [city,setCity] = useState('')
  const [active,setActive] = useState('')
  const [typeFilter,setTypeFilter] = useState('')
  const [countries,setCountries] = useState<string[]>([])
  const [expanded,setExpanded] = useState<string|null>(null)
  const totalPages = Math.ceil(total/50)

  useEffect(()=>{ fetch('/api/events-db?countries=1').then(r=>r.json()).then(d=>setCountries(d.countries||[])).catch(()=>{}) },[])

  const fetchEvents = useCallback(async(pg)=>{
    setLoading(true); setError('')
    const p = new URLSearchParams({page:String(pg),...(search&&{search}),...(searchId&&{id:searchId}),...(searchUrl&&{url:searchUrl}),...(country&&{country}),...(city&&{city}),...(active&&{active}),...(typeFilter&&{type:typeFilter})})
    try {
      const res = await fetch(`/api/events-db?${p}`)
      const d = await res.json()
      if(d.error){setError(d.error);return}
      setEvents(d.events||[]); setTotal(d.total||0)
    } catch { setError('Failed to load events') }
    finally { setLoading(false) }
  },[search,searchId,searchUrl,country,city,active,typeFilter])

  useEffect(()=>{setPage(1);setExpanded(null);fetchEvents(1)},[fetchEvents])
  const go = (p)=>{setPage(p);setExpanded(null);fetchEvents(p)}
  const clear = ()=>{setSearch('');setSearchId('');setSearchUrl('');setCountry('');setCity('');setActive('');setTypeFilter('')}

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Events DB</h1>
        <p className="text-sm text-gray-400 mt-1">{total.toLocaleString()} records · sourced from <span className="text-zinc-300 font-mono text-xs">all_events_on_sale</span></p>
      </div>

      <div className="pl-card pl-border rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <input className={`${INP} col-span-2 md:col-span-1`} placeholder="Search event name…" value={search} onChange={e=>setSearch(e.target.value)}/>
          <select className={INP} value={country} onChange={e=>setCountry(e.target.value)}><option value="">All Countries</option>{countries.map(c=><option key={c} value={c}>{c}</option>)}</select>
          <input className={INP} placeholder="City…" value={city} onChange={e=>setCity(e.target.value)}/>
          <select className={INP} value={active} onChange={e=>setActive(e.target.value)}><option value="">All Statuses</option><option value="true">Active (On Sale / Coming)</option><option value="false">Inactive (Ended / Cancelled)</option></select>
          <select className={INP} value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option value="">All Types</option><option value="event">Events only</option><option value="attraction">Attractions only</option></select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input className={INP} placeholder="Search by Event ID…" value={searchId} onChange={e=>setSearchId(e.target.value.replace(/\D/g,''))} inputMode="numeric"/>
          <input className={INP} placeholder="Search by URL (partial match)…" value={searchUrl} onChange={e=>setSearchUrl(e.target.value)}/>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Page {page} of {totalPages||1} · {events.length} rows shown</span>
          <button onClick={clear} className="text-xs px-3 py-1.5 rounded-lg bg-[#1e3a5f] text-gray-300 hover:text-white hover:bg-[#2a4d7a] transition">Clear filters</button>
        </div>
      </div>

      {error&&<div className="text-red-400 text-sm bg-red-900/20 border border-red-700/30 rounded-lg px-4 py-2">{error}</div>}

      <div className="pl-card pl-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e3a5f] bg-[#0a1628]">
                {['','Type','Name','Category','Date','Location','Status','Sold / Cap','Price','Organiser','Link'].map((h,i)=>(
                  <th key={i} className={`px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap${i===0?' w-6 px-3':''}${i===2?' min-w-[220px]':''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading?<tr><td colSpan={11} className="px-4 py-12 text-center text-gray-500">Loading…</td></tr>
              :events.length===0?<tr><td colSpan={11} className="px-4 py-12 text-center text-gray-500">No events found</td></tr>
              :events.map(row=>{
                const isOpen = expanded===row.event_id
                const attr = row.is_attraction===true
                const pc = row.primary_category||(row.categories?String(row.categories):null)||catFromAll(row.all_categories)
                return <Fragment key={String(row.event_id)}>
                  <tr onClick={()=>setExpanded(isOpen?null:row.event_id)} className={`border-b border-[#0f1a2e] cursor-pointer transition-colors ${isOpen?'bg-[#0d2040]':'hover:bg-[#0d1f3a]'}`}>
                    <td className="px-3 py-3 text-zinc-600 text-xs">{isOpen?'▲':'▶'}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${attr?'bg-teal-900/60 text-teal-300 border-teal-700/40':'bg-violet-900/60 text-violet-300 border-violet-700/40'}`}>{attr?'🏛 Attraction':'🎭 Event'}</span></td>
                    <td className="px-4 py-3"><div className="text-white font-medium leading-snug">{row.event_name_en}</div>{row.event_name_ar&&<div className="text-gray-500 text-xs mt-0.5 truncate max-w-[220px]" dir="rtl">{row.event_name_ar}</div>}</td>
                    <td className="px-4 py-3 max-w-[180px]">{pc?<span className="text-xs text-blue-300 block truncate">{pc}</span>:<span className="text-gray-600 text-xs">—</span>}{row.all_categories&&row.all_categories!==pc&&<div className="text-[10px] text-zinc-600 truncate mt-0.5">{row.all_categories}</div>}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-300 text-xs">{fmt(row.event_start_datetime)}{row.event_end_datetime&&row.event_end_datetime!==row.event_start_datetime&&<div className="text-gray-600">→ {fmt(row.event_end_datetime)}</div>}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-300 text-xs"><div>{row.city||'—'}</div>{row.country&&<div className="text-zinc-500">{row.country}</div>}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${sCls(row.status)}`}>{row.status||'—'}</span></td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-400">{(row.ticket_sold_count!==null||row.overall_capacity!==null)?<span>{row.ticket_sold_count??'?'} / {row.overall_capacity??'?'}</span>:<span className="text-zinc-600">—</span>}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-300 text-xs">{row.min_price?`${row.min_price} ${row.currency||''}`.trim():'—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-[140px] truncate">{row.event_organiser||'—'}</td>
                    <td className="px-4 py-3" onClick={e=>e.stopPropagation()}>{row.url?<a href={row.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#c9a84c] hover:text-yellow-300 underline underline-offset-2 whitespace-nowrap">View ↗</a>:<span className="text-gray-600 text-xs">—</span>}</td>
                  </tr>
                  {isOpen&&<tr><td colSpan={11} className="p-0"><ExpandedRow row={row}/></td></tr>}
                </Fragment>
              })}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages>1&&<div className="flex items-center justify-center gap-2">
        <button disabled={page<=1} onClick={()=>go(page-1)} className="px-3 py-1.5 rounded-lg bg-[#1e3a5f] text-gray-300 text-sm disabled:opacity-40 hover:bg-[#2a4d7a] transition">← Prev</button>
        <span className="text-sm text-gray-400">Page {page} / {totalPages}</span>
        <button disabled={page>=totalPages} onClick={()=>go(page+1)} className="px-3 py-1.5 rounded-lg bg-[#1e3a5f] text-gray-300 text-sm disabled:opacity-40 hover:bg-[#2a4d7a] transition">Next →</button>
      </div>}
    </div>
  )
}
