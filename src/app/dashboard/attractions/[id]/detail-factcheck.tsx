'use client'

import { useState, useEffect } from 'react'
import type { AttractionEntry } from './page'

export function FactCheckTab({ entry, save, saving }: { entry: AttractionEntry; save: (u: Partial<AttractionEntry>) => Promise<void>; saving: boolean }) {
  const [factScore, setFactScore] = useState<number>(entry.fact_check_score ?? 0)
  const [tovScore, setTovScore] = useState<number>(entry.fact_check_tov_score ?? 0)
  const [variation, setVariation] = useState<number>(entry.fact_check_variation ?? 0)
  const [status, setStatus] = useState(entry.fact_check_status || 'pending')
  const [flags, setFlags] = useState<string[]>((entry.fact_check_flags as string[]) || [])
  const [newFlag, setNewFlag] = useState('')
  const [results, setResults] = useState<Record<string, unknown>>(entry.fact_check_results || {})
  const [extractedFacts, setExtractedFacts] = useState<string[]>([])
  const [checkedFacts, setCheckedFacts] = useState<Record<number, 'pass' | 'fail' | 'warning'>>({})

  useEffect(() => {
    setFactScore(entry.fact_check_score ?? 0)
    setTovScore(entry.fact_check_tov_score ?? 0)
    setVariation(entry.fact_check_variation ?? 0)
    setStatus(entry.fact_check_status || 'pending')
    setFlags((entry.fact_check_flags as string[]) || [])
    setResults(entry.fact_check_results || {})
  }, [entry])

  useEffect(() => {
    if (!entry.raw_text) return
    const lines = entry.raw_text.split('\n').filter(l => l.trim().length > 0)
    const factPatterns = /^d+|am|pm|AED|USD|OMR|minutes|hours|km|meter|included|excluded|free|available|open|close|located|address/i
    const facts = lines.filter(l => factPatterns.test(l) || l.length > 20)
    setExtractedFacts(facts.slice(0, 30))
  }, [entry.raw_text])

  const getSeoFullText = () => {
    if (!entry.seo_content) return ''
    return Object.values(entry.seo_content)
      .filter(Boolean)
      .map(v => String(v).toLowerCase().replace(/\([^)]+\)\s*\[\d+\]/g, ''))
      .join(' ')
  }

  const autoCheckFact = (fact: string): 'pass' | 'fail' | 'warning' => {
    const seoText = getSeoFullText()
    if (!seoText) return 'warning'
    const factLower = fact.toLowerCase().trim()
    const keyTerms = factLower.match(/\d+[\.\d]*/g) || []
    const words = factLower.split(/\s+/).filter(w => w.length > 4)
    const importantWords = words.filter(w => !['about', 'their', 'these', 'those', 'which', 'would', 'could', 'should', 'there', 'where', 'other'].includes(w))
    const numbersPresent = keyTerms.length === 0 || keyTerms.some(n => seoText.includes(n))
    const matchedWords = importantWords.filter(w => seoText.includes(w))
    const wordMatchRatio = importantWords.length > 0 ? matchedWords.length / importantWords.length : 1
    if (numbersPresent && wordMatchRatio >= 0.6) return 'pass'
    if (numbersPresent && wordMatchRatio >= 0.3) return 'warning'
    return 'fail'
  }

  const runAutoCheck = () => {
    const newChecked: Record<number, 'pass' | 'fail' | 'warning'> = {}
    extractedFacts.forEach((fact, i) => { newChecked[i] = autoCheckFact(fact) })
    setCheckedFacts(newChecked)
    const total = Object.keys(newChecked).length
    if (total === 0) return
    const passed = Object.values(newChecked).filter(v => v === 'pass').length
    const warnings = Object.values(newChecked).filter(v => v === 'warning').length
    const failed = Object.values(newChecked).filter(v => v === 'fail').length
    setFactScore(Math.round(((passed + warnings * 0.5) / total) * 10 * 10) / 10)
    const autoFlags: string[] = []
    if (failed > 0) autoFlags.push(`${failed} fact(s) not found in SEO version`)
    if (warnings > 0) autoFlags.push(`${warnings} fact(s) partially matched - review needed`)
    setFlags(autoFlags)
    setStatus('reviewed')
    setResults({ ...results, total_facts: total, passed, warnings, failed, auto_checked_at: new Date().toISOString() })
  }

  const saveFactCheck = () => save({
    fact_check_score: factScore, fact_check_tov_score: tovScore, fact_check_variation: variation,
    fact_check_status: status, fact_check_results: results, fact_check_flags: flags,
  } as Partial<AttractionEntry>)

  const addFlag = () => { if (newFlag.trim()) { setFlags([...flags, newFlag.trim()]); setNewFlag('') } }
  const removeFlag = (idx: number) => setFlags(flags.filter((_, i) => i !== idx))

  const statusIcon = (s: 'pass' | 'fail' | 'warning') => {
    if (s === 'pass') return <span className="text-emerald-400">&#10003;</span>
    if (s === 'fail') return <span className="text-red-400">&#10007;</span>
    return <span className="text-amber-400">&#9888;</span>
  }

  const statusBg = (s: 'pass' | 'fail' | 'warning') => {
    if (s === 'pass') return 'border-emerald-500/30 bg-emerald-500/5'
    if (s === 'fail') return 'border-red-500/30 bg-red-500/5'
    return 'border-amber-500/30 bg-amber-500/5'
  }

  const hasBothContents = entry.raw_text && entry.seo_content && Object.keys(entry.seo_content).length > 0

  return (
    <div className="space-y-6">
      <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Fact Check - Column C vs Column D</h3>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            status === 'passed' ? 'bg-emerald-500/20 text-emerald-400' :
            status === 'reviewed' ? 'bg-blue-500/20 text-blue-400' :
            status === 'failed' ? 'bg-red-500/20 text-red-400' :
            'bg-gray-600/30 text-gray-400'
          }`}>{status}</span>
        </div>
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/40">
            <p className="text-gray-400 text-xs mb-1 uppercase tracking-wide">Fact Preservation</p>
            <div className="flex items-end gap-1">
              <span className={`text-2xl font-bold ${factScore >= 9 ? 'text-emerald-400' : factScore >= 7 ? 'text-amber-400' : 'text-red-400'}`}>{factScore}</span>
              <span className="text-gray-500 text-sm mb-0.5">/10</span>
            </div>
            <input type="range" min="0" max="10" step="0.5" value={factScore} onChange={e => setFactScore(Number(e.target.value))} className="w-full mt-2 accent-emerald-500 h-1" />
          </div>
          <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/40">
            <p className="text-gray-400 text-xs mb-1 uppercase tracking-wide">TOV Score</p>
            <div className="flex items-end gap-1">
              <span className={`text-2xl font-bold ${tovScore >= 8.5 ? 'text-emerald-400' : tovScore >= 7 ? 'text-amber-400' : 'text-red-400'}`}>{tovScore}</span>
              <span className="text-gray-500 text-sm mb-0.5">/10</span>
            </div>
            <input type="range" min="0" max="10" step="0.5" value={tovScore} onChange={e => setTovScore(Number(e.target.value))} className="w-full mt-2 accent-blue-500 h-1" />
          </div>
          <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/40">
            <p className="text-gray-400 text-xs mb-1 uppercase tracking-wide">Structural Variation</p>
            <div className="flex items-end gap-1">
              <span className={`text-2xl font-bold ${variation >= 35 && variation <= 50 ? 'text-emerald-400' : variation > 50 ? 'text-red-400' : 'text-amber-400'}`}>{variation}</span>
              <span className="text-gray-500 text-sm mb-0.5">%</span>
            </div>
            <input type="range" min="0" max="100" step="1" value={variation} onChange={e => setVariation(Number(e.target.value))} className="w-full mt-2 accent-purple-500 h-1" />
            <p className="text-[10px] text-gray-500 mt-1">Target: 35-50%</p>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/40">
            <p className="text-gray-400 text-xs mb-1 uppercase tracking-wide">Overall Status</p>
            <select value={status} onChange={e => setStatus(e.target.value)} className="w-full mt-1 px-2 py-1.5 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="pending">Pending</option>
              <option value="reviewed">Reviewed</option>
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
            </select>
            <button onClick={saveFactCheck} disabled={saving} className="w-full mt-2 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : 'Save Scores'}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {[{label:'Warmth',key:'warmth'},{label:'Energy',key:'energy'},{label:'Clarity',key:'clarity'},{label:'Commercial',key:'commercial'},{label:'Credibility',key:'credibility'}].map(dim => (
            <div key={dim.key} className="bg-gray-900/30 rounded-lg px-3 py-2 text-center">
              <p className="text-[10px] text-gray-500 uppercase">{dim.label}</p>
              <input type="number" min="1" max="10" step="0.5" value={(results as Record<string,number>)[dim.key]||''} onChange={e=>setResults({...results,[dim.key]:Number(e.target.value)})} placeholder="-" className="w-full text-center bg-transparent text-white text-lg font-semibold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
            </div>
          ))}
        </div>
      </div>

      {hasBothContents && (
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Fact Extraction & Verification</h3>
            <button onClick={runAutoCheck} className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm font-medium rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all">Run Auto-Check</button>
          </div>
          <p className="text-gray-400 text-xs mb-4">Extracts factual anchors from Column C and verifies their presence in Column D.</p>
          {extractedFacts.length > 0 && (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {extractedFacts.map((fact, i) => {
                const check = checkedFacts[i]
                return (
                  <div key={i} className={`flex items-start gap-3 px-3 py-2 rounded-lg border text-sm ${check ? statusBg(check) : 'border-gray-700/40 bg-gray-900/30'}`}>
                    <div className="flex-shrink-0 w-6 text-center mt-0.5">{check ? statusIcon(check) : <span className="text-gray-600 text-xs">{i+1}</span>}</div>
                    <p className={`flex-1 leading-relaxed ${check==='fail'?'text-red-300':check==='warning'?'text-amber-300':'text-gray-300'}`}>{fact.length>200?fact.substring(0,200)+'...':fact}</p>
                    {check && <button onClick={()=>{const ns=check==='pass'?'fail':check==='fail'?'warning':'pass';setCheckedFacts({...checkedFacts,[i]:ns})}} className="flex-shrink-0 text-[10px] text-gray-500 hover:text-white px-2 py-1 rounded bg-gray-700/30">Toggle</button>}
                  </div>
                )
              })}
            </div>
          )}
          {Object.keys(checkedFacts).length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-700/40 flex items-center gap-6 text-xs">
              <span className="text-emerald-400">&#10003; {Object.values(checkedFacts).filter(v=>v==='pass').length} passed</span>
              <span className="text-amber-400">&#9888; {Object.values(checkedFacts).filter(v=>v==='warning').length} warnings</span>
              <span className="text-red-400">&#10007; {Object.values(checkedFacts).filter(v=>v==='fail').length} failed</span>
            </div>
          )}
        </div>
      )}

      <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-5">
        <h3 className="text-white font-semibold mb-3">Non-Negotiable Rules Checklist</h3>
        <div class="grid grid-cols-2 gap-3">
          {[{id:'no_em_dash',label:'No em dashes used',desc:'Replaced with colon, comma, or period'},{id:'no_invented',label:'No invented facts',desc:'No achievements, awards, or details not in source'},{id:'no_song_imply',label:'No song performance implied',desc:'Uses "known for" not "will perform"'},{id:'facts_preserved',label:'100% facts preserved',desc:'All dates, venues, prices, names intact'},{id:'seo_anchors',label:'SEO anchors maintained',desc:'Artist + City + Venue + Date proximity'},{id:'commercial_intent',label:'Commercial intent clear",2026test',desc:'Ticket-selling page, not editorial'},{id:'organiser_safe',label:'Organiser approval safe',desc:'No altered credits, disclaimers, or legal text'},{id:'no_upgrade',label:'No fact upgrading',desc:'No exaggeration of literal statements'}].map(rule => {
            const checked = (results as Record<string,boolean>)[rule.id] || false
            return (
              <div key={rule.id} onClick={()=>setResults({...results,[rule.id]:!checked})} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${checked?'border-emerald-500/30 bg-emerald-500/5':'border-gray-700/40 bg-gray-900/30 hover:border-gray-600"}`}>
                <div class={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 transition-colors ${checked?'border-emerald-500 bg-emerald-500 text-white':'border-gray-600'}`}>{checked && <span class="text-xs">&#10003;</span>}</div>
                <div><p class={`text-sm font-medium ${checked?'text-emerald-400':'text-gray-300'}`}>{rule.label}</p><p class="text-[10px] text-gray-500 mt-0.5">{rule.desc}</p></div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-5">
        <h3 className="text-white font-semibold mb-3">Flags & Issues</h3>
        <div className="flex gap-2 mb-3">
          <input value={newFlag} onChange={e=>setNewFlag(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addFlag()} placeholder="Add a flag or issue..." className="flex-1 px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          <button onClick={addFlag} className="px-4 py-2 bg-red-600/80 text-white text-sm rounded-lg hover:bg-red-600 transition-colors">Add Flag</button>
        </div>
        {flags.length > 0 ? (
          <div className="space-y-2">
            {flags.map((flag, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/20 bg-red-500/5">
                <span className="text-red-400 text-sm flex-shrink-0">&#9888;</span>
                <span className="text-red-300 text-sm flex-1">{flag}</span>
                <button onClick={()=>removeFlag(i)} className="text-gray-500 hover:text-red-400 text-xs">Remove</button>
              </div>
            ))}
          </div>
        ) : <p class="text-gray-500 text-sm italic">No flags raised</p>}
      </div>

      {!hasBothContents && (
        <div class="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5 text-center">
          <p class="text-amber-400 text-sm">Both Column C (Original) and Column D (SEO) content are required. Complete SEo optimization first.</r>
        </div>
      )}
  
  
   5•dbö>
  )
}