// @ts-nocheck
'use client'

import { useState } from 'react'

type ConstraintKey = 'minChars' | 'maxChars' | 'minWords' | 'maxWords'

interface KeywordMapping {
  id: number
  original: string
  action: string
  as_written: string
  times: number
  merged_ids?: number[]
  synonym_of?: string
}

// ─── B2C Audiences ───────────────────────────────────────────────────────────
const B2C_AUDIENCES = [
  { value: 'default', label: 'Default', desc: 'Overall B2C voice - not tailored to any segment' },
  { value: 'party-genz', label: 'Party / Gen Z', desc: 'Rhythmic, social, high energy' },
  { value: 'families', label: 'Families', desc: 'Kind, clear, community-forward' },
  { value: 'expats-tourists', label: 'Expats / Tourists', desc: 'Helpful, inclusive, reassuring' },
  { value: 'cultural-highclass', label: 'Cultural / High-Class', desc: 'Elegant, nostalgic, emotionally rich' },
]

// ─── B2B Audiences ───────────────────────────────────────────────────────────
const B2B_AUDIENCES = [
  { value: 'default', label: 'Default', desc: 'Overall B2B voice - not tailored to any segment' },
  { value: 'organisers-promoters', label: 'Organisers & Promoters', desc: 'Results-driven, empowering' },
  { value: 'corporate-enterprise', label: 'Corporate & Enterprise', desc: 'Professional, data-backed' },
  { value: 'venues-destinations', label: 'Venues & Destinations', desc: 'Experiential, footfall-driven' },
  { value: 'government-tourism', label: 'Government & Tourism', desc: 'Strategic, regionally proud' },
]

// ─── Content Types ───────────────────────────────────────────────────────────
const CONTENT_TYPES = [
  'General',
  'Landing Page',
  'Email',
  'Social Media Post',
  'Ad Copy',
  'Blog / Article',
  'Product Description',
  'Press Release',
  'Proposal / Pitch',
  'Notification / Push',
  'FAQ',
]

// ─── Optimiser Panel Component ───────────────────────────────────────────────
function OptimiserPanel({ type }: { type: 'b2c' | 'b2b' }) {
  const isB2C = type === 'b2c'
  const audiences = isB2C ? B2C_AUDIENCES : B2B_AUDIENCES
  const tovLabel = isB2C ? 'B2C TOV 2.4' : 'B2B TOV 2.2'

  const [rawText, setRawText] = useState('')
  const [keywords, setKeywords] = useState('')
  const [additionalContext, setAdditionalContext] = useState('')
  const [contentType, setContentType] = useState('General')
  const [selectedAudiences, setSelectedAudiences] = useState<string[]>(['default'])
  const [constraints, setConstraints] = useState<Record<ConstraintKey, string>>({ minChars: '', maxChars: '', minWords: '', maxWords: '' })

  const toggleAudience = (value: string) => {
    if (value === 'default') {
      setSelectedAudiences(['default'])
    } else {
      setSelectedAudiences(prev => {
        const withoutDefault = prev.filter(a => a !== 'default')
        if (withoutDefault.includes(value)) {
          const next = withoutDefault.filter(a => a !== value)
          return next.length === 0 ? ['default'] : next
        } else {
          return [...withoutDefault, value]
        }
      })
    }
  }

  const [result, setResult] = useState<string>('')
  const [summary, setSummary] = useState('')
  const [toneNotes, setToneNotes] = useState('')
  const [keywordsUsed, setKeywordsUsed] = useState(0)
  const [keywordsTotal, setKeywordsTotal] = useState(0)
  const [keywordsMapping, setKeywordsMapping] = useState<KeywordMapping[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const handleOptimise = async () => {
    if (!rawText.trim()) {
      setError('Please enter some text to optimise')
      return
    }
    setLoading(true)
    setError('')
    setResult('')
    setSummary('')
    setToneNotes('')
    setKeywordsMapping([])

    try {
      const constraintPayload: Record<string, number> = {}
      if (constraints.minChars) constraintPayload.minChars = parseInt(constraints.minChars)
      if (constraints.maxChars) constraintPayload.maxChars = parseInt(constraints.maxChars)
      if (constraints.minWords) constraintPayload.minWords = parseInt(constraints.minWords)
      if (constraints.maxWords) constraintPayload.maxWords = parseInt(constraints.maxWords)

      const res = await fetch(`/api/optimiser/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText,
          keywords: keywords.trim() || undefined,
          additionalContext: additionalContext.trim() || undefined,
          contentType,
          audiences: selectedAudiences,
          constraints: Object.keys(constraintPayload).length > 0 ? constraintPayload : undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Optimisation failed')

      setResult(data.optimised_text || '')
      setSummary(data.summary || '')
      setToneNotes(data.tone_notes || '')
      setKeywordsUsed(data.keywordsUsed || 0)
      setKeywordsTotal(data.keywordsTotal || 0)
      setKeywordsMapping(data.keywordsMapping || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (!result) return
    // Strip keyword annotations for clean copy
    const clean = result
      .replace(/\(([^)]+)\)\s*\[\d+[\d,\s*]*\*?\]/g, '$1')
      .replace(/\s{2,}/g, ' ')
      .trim()
    navigator.clipboard.writeText(clean)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCopyWithAnnotations = () => {
    if (!result) return
    navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Render annotated text with highlighted keywords
  const renderAnnotatedText = (text: string) => {
    if (!text) return null
    // Split on annotation pattern: (text) [N] or (text) [N1, N2] or (text) [N*]
    const parts = text.split(/(\([^)]+\)\s*\[[^\]]+\])/g)
    return parts.map((part, i) => {
      const annotationMatch = part.match(/^\(([^)]+)\)\s*\[([^\]]+)\]$/)
      if (annotationMatch) {
        const phrase = annotationMatch[1]
        const ids = annotationMatch[2]
        const isSynonym = ids.includes('*')
        const isMerged = ids.includes(',')
        let bgClass = isB2C
          ? 'bg-pl-gold/20 text-pl-gold border-pl-gold/40'
          : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
        if (isSynonym) bgClass = 'bg-amber-500/20 text-amber-300 border-amber-500/40'
        if (isMerged) bgClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'

        return (
          <span key={i} className={`inline-block px-1.5 py-0.5 rounded border text-sm ${bgClass}`} title={`Keywords: [${ids}]${isSynonym ? ' (synonym)' : ''}${isMerged ? ' (merged)' : ''}`}>
            {phrase}
            <sup className="ml-0.5 text-[10px] opacity-70">[{ids}]</sup>
          </span>
        )
      }
      return <span key={i}>{part}</span>
    })
  }

  const accentBg = isB2C ? 'bg-pl-gold' : 'bg-blue-500'
  const accentBgLight = isB2C ? 'bg-pl-gold/10' : 'bg-blue-500/10'
  const accentBorder = isB2C ? 'border-pl-gold/30' : 'border-blue-500/30'
  const accentText = isB2C ? 'text-pl-gold' : 'text-blue-400'
  const accentRing = isB2C ? 'focus:ring-pl-gold/40' : 'focus:ring-blue-500/40'
  const accentLegendClass = isB2C
    ? 'bg-pl-gold/20 text-pl-gold border-pl-gold/40'
    : 'bg-blue-500/20 text-blue-300 border-blue-500/40'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`p-4 rounded-xl ${accentBgLight} ${accentBorder} border`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 ${accentBg} rounded-lg flex items-center justify-center`}>
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <div>
            <h2 className={`text-lg font-bold ${accentText}`}>{isB2C ? 'B2C' : 'B2B'} Optimiser</h2>
            <p className="text-xs text-pl-muted">Applies {tovLabel} with keyword integration</p>
          </div>
        </div>
      </div>

      {/* Input Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Text + Context */}
        <div className="space-y-4">
          {/* Content Type */}
          <div>
            <label className="text-xs text-pl-muted uppercase tracking-wider mb-2 block">Content Type</label>
            <select
              value={contentType}
              onChange={(e) => setContentType(e.target.value)}
              className={`w-full bg-pl-card border border-pl-border rounded-lg px-3 py-2.5 text-sm text-pl-text focus:outline-none focus:ring-2 ${accentRing}`}
            >
              {CONTENT_TYPES.map(ct => <option key={ct} value={ct}>{ct}</option>)}
            </select>
          </div>

          {/* Raw Text */}
          <div>
            <label className="text-xs text-pl-muted uppercase tracking-wider mb-2 block">Original Text *</label>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste the text you want to optimise..."
              rows={10}
              className={`w-full bg-pl-card border border-pl-border rounded-lg px-3 py-2.5 text-sm text-pl-text placeholder-pl-muted/50 focus:outline-none focus:ring-2 ${accentRing} resize-y`}
            />
            <p className="text-[10px] text-pl-muted mt-1">{rawText.length} chars | ~{rawText.trim().split(/\s+/).filter(Boolean).length} words</p>
          </div>

          {/* Additional Context */}
          <div>
            <label className="text-xs text-pl-muted uppercase tracking-wider mb-2 block">Additional Context</label>
            <textarea
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              placeholder="Any extra context, instructions, or notes for the AI..."
              rows={3}
              className={`w-full bg-pl-card border border-pl-border rounded-lg px-3 py-2.5 text-sm text-pl-text placeholder-pl-muted/50 focus:outline-none focus:ring-2 ${accentRing} resize-y`}
            />
          </div>
        </div>

        {/* Right: Keywords + Constraints + Audience */}
        <div className="space-y-4">
          {/* Keywords */}
          <div>
            <label className="text-xs text-pl-muted uppercase tracking-wider mb-2 block">Keywords (one per line)</label>
            <textarea
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder={"burj khalifa tickets\ndubai observation deck\nat the top burj khalifa"}
              rows={6}
              className={`w-full bg-pl-card border border-pl-border rounded-lg px-3 py-2.5 text-sm text-pl-text placeholder-pl-muted/50 focus:outline-none focus:ring-2 ${accentRing} resize-y font-mono`}
            />
            <p className="text-[10px] text-pl-muted mt-1">{keywords.split('\n').filter(k => k.trim()).length} keywords</p>
          </div>

          {/* Audience */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-pl-muted uppercase tracking-wider">Audience</label>
              {selectedAudiences.length > 1 && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${accentLegendClass}`}>
                  {selectedAudiences.length} segments blended
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              {audiences.map(a => {
                const isSelected = selectedAudiences.includes(a.value)
                return (
                  <button
                    key={a.value}
                    onClick={() => toggleAudience(a.value)}
                    className={`w-full text-left px-3 py-2 rounded-lg border transition-all text-sm flex items-center justify-between gap-2 ${
                      isSelected
                        ? `${accentBgLight} ${accentBorder} ${accentText}`
                        : 'border-pl-border text-pl-text-dim hover:border-pl-border/60 hover:bg-pl-card'
                    }`}
                  >
                    <span>
                      <span className="font-medium">{a.label}</span>
                      <span className="text-[10px] text-pl-muted ml-2">{a.desc}</span>
                    </span>
                    <span className={`w-4 h-4 flex-shrink-0 rounded border transition-all flex items-center justify-center ${
                      isSelected ? `${accentBg} border-transparent` : 'border-pl-border'
                    }`}>
                      {isSelected && (
                        <svg className={`w-2.5 h-2.5 ${isB2C ? 'text-pl-dark' : 'text-white'}`} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="text-[10px] text-pl-muted mt-1.5">Select multiple to blend segment tones. Default resets to base voice.</p>
          </div>

          {/* Constraints */}
          <div>
            <label className="text-xs text-pl-muted uppercase tracking-wider mb-2 block">Text Constraints</label>
            <div className="grid grid-cols-2 gap-3">
              {([
                { key: 'minChars' as ConstraintKey, label: 'Min Chars' },
                { key: 'maxChars' as ConstraintKey, label: 'Max Chars' },
                { key: 'minWords' as ConstraintKey, label: 'Min Words' },
                { key: 'maxWords' as ConstraintKey, label: 'Max Words' },
              ]).map(c => (
                <div key={c.key}>
                  <label className="text-[10px] text-pl-muted mb-1 block">{c.label}</label>
                  <input
                    type="number"
                    value={constraints[c.key]}
                    onChange={(e) => setConstraints(prev => ({ ...prev, [c.key]: e.target.value }))}
                    placeholder="-"
                    className={`w-full bg-pl-card border border-pl-border rounded-lg px-3 py-2 text-sm text-pl-text placeholder-pl-muted/50 focus:outline-none focus:ring-2 ${accentRing}`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Optimise Button */}
      <button
        onClick={handleOptimise}
        disabled={loading || !rawText.trim()}
        className={`w-full py-3 rounded-xl font-semibold transition-all ${
          loading || !rawText.trim()
            ? 'bg-pl-border cursor-not-allowed text-pl-muted'
            : `${accentBg} ${isB2C ? 'text-pl-dark' : 'text-white'} hover:opacity-90 active:scale-[0.99]`
        }`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Optimising with {tovLabel}...
          </span>
        ) : (
          `Optimise with ${tovLabel}`
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4">
          {/* Summary + Tone */}
          <div className={`p-4 rounded-xl ${accentBgLight} ${accentBorder} border`}>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 flex-1">
                {summary && <p className="text-sm text-pl-text">{summary}</p>}
                {toneNotes && <p className="text-xs text-pl-muted">Tone: {toneNotes}</p>}
              </div>
              {keywordsTotal > 0 && (
                <div className={`text-right flex-shrink-0 px-3 py-1.5 rounded-lg ${accentBgLight} border ${accentBorder}`}>
                  <p className={`text-lg font-bold ${accentText}`}>{keywordsUsed}/{keywordsTotal}</p>
                  <p className="text-[10px] text-pl-muted">Keywords Used</p>
                </div>
              )}
            </div>
          </div>

          {/* Annotated Output */}
          <div className="bg-pl-card border border-pl-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-pl-text">Optimised Text</h3>
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 text-xs bg-pl-navy border border-pl-border rounded-lg text-pl-text-dim hover:text-pl-text transition-colors"
                >
                  {copied ? 'Copied!' : 'Copy Clean'}
                </button>
                {keywordsTotal > 0 && (
                  <button
                    onClick={handleCopyWithAnnotations}
                    className="px-3 py-1.5 text-xs bg-pl-navy border border-pl-border rounded-lg text-pl-text-dim hover:text-pl-text transition-colors"
                  >
                    Copy with Tags
                  </button>
                )}
              </div>
            </div>
            <div className="text-sm text-pl-text leading-relaxed whitespace-pre-wrap">
              {renderAnnotatedText(result)}
            </div>
            {result && (
              <p className="text-[10px] text-pl-muted mt-3 pt-3 border-t border-pl-border">
                {result.replace(/\([^)]+\)\s*\[[^\]]+\]/g, (m) => m.match(/\(([^)]+)\)/)?.[1] || '').length} chars | ~{result.replace(/\([^)]+\)\s*\[[^\]]+\]/g, (m) => m.match(/\(([^)]+)\)/)?.[1] || '').trim().split(/\s+/).filter(Boolean).length} words (clean text)
              </p>
            )}
          </div>

          {/* Keyword Legend */}
          {keywordsTotal > 0 && (
            <div className="bg-pl-card border border-pl-border rounded-xl p-4">
              <h3 className="text-sm font-semibold text-pl-text mb-3">Keyword Legend</h3>
              <div className="flex gap-4 mb-3 text-[11px]">
                <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border ${accentLegendClass}`}>
                  <span className="w-2 h-2 rounded-full bg-current" /> Standard
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded border bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
                  <span className="w-2 h-2 rounded-full bg-current" /> Merged
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded border bg-amber-500/20 text-amber-300 border-amber-500/40">
                  <span className="w-2 h-2 rounded-full bg-current" /> Synonym
                </span>
              </div>

              {keywordsMapping.length > 0 && (
                <div className="space-y-1.5 mt-3">
                  {keywordsMapping.map((km, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-pl-text-dim">
                      <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
                        km.action === 'used' ? `${accentBgLight} ${accentText}` :
                        km.action.startsWith('merged') ? 'bg-emerald-500/20 text-emerald-400' :
                        km.action === 'synonym' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-pl-border text-pl-muted'
                      }`}>
                        {km.id}
                      </span>
                      <span className="text-pl-muted">{km.original}</span>
                      <span className="text-pl-muted/50 mx-1">-</span>
                      <span className={`${
                        km.action === 'used' ? accentText :
                        km.action.startsWith('merged') ? 'text-emerald-400' :
                        km.action === 'synonym' ? 'text-amber-400' :
                        'text-pl-muted'
                      }`}>
                        {km.action}{km.merged_ids ? ` [${km.merged_ids.join(', ')}]` : ''} ({km.times}x)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function OptimiserPage() {
  const [activeTab, setActiveTab] = useState<'b2c' | 'b2b'>('b2c')

  return (
    <div className="min-h-screen bg-pl-dark p-6">
      <div className="max-w-5xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Optimiser</h1>
          <p className="text-sm text-pl-muted mt-1">Rewrite and optimise content using Platinumlist TOV with keyword integration</p>
        </div>

        {/* Tab Toggle */}
        <div className="flex gap-2 mb-6 p-1 bg-pl-card rounded-xl border border-pl-border w-fit">
          <button
            onClick={() => setActiveTab('b2c')}
            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'b2c'
                ? 'bg-pl-gold text-pl-dark shadow-lg shadow-pl-gold/25'
                : 'text-pl-text-dim hover:text-pl-text'
            }`}
          >
            B2C Optimiser
          </button>
          <button
            onClick={() => setActiveTab('b2b')}
            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'b2b'
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                : 'text-pl-text-dim hover:text-pl-text'
            }`}
          >
            B2B Optimiser
          </button>
        </div>

        {/* Active Panel */}
        {activeTab === 'b2c' ? <OptimiserPanel type="b2c" /> : <OptimiserPanel type="b2b" />}
      </div>
    </div>
  )
}
