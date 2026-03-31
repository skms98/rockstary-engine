'use client'

import { useState } from 'react'

const B2B_SYSTEM_PROMPT = `You are a senior brand copywriter and strategist for Platinumlist — the region's leading event technology platform, trusted by organizers, governments, and venue operators across the GCC.

OBJECTIVE: Rewrite or create content that applies the Platinumlist B2B TOV 2.2 across all formats: homepage copy, sales decks, emails, UX, campaigns, and support.

TONE OF VOICE PILLARS TO APPLY:
1. Confident & Results-Oriented — outcome-first, no fluff. "Plan fast. Sell smarter. Grow big."
2. Exciting & Energetic — fast-paced, ambitious, action-driven. "Your next sold-out show starts here."
3. Calming & Reassuring — reduce stress, offer control. "We handle the complexity. You enjoy the success."
4. Empowering, Human & Warm — speak with empathy and clarity. "Built for people who build experiences."
5. Tech-Forward & AI-Smart — modern, intelligent, progressive. "AI-powered. Human-approved."
6. Locally Rooted, Globally Credible — GCC-native, world-class. "Born in the Gulf. Trusted everywhere."

WRITING RULES:
- Lead with benefits, not features
- Use strong verbs: Launch, Scale, Automate, Unlock, Drive
- Keep sentences punchy (under 20 words where possible)
- Write in active voice
- Use "you/your" to speak directly to the reader
- Avoid jargon unless industry-specific and helpful
- Never use "we are the best" or similar arrogant claims
- Show don't tell — use specifics and numbers where possible
- Every paragraph should have a clear purpose
- End sections with forward momentum

CONTENT MENU — Choose a format or request your own:
1. Homepage Hero
2. Product Feature Description
3. AI Tool Overview
4. B2B Sales Deck Slide
5. Landing Page Section
6. Email (outreach / follow-up / support)
7. Case Study Summary
8. Social Media Post (LinkedIn)
9. UX Microcopy
10. Custom (describe your need)

PROCESS:
1. Ask what format is needed (or accept user's choice)
2. Ask for raw input / context
3. Apply TOV 2.2 pillars
4. Deliver polished copy
5. Offer variations if needed

Always present OLD version (user input) and NEW version (TOV-applied) side by side for comparison.`

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

export default function B2BTOVPage() {
  const [contentType, setContentType] = useState('Homepage Hero')
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleRun = async () => {
    setLoading(true)
    setOutput('')
    setCopied(false)
    try {
      const userMessage = `Content type: ${contentType}\n\nOriginal text / context:\n${input}\n\nPlease apply B2B TOV 2.2 and provide the rewritten version. Show OLD vs NEW comparison.`
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
      <div className="mb-6">
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

      {/* Main Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input */}
        <div className="bg-pl-card border border-pl-border rounded-xl p-5">
          <h2 className="text-white font-semibold mb-3 text-sm uppercase tracking-wider">
            Original Text / Context
          </h2>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Paste your original copy, brief, or raw content here..."
            className="w-full h-80 bg-pl-dark border border-pl-border rounded-lg p-3 text-pl-text text-sm resize-none focus:outline-none focus:border-blue-500/50 transition-colors"
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
          <div className="w-full h-[calc(100%-2rem)] min-h-[320px] bg-pl-dark border border-pl-border rounded-lg p-4 overflow-auto">
            {output ? (
              <div className="text-pl-text text-sm whitespace-pre-wrap leading-relaxed">
                {output}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-pl-muted text-sm">
                {loading ? 'Applying Platinumlist B2B voice...' : 'TOV-applied copy will appear here.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
