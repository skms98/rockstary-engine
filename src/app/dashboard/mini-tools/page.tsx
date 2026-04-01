'use client'

import { useState, useRef, useCallback } from 'react'

type ToolTab = 'shortener' | 'teaser' | 'factchecker' | 'offers' | 'reformatter' | 'transcriber' | 'tagger'
type NumberingMode = 'section' | 'subsection'

interface Tab {
  id: ToolTab
  label: string
  icon: string
  description: string
}

interface ScreenshotItem {
  id: string
  file: File
  preview: string
  base64: string
  label: string
}

const TABS: Tab[] = [
  { id: 'shortener', label: 'Text Shortener', icon: 'CUT', description: 'Shorten text while keeping the meaning' },
  { id: 'teaser', label: 'Teaser Creator', icon: 'TGT', description: 'Create engaging event teasers' },
  { id: 'factchecker', label: 'Fact Checker', icon: 'CHK', description: 'Check and fix text for factual accuracy' },
  { id: 'offers', label: 'New Offers', icon: 'NEW', description: 'Generate fresh promotional offers' },
  { id: 'reformatter', label: 'Bulk Reformatter', icon: 'FMT', description: 'Reformat multiple text blocks at once' },
  { id: 'transcriber', label: 'Table Transcriber', icon: 'TBL', description: 'Convert messy data into clean tables' },
  { id: 'tagger', label: 'Block Tagger', icon: 'TAG', description: 'Tag content blocks with metadata labels -- supports screenshot upload' },
]

const SYSTEM_PROMPTS: Record<ToolTab, string> = {
  shortener: `You are a professional text shortener for Platinumlist, a leading event ticketing platform in the Middle East. Your job is to shorten text while preserving the core meaning, key facts, and tone. Rules: 1) Never invent new information. 2) Keep brand names, dates, prices, and locations intact. 3) Remove filler words, redundant phrases, and unnecessary adjectives. 4) Output ONLY the shortened text, no explanations. 5) If the input is already short, return it as-is.`,

  teaser: `You are a teaser copywriter for Platinumlist. Your job is to create short, punchy event teasers (1-3 sentences) that make people want to buy tickets. Rules: 1) Be exciting but not clickbait. 2) Mention the event name and key selling point. 3) Use action words. 4) Keep it under 280 characters. 5) Output ONLY the teaser text.`,

  factchecker: `You are a fact-checking editor for Platinumlist. You receive TWO versions of text: an OLD version (source of truth) and a NEW version (to be checked). Your job: 1) Compare the NEW version against the OLD version. 2) Flag any factual discrepancies (wrong dates, prices, names, locations, capacities). 3) Flag any added claims not present in the OLD version. 4) If the NEW version is accurate, confirm it. 5) Output a clear verdict with specific issues listed.`,

  offers: `You are a promotional copywriter for Platinumlist. Your job is to generate fresh promotional offer text for events. Rules: 1) Create compelling offer descriptions. 2) Include clear call-to-action. 3) Mention any discounts, early bird pricing, or special packages if provided. 4) Keep the tone professional but exciting. 5) Output ONLY the offer text.`,

  reformatter: `You are a bulk text reformatter for Platinumlist. Your job is to take messy, inconsistently formatted text and reformat it into clean, consistent blocks. Rules: 1) Standardize capitalization. 2) Fix spacing and punctuation. 3) Maintain consistent formatting across all blocks. 4) Do not change the meaning or content. 5) Output ONLY the reformatted text.`,

  transcriber: `You are a table transcriber for Platinumlist. Your job is to take messy data (pasted from screenshots, PDFs, or poorly formatted sources) and convert it into a clean, well-structured table format. Rules: 1) Identify columns and rows from the messy input. 2) Align data correctly. 3) Use consistent formatting. 4) Output as a clean markdown table. 5) If data is ambiguous, make your best guess and note it.`,

  tagger: `You are a content block tagger for Platinumlist. You receive numbered screenshots of content sections from a website or document. Your job is to analyze each screenshot and assign appropriate metadata tags. For each screenshot (identified by its label number), output: 1) The label number. 2) A brief description of what content is shown. 3) Relevant category tags (e.g., event-description, pricing, schedule, venue-info, artist-bio, terms-conditions, faq, hero-banner, navigation, footer, gallery, reviews, map, cta-button, social-links). 4) A content-type tag (text, image, list, table, heading, mixed, form, card-grid). 5) A priority tag (high, medium, low). Format each block clearly with its label and tags.`,
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function MiniToolsPage() {
  const [activeTab, setActiveTab] = useState<ToolTab>('shortener')
  const [input, setInput] = useState('')
  const [oldVersion, setOldVersion] = useState('')
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const outputRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Block Tagger state
  const [screenshots, setScreenshots] = useState<ScreenshotItem[]>([])
  const [numberingMode, setNumberingMode] = useState<NumberingMode>('section')
  const [sectionBase, setSectionBase] = useState('1')
  const [dragOver, setDragOver] = useState(false)

  const activeTabData = TABS.find(t => t.id === activeTab)!

  const applyNumbering = useCallback((items: ScreenshotItem[], mode: NumberingMode, base: string): ScreenshotItem[] => {
    return items.map((item, idx) => {
      if (mode === 'section') {
        return { ...item, label: String(idx + 1) }
      } else {
        const baseNum = base || '1'
        return { ...item, label: `${baseNum}.${idx + 1}` }
      }
    })
  }, [])

  const handleScreenshotUpload = async (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const newItems: ScreenshotItem[] = []

    for (const file of fileArray) {
      if (!file.type.startsWith('image/')) continue
      const base64 = await fileToBase64(file)
      newItems.push({
        id: generateId(),
        file,
        preview: URL.createObjectURL(file),
        base64,
        label: '',
      })
    }

    const updated = [...screenshots, ...newItems]
    const numbered = applyNumbering(updated, numberingMode, sectionBase)
    setScreenshots(numbered)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      handleScreenshotUpload(e.dataTransfer.files)
    }
  }

  const removeScreenshot = (id: string) => {
    const updated = screenshots.filter(s => s.id !== id)
    const numbered = applyNumbering(updated, numberingMode, sectionBase)
    setScreenshots(numbered)
  }

  const updateScreenshotLabel = (id: string, label: string) => {
    setScreenshots(prev => prev.map(s => s.id === id ? { ...s, label } : s))
  }

  const changeNumberingMode = (mode: NumberingMode) => {
    setNumberingMode(mode)
    const numbered = applyNumbering(screenshots, mode, sectionBase)
    setScreenshots(numbered)
  }

  const changeSectionBase = (base: string) => {
    setSectionBase(base)
    if (numberingMode === 'subsection') {
      const numbered = applyNumbering(screenshots, 'subsection', base)
      setScreenshots(numbered)
    }
  }

  const reNumberAll = () => {
    const numbered = applyNumbering(screenshots, numberingMode, sectionBase)
    setScreenshots(numbered)
  }

  const handleRun = async () => {
    // Block Tagger with screenshots
    if (activeTab === 'tagger' && screenshots.length > 0) {
      setLoading(true)
      setOutput('')

      try {
        const imageData = screenshots.map(s => ({
          data: s.base64,
          label: s.label,
        }))

        const textContext = input.trim()
          ? `Additional context: ${input}\n\nPlease analyze the following ${screenshots.length} numbered screenshots and tag each content block:`
          : `Please analyze the following ${screenshots.length} numbered screenshots and tag each content block:`

        const res = await fetch('/api/mini-tools/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemPrompt: SYSTEM_PROMPTS.tagger,
            userMessage: textContext,
            images: imageData,
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
      return
    }

    // Fact Checker
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
    if (tab !== 'tagger') {
      setScreenshots([])
      setNumberingMode('section')
      setSectionBase('1')
    }
  }

  const canRun = () => {
    if (loading) return false
    if (activeTab === 'tagger') {
      return screenshots.length > 0 || input.trim().length > 0
    }
    if (activeTab === 'factchecker') {
      return input.trim().length > 0 || oldVersion.trim().length > 0
    }
    return input.trim().length > 0
  }

  // Render Block Tagger input panel
  const renderTaggerInput = () => (
    <div className="space-y-4">
      {/* Numbering Mode Toggle */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Numbering Mode</label>
        <div className="flex gap-2">
          <button
            onClick={() => changeNumberingMode('section')}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              numberingMode === 'section'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-gray-800/50 text-gray-400 border border-white/10 hover:border-white/20'
            }`}
          >
            Full Sections (1, 2, 3...)
          </button>
          <button
            onClick={() => changeNumberingMode('subsection')}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              numberingMode === 'subsection'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-gray-800/50 text-gray-400 border border-white/10 hover:border-white/20'
            }`}
          >
            Sub-sections (1.1, 1.2...)
          </button>
        </div>
      </div>

      {/* Section Base Input (sub-section mode) */}
      {numberingMode === 'subsection' && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Section Number</label>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={sectionBase}
              onChange={(e) => changeSectionBase(e.target.value)}
              placeholder="1"
              className="w-20 bg-gray-800/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white text-center focus:outline-none focus:border-amber-500/50"
            />
            <span className="text-gray-500 text-sm">Screenshots will be labeled {sectionBase}.1, {sectionBase}.2, {sectionBase}.3...</span>
          </div>
        </div>
      )}

      {/* Drop Zone */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Screenshots ({screenshots.length} uploaded)
        </label>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl px-4 py-6 text-center cursor-pointer transition-all ${
            dragOver
              ? 'border-amber-400 bg-amber-500/10'
              : 'border-white/10 bg-gray-800/30 hover:border-white/20 hover:bg-gray-800/50'
          }`}
        >
          <div className="text-gray-400 text-sm">
            <span className="font-medium text-gray-300">Click to upload</span> or drag & drop screenshots
          </div>
          <div className="text-gray-500 text-xs mt-1">PNG, JPG, WebP supported</div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleScreenshotUpload(e.target.files)
                e.target.value = ''
              }
            }}
          />
        </div>
      </div>

      {/* Screenshot List */}
      {screenshots.length > 0 && (
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {screenshots.map((shot) => (
            <div key={shot.id} className="flex items-center gap-3 bg-gray-800/40 border border-white/5 rounded-lg p-2">
              <img
                src={shot.preview}
                alt={`Screenshot ${shot.label}`}
                className="w-16 h-12 object-cover rounded border border-white/10 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-xs flex-shrink-0">Label:</span>
                  <input
                    type="text"
                    value={shot.label}
                    onChange={(e) => updateScreenshotLabel(shot.id, e.target.value)}
                    className="w-16 bg-gray-700/50 border border-white/10 rounded px-2 py-1 text-xs text-amber-400 font-mono text-center focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div className="text-gray-500 text-xs mt-0.5 truncate">{shot.file.name}</div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeScreenshot(shot.id) }}
                className="text-gray-500 hover:text-red-400 transition-colors p-1 flex-shrink-0"
                title="Remove screenshot"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Re-number button */}
      {screenshots.length > 1 && (
        <button
          onClick={reNumberAll}
          className="w-full py-2 rounded-lg text-xs font-medium text-gray-400 border border-white/10 hover:border-amber-500/20 hover:text-amber-400 transition-all"
        >
          Re-number all screenshots
        </button>
      )}

      {/* Optional text context */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Additional Context (optional)</label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add any extra instructions or context for tagging..."
          className="w-full h-20 bg-gray-800/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 resize-none"
        />
      </div>
    </div>
  )

  // Render standard text input panel (all other tools)
  const renderStandardInput = () => (
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
    </div>
  )

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
            {activeTab === 'tagger' ? renderTaggerInput() : renderStandardInput()}

            <button
              onClick={handleRun}
              disabled={!canRun()}
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                loading
                  ? 'bg-amber-500/30 text-amber-300 cursor-wait'
                  : !canRun()
                    ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
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
