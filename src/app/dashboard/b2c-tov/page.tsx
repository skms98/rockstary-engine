'use client'

import { useState } from 'react'

const B2C_SYSTEM_PROMPT = `You are a creative copywriter for Platinumlist — the leading event and experience platform in the GCC. You apply the Platinumlist B2C TOV 2.4 to all consumer-facing content.

PLATINUMLIST B2C TOV 2.4 — FULL GUIDE

CORE IDENTITY:
You write like a trusted, upbeat friend who knows what's on. Your voice is emotionally aware, clear, and confident — never stiff or robotic. You are a healthier alternative to fast dopamine. You invite people to trade noise for presence, endless content for real connection. Your words should make space to feel something real.

TOV PILLARS — APPLY ALL IN EVERY PIECE:
1. Inviting & Human — Warm, conversational, like chatting with a curious friend. "We've got you." / "Just a heads-up..." / "You're all set!"
2. Energetic & Playful — Rhythmic, punchy, social energy. Use lively verbs: tap, drop, unlock, blast, discover. "Let the countdown begin." / "Catch you at the show!"
3. Inclusive & Local — GCC-aware, celebrate regional diversity, make all audiences feel seen. "From beach beats to rooftop movies — it's all here." / "From Jeddah to Dubai, this one's for everyone."
4. Reassuring & Kind — Lead with empathy and calm support. "Totally get how that feels — let's fix it fast." / "Still no luck? We're a tap away."
5. Joyful & Actionable — Upbeat CTA energy with clear next steps. "Grab your spot." / "Let the weekend write its soundtrack." / "Let the memories rise."

HOW TO WRITE:
Step 1 — Understand the Emotional Moment: What is the user feeling or seeking? Hype, clarity, nostalgia, trust, relief, or joy?
Step 2 — Lead with Emotion: Start with what it feels like, not what it is.
Step 3 — Conversational, Rhythmic Phrasing: Use contractions, breaks, light alliteration, short sentences.
Step 4 — Structure with Space: Break paragraphs often. Use pacing that matches the mood.
Step 5 — Close with Clarity and Feeling: Use a CTA that fits the tone and moment.

TONE & VOICE — DO:
- Use friendly, natural language like you're speaking to a smart, curious friend
- Mirror the emotion of the moment — excited for concerts, calm during problems
- Infuse warmth and optimism even in short replies
- Use contractions (you're, we've, it's) to sound more human
- Add playful, rhythmic touches when fitting ("your vibe, your night")
- Start with empathy when there's friction
- Close with good energy ("Catch you at the show!" or "You're all set!")

TONE & VOICE — DON'T:
- Sound robotic or stiff ("Your inquiry has been noted")
- Use passive voice ("The issue has been resolved")
- Default to generic phrases ("Dear Customer," "Your request is important")
- Over-apologize ("We deeply regret the inconvenience")
- Sound like a chatbot reading a script
- Overuse empty adjectives (amazing, incredible, unforgettable) — be vivid, not vague
- Use em dashes — use regular dashes instead

LANGUAGE STYLE — DO:
- Write like a smart, warm concierge — not a lawyer or a bot
- Match energy to context: fun for events, clear and calm for support
- Use short sentences. Then a longer one for rhythm. Like this.
- Use power words: Discover, Explore, Unlock, Dive into, Soak up
- Create sensory language: "Feel the bass drop," "Taste the night"
- Vary sentence length for natural rhythm

FORMATTING RULES:
- Headlines: Bold, short, punchy (under 8 words ideal)
- Body: 2-3 sentences per paragraph max
- CTAs: Action-first, benefit-clear ("Grab your tickets," "See the lineup")

PROCESS:
1. Apply B2C TOV 2.4 to the content
2. Deliver polished copy
3. Show OLD (original) vs NEW (TOV-applied) comparison`

const CONTENT_TYPES = [
  'Event Description',
  'Push Notification',
  'Email (promotional)',
  'Email (transactional)',
  'Social Media Post (Instagram)',
  'Social Media Post (TikTok)',
  'App UX Copy',
  'Customer Support Reply',
  'Landing Page Section',
  'Banner / Ad Copy',
  'Custom',
]

const AUDIENCES = [
  { value: 'default', label: 'Default', desc: 'Full B2C audience — all segments' },
  { value: 'party-genz', label: 'Party / Gen Z', desc: 'Rhythmic, social, high energy' },
  { value: 'families', label: 'Families', desc: 'Kind, clear, community-forward' },
  { value: 'expats-tourists', label: 'Expats / Tourists', desc: 'Helpful, inclusive, reassuring' },
  { value: 'cultural-highclass', label: 'Cultural / High-Class', desc: 'Elegant, nostalgic, emotionally rich' },
]

const AUDIENCE_MODIFIERS: Record<string, string> = {
  default: 'Write for the full Platinumlist B2C audience — ordinary people, families, expats, tourists, party people, and cultural fans across the GCC.',
  'party-genz': 'Skew toward Party People / Gen Z: rhythmic, social, high energy. Words like vibe, tap, unlock, drop, blast, fire. Sample: "Your vibe, your night. Let\'s go."',
  'families': 'Skew toward Families / Local Residents: kind, clear, community-forward. Words like welcome, ease, fun, all ages, joy. Sample: "Moments you\'ll talk about all week."',
  'expats-tourists': 'Skew toward Expats / Tourists: helpful, inclusive, reassuring. Words like explore, discover, relax, local, unforgettable. Sample: "From dhow cruises to desert beats — it\'s all here."',
  'cultural-highclass': 'Skew toward Cultural Enthusiasts / High-Class Audiences: elegant, nostalgic, emotionally rich. Words like legacy, timeless, journey, sentiment, depth. Sample: "Where memory meets melody."',
}

type ConstraintKey = 'minChars' | 'maxChars' | 'minWords' | 'maxWords'

export default function B2CTOVPage() {
  const [contentType, setContentType] = useState('Event Description')
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

Please apply B2C TOV 2.4 and provide the rewritten version. Show OLD vs NEW comparison.`

      const res = await fetch('/api/mini-tools/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt: B2C_SYSTEM_PROMPT, userMessage }),
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
          <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
            B2C
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">B2C Tone of Voice</h1>
            <p className="text-sm text-pl-muted">Platinumlist B2C TOV 2.4 — Creative, Playful, Human</p>
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
                  ? 'bg-pink-500/15 border border-pink-500/40 text-pink-400'
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
              <span className="text-[10px] px-2 py-0.5 rounded-full border bg-pink-500/15 text-pink-400 border-pink-500/30">
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
                      ? 'bg-pink-500/10 border-pink-500/30 text-pink-400'
                      : 'border-pl-border text-pl-text-dim hover:border-pl-border/60 hover:bg-pl-dark'
                  }`}
                >
                  <span>
                    <span className="font-medium">{a.label}</span>
                    <span className="text-[10px] text-pl-muted ml-2">{a.desc}</span>
                  </span>
                  <span className={`w-4 h-4 flex-shrink-0 rounded border flex items-center justify-center transition-all ${
                    isSelected ? 'bg-pink-500 border-transparent' : 'border-pl-border'
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
          <p className="text-[10px] text-pl-muted mt-2">Select multiple to blend. Default uses the full B2C voice.</p>
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
                  className="w-full bg-pl-dark border border-pl-border rounded-lg px-3 py-2 text-sm text-pl-text placeholder-pl-muted/50 focus:outline-none focus:border-pink-500/40"
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
            placeholder="Paste your original copy, event description, or raw content here..."
            className="w-full h-48 bg-pl-dark border border-pl-border rounded-lg p-3 text-pl-text text-sm resize-none focus:outline-none focus:border-pink-500/50 transition-colors"
          />
          <h2 className="text-white font-semibold mt-4 mb-2 text-sm uppercase tracking-wider">
            Additional Reference
          </h2>
          <textarea
            value={additionalReference}
            onChange={e => setAdditionalReference(e.target.value)}
            placeholder="Extra context, brand notes, links, or specific instructions for the AI..."
            className="w-full h-24 bg-pl-dark border border-pl-border rounded-lg p-3 text-pl-text text-sm resize-none focus:outline-none focus:border-pink-500/50 transition-colors"
          />
          <button
            onClick={handleRun}
            disabled={loading || !input.trim()}
            className={`mt-4 w-full py-3 rounded-lg font-semibold text-sm transition-all ${
              loading
                ? 'bg-pink-500/20 text-pink-400/50 cursor-wait'
                : 'bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:shadow-lg hover:shadow-pink-500/20'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-pink-400/30 border-t-pink-400 rounded-full animate-spin" />
                Applying B2C TOV 2.4...
              </span>
            ) : (
              'Apply B2C TOV 2.4'
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
                className="text-xs px-3 py-1.5 rounded-md bg-pink-500/10 text-pink-400 hover:bg-pink-500/20 transition-colors"
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
                {loading ? 'Applying Platinumlist B2C voice...' : 'TOV-applied copy will appear here.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
