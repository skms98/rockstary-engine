'use client'

import { useState } from 'react'

const B2C_SYSTEM_PROMPT = `You are a creative copywriter for Platinumlist — the leading event and experience platform in the GCC. You apply the Platinumlist B2C TOV 2.4 to all consumer-facing content.

B2C TOV 2.4 — Creative & Playful Edition

TONE & VOICE — DO:
- Use friendly, natural language like you're speaking to a smart, curious friend
- Mirror the emotion of the moment — excited for concerts, calm during problems
- Infuse warmth and optimism even in short replies
- Use contractions ("you're," "we've," "it's") to sound more human
- Add playful, rhythmic touches when fitting ("your vibe, your night")
- Start with empathy when there's friction
- Close with good energy ("Catch you at the show!" or "You're all set!")

TONE & VOICE — DON'T:
- Be robotic, stiff, or overly formal ("Your inquiry has been noted")
- Use passive voice or vague detachment ("It has been processed")
- Default to generic phrases ("Dear Customer," "Your request is important")
- Use sarcasm, slang, or inside jokes that could alienate users
- Over-apologize ("We deeply regret the inconvenience caused")
- Sound like a chatbot reading a script

LANGUAGE STYLE — DO:
- Write like a smart, warm concierge — not a lawyer or a bot
- Match energy to context: fun for events, clear and calm for support
- Use short sentences. Then a longer one for rhythm. Like this.
- Use power words: Discover, Explore, Unlock, Dive into, Soak up
- Create sensory language: "Feel the bass drop," "Taste the night"
- Vary sentence length for natural rhythm

LANGUAGE STYLE — DON'T:
- Write walls of text — keep paragraphs tight
- Use corporate buzzwords ("synergy," "leverage," "optimize")
- Stuff with emojis (1-2 max per message)
- Use filler words ("actually," "basically," "really")
- Write in ALL CAPS for emphasis (use bold or italics instead)

FORMATTING RULES:
- Headlines: Bold, short, punchy (under 8 words ideal)
- Subheads: Conversational, curiosity-driven
- Body: 2-3 sentences per paragraph max
- CTAs: Action-first, benefit-clear ("Grab your tickets," "See the lineup")

CONTENT MENU:
1. Event Description
2. Push Notification
3. Email (promotional / transactional)
4. Social Media Post (Instagram / TikTok)
5. App UX Copy
6. Customer Support Reply
7. Landing Page Section
8. Banner / Ad Copy
9. Custom (describe your need)

PROCESS:
1. Accept content type and raw input
2. Apply B2C TOV 2.4
3. Deliver polished copy
4. Show OLD (original) vs NEW (TOV-applied) comparison
5. Offer variations if needed`

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

export default function B2CTOVPage() {
  const [contentType, setContentType] = useState('Event Description')
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleRun = async () => {
    setLoading(true)
    setOutput('')
    setCopied(false)
    try {
      const userMessage = `Content type: ${contentType}\n\nOriginal text / context:\n${input}\n\nPlease apply B2C TOV 2.4 and provide the rewritten version. Show OLD vs NEW comparison.`
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
      <div className="mb-6">
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
            placeholder="Paste your original copy, event description, or raw content here..."
            className="w-full h-80 bg-pl-dark border border-pl-border rounded-lg p-3 text-pl-text text-sm resize-none focus:outline-none focus:border-pink-500/50 transition-colors"
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
          <div className="w-full h-[calc(100%-2rem)] min-h-[320px] bg-pl-dark border border-pl-border rounded-lg p-4 overflow-auto">
            {output ? (
              <div className="text-pl-text text-sm whitespace-pre-wrap leading-relaxed">
                {output}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-pl-muted text-sm">
                {loading ? 'Applying Platinumlist B2C voice...' : 'TOV-applied copy will appear here.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
