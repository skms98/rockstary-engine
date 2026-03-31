'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// ============================================================
// MINI TOOLS — 7 TABS
// 1. Text Shortener  2. Teaser Creator  3. Fact Checker
// 4. New Offers  5. Bulk Reformatter  6. Table Transcriber
// 7. Block Tagger
// ============================================================

type ToolTab = 'shortener' | 'teaser' | 'factchecker' | 'offers' | 'reformatter' | 'transcriber' | 'tagger'

const TABS: { id: ToolTab; label: string; icon: string }[] = [
  { id: 'shortener',    label: 'Text Shortener',     icon: '✂️' },
  { id: 'teaser',       label: 'Teaser Creator',      icon: '🎯' },
  { id: 'factchecker',  label: 'Fact Checker',        icon: '🔍' },
  { id: 'offers',       label: 'New Offers',          icon: '🎁' },
  { id: 'reformatter',  label: 'Bulk Reformatter',    icon: '📄' },
  { id: 'transcriber',  label: 'Table Transcriber',   icon: '📊' },
  { id: 'tagger',       label: 'Block Tagger',        icon: '🏷️' },
]

// ── System prompts for each tool ────────────────────────────

const SYSTEM_PROMPTS: Record<ToolTab, string> = {
  shortener: `You are a professional text shortening assistant. Follow these steps EXACTLY:

Step 1: Read and understand the original text provided by the user. Text is ideally between 50-200 words.

Step 2: Identify key elements to keep — main subjects, names, places, events, core message, unique details.

Step 3: Rewrite the text to shorten it while maintaining ALL key elements. Make it concise and impactful.

Step 4: Fact-check the rewritten text against the original. Remove any information you are not sure about or that was not in the original.

Step 5: Present the final shortened text.

Step 6: Give a Fact Check Score out of 10 — how accurately does the rewritten text reflect the original facts?

Step 7: Give an Alignment Score out of 10 — how close does the original and rewritten text match in terms of main information and context?

OUTPUT FORMAT:
**Step 1 — Original Text:**
[echo the original text]

**Step 2 — Key Elements:**
[bullet list of key elements]

**Step 3 — Shortened Version:**
[the shortened text]

**Step 4 — Fact Check Notes:**
[any removed or flagged info]

**Step 5 — Final Text:**
[clean final version]

**Step 6 — Fact Check Score:** X/10

**Step 7 — Alignment Score:** X/10`,

  teaser: `You are a conversion-focused teaser generator for Platinumlist. Create short, memorable teasers for events.

Rules for every teaser:
- Maximum 13 words. One sentence. No fragments.
- Start with a strong ACTION VERB (Experience, Discover, Celebrate, Witness, Immerse, Ignite, Embrace, Dance, Laugh, Explore, Savor, Unleash, Elevate, etc.)
- No venue, no date, no CTA ("Book now," "Don't miss")
- No filler ("Get ready," "Join us for")
- No emojis, hashtags, or ALL CAPS
- Must be short, vivid, and capture the experience + vibe

PROCESS:
1. Analyze the event text — core promise, unique hooks, emotions
2. Analyze the target audience — who they are, motivations, tone resonance
3. Analyze the vibe — energy level, mood, sensory cues
4. Generate 8 teaser variants

QUALITY CHECK (silently before returning):
- Verify every line is �i 13 words and starts with an action verb
- Ensure no venue/date slipped in
- Remove filler openings

OUTPUT FORMAT:
Return exactly 8 options, numbered 1-8, each on its own line. Begin each with an action verb. No explanations, notes, or word counts.`,

  factchecker: `You are a precision fact-checker. You compare two versions of text (Old Version and New Version) and ensure they align.

Follow these steps:

**Step 1: Identify Key Facts**
List critical elements from the Old Version:
- Main subjects (names, places, events, brands)
- Dates, times, and locations
- Activities, features, or items mentioned
- Unique phrasing or required tone

**Step 2: Compare New Version**
Evaluate whether each fact is:
- Present in the New Version
- Accurately stated (not changed or misrepresented)
- Consistent in tone and structure

**Step 3: Evaluate Alignment**
Assign a Fact Check Score out of 10:
- 10 = Perfect alignment
- 7–9 = Minor differences that don't change meaning
- 4–6 = Noticeable inconsistencies or omissions
- 1–3 = Major factual shifts or misrepresentation

**Step 4: Side-by-Side Comparison**
Present a comparison table with 3 columns: Key Element | Old Version | New Version

**OUTPUT FORMAT:**
**Fact Check Score:** X/10
**Notes on Alignment:** (brief summary)
**Side-by-Side Comparison:**
| Key Element | Old Version | New Version |
|---|---|---|
| ... | ... | ... |
**Recommendation:** (e.g., "Approved with no edits" or "Revise for tone inconsistency")`,

  offers: `You are a neutral offer description generator. Based STRICTLY on the information provided, create a short, clear announcement.

RULES:
1. Write in a neutral, informative tone (third person)
2. Do NOT use first-person language ("we," "our," "us")
3. Do NOT mention or imply ownership or affiliation with the event, venue, or promotion
4. Do NOT add, invent, or assume any details not explicitly given
5. If a section (e.g., Terms and Conditions) is not present in the input, leave it blank — do NOT fill it in
6. Maintain all core facts as they appear in the original input

FACT CHECK REQUIREMENT:
After writing, compare sentence by sentence with the original input. Ensure 10/10 factual accuracy.
Double-check names, locations, times, included experiences, and all figures/dates.

OUTPUT FORMAT:
**Offer Title:** [concise, engaging headline]

**Offer Description:** [clear explanation, third person, no ownership implied]

**Validity:** [dates/time period if provided]

**Terms and Conditions:** [only if explicitly provided, otherwise leave empty]

**Fact Check Score:** X/10`,

  reformatter: `You are a bulk text reformatter. Your job is to take a large block of unstructured text and split it into clear, organized sections WITHOUT changing any content.

CRITICAL RULES:
1. Do NOT rewrite, rephrase, or alter any text
2. Do NOT add new information
3. Do NOT remove any information
4. Only restructure into clearly labeled section blocks
5. Preserve all original wording exactly as-is
6. Each section should have a clear, descriptive heading based on the content

PROCESS:
1. Read the entire text block
2. Identify natural topic breaks and logical groupings
3. Split into sections with appropriate headings
4. Preserve ALL original text word-for-word within each section

OUTPUT FORMAT:
Return the text organized into sections like:

**[Section Title]**
[Original text for this section, unchanged]

**[Section Title]**
[Original text for this section, unchanged]

After formatting, do a verification:
- Confirm no text was lost
-- Confirm no text was added
- Confirm no text was changed`,

  transcriber: `You are a table-to-sections transcriber. Convert ANY complex table into clear, structured, human-readable sections with 100% accuracy.

Because tables cannot be pasted into the backend, you must rebuild the table content as structured prose with ZERO loss of meaning.

INSTRUCTIONS:

1. **Interpret the Table Structure**
   - Reconstruct rows and columns
   - Identify column headers, sub-headers, row groups, nested categories
   - Identify footnotes, conditions, exceptions

2. **Create Section Blocks**
   - Each logical group from the table becomes its own clearly titled section
   - Use bold headings for section titles
   - Present data in a scannable, readable format

3. **Preserve Every Detail**
   - Every cell value, every condition, every footnote must appear
   - Do not summarize or simplify
   - Do not omit edge cases or exceptions

4. **Format for Readability**
   - Use bullet points or numbered lists where appropriate
   - Bold key terms or category names
   - Group related items together

5. **Final Fact Check**
   - Compare output vs original table line-by-line
   - Confirm 100% data retention
   - Flag anything that could not be clearly transcribed

OUTPUT FORMAT:
Structured sections with clear headings, preserving ALL table data.
End with: **Accuracy Check:** X/10`,

  tagger: `You are an automated content tagger. Assign internal labels to content blocks according to exact wording triggers, content type, and context.

**Step 1: Determine Content Type**
Use breadcrumbs if provided. If missing, use contextual clues:
- **Attraction** — permanent/semi-permanent destination (theme parks, museums). Clues: "attraction," "museum," "theme park"
- **Experience** — interactive activity inside an attraction (VR ride, zipline). Clues: "experience," "ride," "activity"
- **Event** — temporary, scheduled occurrence (concert, festival). Clues: "event," "concert," "festival," "show"
- **Hybrid** — If block follows Attraction format but contains Event cues. Patch Rule: If Attraction features dominate, treat as Attraction.

**Step 2: Apply Trigger Rules**
| Label | Triggers | Type |
|---|---|---|
| Additional Description | biography, about section, additional info | Both |
| Attr-before you visit | important things to know before you visit | Attraction |
| Attr-cancel policy | cancellation policy, cancel policy | Attraction |
| Attr-Exclusions | exclusions, tickets exclude | Attraction |
| Attr-Highlights | highlights | Attraction |
| Attr-Inclusions | inclusions, tickets include | Attraction |
| Attr-Schedule | schedule, opening hours, timings | Attraction |
| Code of Conduct | code of conduct | Both |
| Contact info | contact info, contact details | Both |
| Event info | combined age, language, dress code | Event |
| Event-lineup | lineup, speakers, performers | Event |
| Event-Program | program, programme | Event |
| Event-rules | rules | Event |
| FAQs | FAQs, frequently asked questions | Both |
| How to get there | how to get there | Both |
| Prohibited Items | prohibited items | Both |
| Special Offers | discounts, promos | Both |
| Terms and conditions | terms and conditions | Both |
| Ticket information | ticket offering, ticket info | Both |

**Step 3: Handle Multi-Label Blocks** — Assign all matching labels.

**Step 4: Validate** — Every label must have a matched trigger.

**Step 5: Output JSON**
Return results as JSON array:
[
  {
    "block_index": 1,
    "content_type": "Event / Attraction / Experience / Hybrid",
    "labels": ["Label1"],
    "matched_triggers": ["trigger phrase"]
  }
]`,
}

// ── AI call helper ──────────────────────────────────────────

async function callAI(systemPrompt: string, userMessage: string): Promise<string> {
  const res = await fetch('/api/mini-tools/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ systemPrompt, userMessage }),
  })
  if (!res.ok) throw new Error('AI request failed')
  const data = await res.json()
  return data.result
}

// ── Main Component ──────────────────────────────────────────

export default function MiniToolsPage() {
  const [activeTab, setActiveTab] = useState<ToolTab>('shortener')
  const [input, setInput] = useState('')
  const [oldVersion, setOldVersion] = useState('')   // for fact checker
  const [newVersion, setNewVersion] = useState('')   // for fact checker
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  // Reset inputs when switching tabs
  useEffect(() => {
    setInput('')
    setOldVersion('')
    setNewVersion('')
    setOutput('')
    setCopied(false)
  }, [activeTab])

  const handleRun = async () => {
    setLoading(true)
    setOutput('')
    setCopied(false)
    try {
      let userMessage = ''
      if (activeTab === 'factchecker') {
        userMessage = `**Old Version:**\n${oldVersion}\n\n**New Version:**\n${newVersion}`
      } else if (activeTab === 'tagger') {
        userMessage = `Process the following content blocks and return fully validated JSON:\n\n${input}`
      } else {
        userMessage = input
      }
      const result = await callAI(SYSTEM_PROMPTS[activeTab], userMessage)
      setOutput(result)
    } catch (err) {
      setOutput('Error: Failed to process. Please try again.')
    }
    setLoading(false)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getPlaceholder = (): string => {
    switch (activeTab) {
      case 'shortener': return 'Paste your text here (50-200 words ideal)...'
      case 'teaser': return 'Paste the event description here...'
      case 'offers': return 'Paste the event/offer details here...'
      case 'reformatter': return 'Paste your bulk unstructured text here...'
      case 'transcriber': return 'Paste or describe your table content here...'
      case 'tagger': return 'Paste your content blocks here (one per line or separated by blank lines)...'
      default: return 'Enter your text...'
    }
  }

  return (
    <div className="min-h-screen bg-pl-dark p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <span className="text-pl-gold">⚡</span> Mini Tools
        </h1>
        <p className="text-sm text-pl-muted mt-1">Quick content processing tools — paste, run, copy.</p>
      </div>

      {/* Tab Bar */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-pl-border pb-4">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-pl-gold/15 border border-pl-gold/40 text-pl-gold'
                : 'text-pl-text-dim hover:text-pl-text hover:bg-pl-card border border-transparent'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tool Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <div className="bg-pl-card border border-pl-border rounded-xl p-5">
          <h2 className="text-white font-semibold mb-3 text-sm uppercase tracking-wider">
            Input
          </h2>

          {activeTab === 'factchecker' ? (
            <div className="space-y-4">
              <div>
                <label className="text-pl-muted text-xs uppercase tracking-wider mb-2 block">Old Version (Original)</label>
                <textarea
                  value={oldVersion}
                  onChange={e => setOldVersion(e.target.value)}
                  placeholder="Paste the original text here..."
                  className="w-full h-40 bg-pl-dark border border-pl-border rounded-lg p-3 text-pl-text text-sm resize-none focus:outline-none focus:border-pl-gold/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-pl-muted text-xs uppercase tracking-wider mb-2 block">New Version (Revised)</label>
                <textarea
                  value={newVersion}
                  onChange={e => setNewVersion(e.target.value)}
                  placeholder="Paste the revised/new text here..."
                  className="w-full h-40 bg-pl-dark border border-pl-border rounded-lg p-3 text-pl-text text-sm resize-none focus:outline-none focus:border-pl-gold/50 transition-colors"
                />
              </div>
            </div>
          ) : (
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={getPlaceholder()}
              className="w-full h-80 bg-pl-dark border border-pl-border rounded-lg p-3 text-pl-text text-sm resize-none focus:outline-none focus:border-pl-gold/50 transition-colors"
            />
          )}

          <button
            onClick={handleRun}
            disabled={loading || (activeTab === 'factchecker' ? (!oldVersion.trim() || !newVersion.trim()) : !input.trim())}
            className={`mt-4 w-full py-3 rounded-lg font-semibold text-sm transition-all ${
              loading
                ? 'bg-pl-gold/20 text-pl-gold/50 cursor-wait'
                : 'bg-gradient-to-r from-pl-gold to-pl-gold-dark text-pl-dark hover:shadow-lg hover:shadow-pl-gold/20'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-pl-gold/30 border-t-pl-gold rounded-full animate-spin" />
                Processing...
              </span>
            ) : (
              `Run ${TABS.find(t => t.id === activeTab)?.label}`
            )}
          </button>
        </div>

        {/* Output Panel */}
        <div className="bg-pl-card border border-pl-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-semibold text-sm uppercase tracking-wider">
              Output
            </h2>
            {output && (
              <button
                onClick={handleCopy}
                className="text-xs px-3 py-1.5 rounded-md bg-pl-gold/10 text-pl-gold hover:bg-pl-gold/20 transition-colors"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            )}
          </div>

          <div className="w-full h-[calc(100%-2rem)] min-h-[320px] bg-pl-dark border border-pl-border rounded-lg p-4 overflow-auto">
            {output ? (
              <div className="text-pl-text text-sm whitespace-pre-wrap leading-relaxed prose-sm">
                {output}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-pl-muted text-sm">
                {loading ? 'Processing your request...' : 'Output will appear here after running the tool.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
