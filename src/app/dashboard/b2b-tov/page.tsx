'use client'

import { useState } from 'react'

const B2B_SYSTEM_PROMPT = `You are a senior brand copywriter and strategist for Platinumlist — the region's leading event technology platform, trusted by organizers, governments, and venue operators across the GCC.

PLATINUMLIST B2B TOV 2.2 — FULL GUIDE

CORE IDENTITY:
You write like a sharp, confident partner who understands the business of live events. Your voice is bold, results-oriented, warm, and regionally rooted — never generic or cold. Platinumlist is the infrastructure behind the GCC's live entertainment ecosystem. Make clients feel like they've found a strategic partner, not just a vendor.

TOV PILLARS — APPLY ALL IN EVERY PIECE:
1. Confident & Results-Oriented — Lead with clarity and purpose. Be assertive, not arrogant. "Plan fast. Sell smarter. Grow big." / "We don't just sell tickets — we sell out shows."
2. Exciting & Energetic — Bring momentum and drive, make clients feel the opportunity. "Your next sold-out show starts here." / "The region's hottest events are powered by us."
3. Calming & Reassuring — Offer peace of mind, ease friction and decision anxiety. "You focus on the magic — we'll handle the rest." / "We've got your back — from sign-up to scale-up."
4. Empowering, Human & Warm — Relatable and grounded. Speak like someone who's been in the crowd. "We're with you — from planning to sold out." / "Your vision. Our engine."
5. Bold Yet Professional — Sharp and modern, never robotic or cold. "No fluff. No jargon. Just results that speak for themselves."
6. AI-Driven & Helpful — Showcase AI as a supportive, user-friendly strength. "Smart tools, real-time insights, and the data to back every decision."
7. GCC-Proud & Regionally Fluent — Embed local pride and cultural understanding. "Born in Dubai. Built for the Gulf. Ready for the world." / "We're in it with you — from Riyadh to Jeddah."

HOW TO WRITE:
Step 1 — Understand the Business Moment: Growth, confidence, partnership, innovation, or trust?
Step 2 — Lead with Value: Benefits before features. What does the client gain?
Step 3 — Confident, Direct Phrasing: Trusted advisor energy. Bold but not arrogant. Active voice, strong verbs, short punchy lines.
Step 4 — Back Claims with Substance: Use data and scale. "15+ years", "10,000+ events", "6 GCC markets".
Step 5 — Close with Partnership Energy: Forward-looking CTA. Collaborative, not salesy.

WRITING RULES — DO:
- Lead with benefits, not features
- Use strong verbs: Launch, Scale, Automate, Unlock, Drive, Sell, Grow
- Keep sentences punchy (under 20 words where possible)
- Write in active voice
- Use "you/your" to speak directly to the reader
- Reflect regional context where relevant (GCC, Dubai, Gulf, KSA)
- Show don't tell — use specifics and numbers where possible
- End sections with forward momentum

WRITING RULES — DON'T:
- Sound generic ("We offer best-in-class solutions")
- Use empty buzzwords ("synergy", "leverage", "paradigm", "cutting-edge")
- Be passive or tentative ("We might be able to help")
- Oversell without backing ("The world's greatest platform")
- Use consumer-facing casual tone (this is B2B, not B2C)
- Use em dashes — use regular dashes instead
- Sound cold or corporate ("Please find attached our proposal")

CHECKLIST — before finalising copy:
- Does it lead with a business result?
- Is the voice confident but not arrogant?
- Are all verbs active?
- Is the tone human and friendly?
- Is it free from buzzwords and vague claims?
- Does it reflect local understanding or nuance?
- Would a decision-maker trust and relate to it?

PROCESS:
1. Apply B2B TOV 2.2 pillars to the content
2. Deliver polished copy
3. Show OLD (original) vs NEW (TOV-applied) comparison`

const CONTENT_TYPES = [
  'Homepage Hero',
  'Product Feature Description',
  'AI Tool Overview',
  'B2B Sales Deck Slide',
  'Landing Page Section',
  'Email (outreach / follow-up / support)',
  'Case Study Summary',
  'Social Media Post (LinkedIn)',
  'UX Microcopy',
  'Custom',
]

const AUDIENCES = [
  { value: 'default', label: 'Default', desc: 'Full B2B audience — all segments' },
  { value: 'organisers-promoters', label: 'Organisers & Promoters', desc: 'Results-driven, empowering' },
  { value: 'corporate-enterprise', label: 'Corporate & Enterprise', desc: 'Professional, data-backed' },
  { value: 'venues-destinations', label: 'Venues & Destinations', desc: 'Experiential, footfall-driven' },
  { value: 'government-tourism', label: 'Government & Tourism', desc: 'Strategic, regionally proud' },
]

const AUDIENCE_MODIFIERS: Record<string, string> = {
  default: 'Write for the full Platinumlist B2B audience: event organisers, venue managers, promoters, corporate clients, tourism boards, and entertainment executives across the GCC.',
  'organisers-promoters': 'Skew toward Event Organisers & Promoters: results-driven, empowering, partnership-focused. Words like scale, reach, sell-out, partnership, audience, momentum. Sample: "Your next sell-out starts here."',
  'corporate-enterprise': 'Skew toward Corporate & Enterprise Clients: professional, data-backed, reliable. Words like ROI, insights, seamless, enterprise-grade, scalable. Sample: "Ticketing infrastructure that scales with your ambition."',
  'venues-destinations': 'Skew toward Venues & Destinations: experiential, footfall-driven, partnership-oriented. Words like footfall, activation, destination, experience, attract. Sample: "Turn your venue into the destination everyone talks about."',
  'government-tourism': 'Skew toward Government & Tourism Boards: strategic, regionally proud, vision-aligned. Words like vision, strategy, cultural impact, tourism growth, national agenda. Sample: "Powering the events ecosystem behind the region\'s boldest visions."',
}

type ConstraintKey = 'minChars' | 'maxChars' | 'minWords' | 'maxWords'

export default function B2BTOVPage() {
  const [contentType, setContentType] = useState('Homepage Hero')
  const [input, setInput] = useState('')
  const [additionalReference, setAdditionalReference] = useState('')
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
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

  const handleRun = async () => {
    setLoading(true)
    setOutput('')
    setCopied(false)
    try {
      // Build audience instruction
      const nonDefault = selectedAudiences.filter(a => a !== 'default')
      let audienceInstruction: string
      if (nonDefault.length === 0) {
        audienceInstruction = AUDIENCE_MODIFIERS.default
      } else if (nonDefault.length === 1) {
        audienceInstruction = AUDIENCE_MODIFIERS[nonDefault[0]]
      } else {
        audienceInstruction = `Blend these audience tones into one cohesive voice:\n${nonDefault.map((a, i) => `${i + 1}. ${AUDIENCE_MODIFIERS[a]}`).join('\n')}`
      }

      // Build constraints block
      const constraintLines: string[] = []
      if (constraints.minChars) constraintLines.push(`Minimum ${constraints.minChars} characters`)
      if (constraints.maxChars) constraintLines.push(`Maximum ${constraints.maxChars} characters`)
      if (constraints.minWords) constraintLines.push(`Minimum ${constraints.minWords} words`)
      if (constraints.maxWords) constraintLines.push(`Maximum ${constraints.maxWords} words`)
      const constraintBlock = constraintLines.length > 0
        ? `\n\nTEXT CONSTRAINTS (MUST respect):\n${constraintLines.map(l => `- ${l}`).join('\n')}`
        : ''

      const userMessage = `Content type: ${contentType}

TARGET AUDIENCE: ${audienceInstruction}
${constraintBlock}
${additionalReference.trim() ? `\nADDITIONAL REFERENCE / CONTEXT:\n${additionalReference}` : ''}

Original text:\n${input}

Please apply B2B TOV 2.2 and provide the rewritten version. Show OLD vs NEW comparison.`

      const res = await fetch('/api/mini-tools/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt: B2B_SYSTEM_PROMPT, userMessage }),
      })
      if (!res.ok) throw new Error('Request failed')
      const data = await res.json()
      setOutput(data.result)
    } catch {
      setOutput('Error: Failed to process. Please try again.')
    }
    setLoading(false)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-pl-dark p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center text-white font-bold text-sm">
            B2B
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">B2B Tone of Voice</h1>
            <p className="text-sm text-pl-muted">Platinumlist B2B TOV 2.2 — Bold, Confident, Results-Driven</p>
          </div>
        </div>
      </div>

      {/* Content Type Selector */}
      <div className="mb-5">
        <label className="text-pl-muted text-xs uppercase tracking-wider mb-2 block">Content Format</label>
        <div className="flex flex-wrap gap-2">
          {CONTENT_TYPES.map(ct => (
            <button
              key={ct}
              onClick={() => setContentType(ct)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                contentType === ct
                  ? 'bg-blue-500/15 border border-blue-500/40 text-blue-400'
                  : 'text-pl-text-dim hover:text-pl-text hover:bg-pl-card border border-transparent'
              }`}
            >
              {ct}
            </button>
          ))}
        </div>
      </div>

      {/* Settings Row: Audience + Constraints */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Audience */}
        <div className="bg-pl-card border border-pl-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs text-pl-muted uppercase tracking-wider">Target Audience</label>
            {selectedAudiences.length > 1 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full border bg-blue-500/15 text-blue-400 border-blue-500/30">
                {selectedAudiences.length} blended
              </span>
            )}
          </div>
          <div className="space-y-1.5">
            {AUDIENCES.map(a => {
              const isSelected = selectedAudiences.includes(a.value)
              return (
                <button
                  key={a.value}
                  onClick={() => toggleAudience(a.value)}
                  className={`w-full text-left px-3 py-2 rounded-lg border transition-all text-sm flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                      : 'border-pl-border text-pl-text-dim hover:border-pl-border/60 hover:bg-pl-dark'
                  }`}
                >
                  <span>
                    <span className="font-medium">{a.label}</span>
                    <span className="text-[10px] text-pl-muted ml-2">{a.desc}</span>
                  </span>
                  <span className={`w-4 h-4 flex-shrink-0 rounded border flex items-center justify-center transition-all ${
                    isSelected ? 'bg-blue-500 border-transparent' : 'border-pl-border'
                  }`}>
                    {isSelected && (
                      <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="text-[10px] text-pl-muted mt-2">Select multiple to blend. Default uses the full B2B voice.</p>
        </div>

        {/* Constraints */}
        <div className="bg-pl-card border border-pl-border rounded-xl p-4">
          <label className="text-xs text-pl-muted uppercase tracking-wider mb-3 block">Text Constraints</label>
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
                  onChange={e => setConstraints(prev => ({ ...prev, [c.key]: e.target.value }))}
                  placeholder="-"
                  className="w-full bg-pl-dark border border-pl-border rounded-lg px-3 py-2 text-sm text-pl-text placeholder-pl-muted/50 focus:outline-none focus:border-blue-500/40"
                />
              </div>
            ))}
          </div>
          <p className="text-[10px] text-pl-muted mt-3">Leave blank for no constraint.</p>
        </div>
      </div>

      {/* Main Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input */}
        <div className="bg-pl-card border border-pl-border rounded-xl p-5">
          <h2 className="text-white font-semibold mb-3 text-sm uppercase tracking-wider">
            Original Text
          </h2>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Paste your original copy, brief, or raw content here..."
            className="w-full h-48 bg-pl-dark border border-pl-border rounded-lg p-3 text-pl-text text-sm resize-none focus:outline-none focus:border-blue-500/50 transition-colors"
          />
          <h2 className="text-white font-semibold mt-4 mb-2 text-sm uppercase tracking-wider">
            Additional Reference
          </h2>
          <textarea
            value={additionalReference}
            onChange={e => setAdditionalReference(e.target.value)}
            placeholder="Extra context, brand notes, links, or specific instructions for the AI..."
            className="w-full h-24 bg-pl-dark border border-pl-border rounded-lg p-3 text-pl-text text-sm resize-none focus:outline-none focus:border-blue-500/50 transition-colors"
          />
          <button
            onClick={handleRun}
            disabled={loading || !input.trim()}
            className={`mt-4 w-full py-3 rounded-lg font-semibold text-sm transition-all ${
              loading
                ? 'bg-blue-500/20 text-blue-400/50 cursor-wait'
                : 'bg-gradient-to-r from-blue-500 to-blue-700 text-white hover:shadow-lg hover:shadow-blue-500/20'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                Applying B2B TOV 2.2...
              </span>
            ) : (
              'Apply B2B TOV 2.2'
            )}
          </button>
        </div>

        {/* Output */}
        <div className="bg-pl-card border border-pl-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-semibold text-sm uppercase tracking-wider">
              TOV-Applied Output
            </h2>
            {output && (
              <button
                onClick={handleCopy}
                className="text-xs px-3 py-1.5 rounded-md bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            )}
          </div>
          <div className="w-full min-h-[420px] bg-pl-dark border border-pl-border rounded-lg p-4 overflow-auto">
            {output ? (
              <div className="text-pl-text text-sm whitespace-pre-wrap leading-relaxed">
                {output}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full min-h-[400px] text-pl-muted text-sm">
                {loading ? 'Applying Platinumlist B2B voice...' : 'TOV-applied copy will appear here.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
