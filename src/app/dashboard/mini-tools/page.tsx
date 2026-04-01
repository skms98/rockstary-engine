'use client'

import { useState, useRef } from 'react'

type ToolTab = 'shortener' | 'teaser' | 'factchecker' | 'offers' | 'reformatter' | 'transcriber' | 'tagger'

interface Tab {
  id: ToolTab
  label: string
  icon: string
  description: string
}

const TABS: Tab[] = [
  { id: 'shortener', label: 'Text Shortener', icon: 'CUT', description: 'Shorten text while keeping the meaning' },
  { id: 'teaser', label: 'Teaser Creator', icon: 'TGT', description: 'Create engaging event teasers' },
  { id: 'factchecker', label: 'Fact Checker', icon: 'CHK', description: 'Check and fix text for factual accuracy' },
  { id: 'offers', label: 'New Offers', icon: 'NEW', description: 'Generate fresh promotional offers' },
  { id: 'reformatter', label: 'Bulk Reformatter', icon: 'FMT', description: 'Reformat multiple text blocks at once' },
  { id: 'transcriber', label: 'Table Transcriber', icon: 'TBL', description: 'Convert messy data into clean tables' },
  { id: 'tagger', label: 'Block Tagger', icon: 'TAG', description: 'Tag content blocks with metadata labels' },
]

const SYSTEM_PROMPTS: Record<ToolTab, string> = {
  shortener: `You are a professional text shortener for Platinumlist, a leading event ticketing platform in the Middle East. Your job is to shorten text while preserving the core meaning, key facts, and tone. Rules: 1) Never invent new information. 2) Keep brand names, dates, prices, and locations intact. 3) Remove filler words, redundant phrases, and unnecessary adjectives. 4) Output ONLY the shortened text, no explanations. 5) If the input is already short, return it as-is.`,

  teaser: `You are a teaser copywriter for Platinumlist. Your job is to create short, punchy event teasers (1-3 sentences) that make people want to buy tickets. Rules: 1) Be exciting but not clickbait. 2) Mention the event name and key selling point. 3) Use action words. 4) Keep it under 280 characters. 5) Output ONLY the teaser text.`,

  factchecker: `You are a fact-checking editor for Platinumlist. You receive TWO versions of text: an OLD version (source of truth) and a NEW version (to be checked). Your job: 1) Compare the NEW version against the OLD version. 2) Flag any factual discrepancies (wrong dates, prices, names, locations, capacities). 3) Flag any added claims not present in the OLD version. 4) If the NEW version is accurate, confirm it. 5) Output a clear verdict with specific issues listed.`,

  offers: `You are a promotional copywriter for Platinumlist. Your job is to generate fresh promotional offer text for events. Rules: 1) Create compelling offer descriptions. 2) Include clear call-to-action. 3) Mention any discounts, early bird pricing, or special packages if provided. 4) Keep the tone professional but exciting. 5) Output ONLY the offer text.`,

  reformatter: `You are a bulk text reformatter for Platinumlist. Your job is to take messy, inconsistently formatted text and reformat it into clean, consistent blocks. Rules: 1) Standardize capitalization. 2) Fix spacing and punctuation. 3) Maintain consistent formatting across all blocks. 4) Do not change the meaning or content. 5) Output ONLY the reformatted text.`,

  transcriber: `You are a table transcriber for Platinumlist. Your job is to take messy data (pasted from screenshots, PDFs, or poorly formatted sources) and convert it into a clean, well-structured table format. Rules: 1) Identify columns and rows from the messy input. 2) Align data correctly. 3) Use consistent formatting. 4) Output as a clean markdown table. 5) If data is ambiguous, make your best guess and note it.`,

  tagger: `You are a content block tagger for Platinumlist. Your job is to analyze content blocks and assign appropriate metadata tags. Rules: 1) Read each content block carefully. 2) Assign relevant category tags (e.g., event-description, pricing, schedule, venue-info, artist-bio, terms-conditions, faq). 3) Assign a content-type tag (text, list, table, heading). 4) Assign a priority tag (high, medium, low). 5) Output each block with its tags in a clear format.`,
}

export default function MiniToolsPage() {
  const [activeTab, setActiveTab] = useState<ToolTab>('shortener')
  const [input, setInput] = useState('')
  const [oldVersion, setOldVersion] = useState('')
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const outputRef = useRef<HTMLDivElement>(null)

  const activeTabData = TABS.find(t => t.id === activeTab)!

  const handleRun = async () => {
    const userMessage = activeTab === 'factchecker'
      ? `OLD VERSION:\n${oldVersion}\n\nNEW VERSION:\n${input}`
      : input

    if (!userMessage.trim()) return

    setLoading(true)
    setOutput('')

    try {
      const res = await fetch('/api/mini-tools/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: SYSTEM_PROMPTS[activeTab],
          userMessage,
        }),
      })

      const data = await res.json()
      if (data.error) {
        setOutput(`Error: ${data.error}`)
      } else {
        setOutput(data.result)
      }
    } catch (err: any) {
      setOutput(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (output) {
      navigator.clipboard.writeText(output)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleTabChange = (tab: ToolTab) => {
    setActiveTab(tab)
    setInput('')
    setOldVersion('')
    setOutput('')
    setCopied(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
            Mini Tools
          </h1>
          <p className="text-sm text-gray-400 mt-1">Quick AI-powered text utilities for the Platinumlist team</p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="border-b border-white/10 bg-black/20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1 overflow-x-auto py-2 scrollbar-hide">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <span className="text-xs font-bold opacity-60">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="mb-4">
          <p className="text-gray-400 text-sm">{activeTabData.description}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          <div className="space-y-4">
            {activeTab === 'factchecker' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Old Version (source of truth)
                </label>
                <textarea
                  value={oldVersion}
                  onChange={(e) => setOldVersion(e.target.value)}
                  placeholder="Paste the original / old version here..."
                  className="w-full h-40 bg-gray-800/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 resize-none"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {activeTab === 'factchecker' ? 'New Version (to check)' : 'Input'}
              </label>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  activeTab === 'factchecker'
                    ? 'Paste the new / edited version here...'
                    : `Enter text for ${activeTabData.label}...`
                }
                className="w-full h-64 bg-gray-800/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 resize-none"
              />
            </div>

            <button
              onClick={handleRun}
              disabled={loading || (!input.trim() && !(activeTab === 'factchecker' && oldVersion.trim()))}
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                loading
                  ? 'bg-amber-500/30 text-amber-300 cursor-wait'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400 active:scale-[0.98]'
              }`}
            >
              {loading ? 'Processing...' : `Run ${activeTabData.label}`}
            </button>
          </div>

          {/* Output Panel */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-300">Output</label>
              {output && (
                <button
                  onClick={handleCopy}
                  className="text-xs text-gray-400 hover:text-amber-400 transition-colors px-2 py-1 rounded border border-white/10 hover:border-amber-500/30"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              )}
            </div>
            <div
              ref={outputRef}
              className="w-full min-h-[320px] bg-gray-800/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-200 whitespace-pre-wrap overflow-y-auto"
            >
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              ) : output ? (
                output
              ) : (
                <span className="text-gray-500">Output will appear here after running the tool...</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
