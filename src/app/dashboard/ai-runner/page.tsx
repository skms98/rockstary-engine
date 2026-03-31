'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  workflows?: any[]
}

export default function AIRunnerPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Welcome to the Rockstary AI Runner. Ask me about any workflow, and I will guide you through the steps. I can help with events pipeline, attractions pipeline, categories and tags, setup, troubleshooting, and more.\n\nTry asking things like:\n- "How do I process a new event?"\n- "What are the steps for attractions mode?"\n- "How does the fact check step work?"\n- "How do I add categories and tags?"'
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    fetch('/api/ai-runner/query')
      .then(r => r.json())
      .then(data => {
        if (data.categories) setCategories(data.categories)
      })
      .catch(() => {})
  }, [])

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const question = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: question }])
    setLoading(true)

    try {
      const res = await fetch('/api/ai-runner/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      })

      const data = await res.json()

      if (data.success && data.workflows?.length > 0) {
        const formatted = data.workflows
          .map((w: any) => {
            let text = `**${w.topic}** (${w.category})\n\n${w.steps}`
            if (w.prerequisites) text += `\n\n**Prerequisites:** ${w.prerequisites}`
            if (w.notes) text += `\n\n**Note:** ${w.notes}`
            return text
          })
          .join('\n\n---\n\n')

        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: formatted,
            workflows: data.workflows
          }
        ])
      } else {
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: data.hint || 'No matching workflow found. Try rephrasing your question or browse the available categories below.'
          }
        ])
      }
    } catch (error) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Something went wrong. Please try again.'
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleCategoryClick = (cat: string) => {
    setInput(`Show me workflows for ${cat}`)
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b border-pl-border bg-pl-navy p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">AI Runner</h1>
            <p className="text-xs text-pl-muted">Workflow guide for Rockstary Content Engine</p>
          </div>
        </div>

        {/* Category chips */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => handleCategoryClick(cat)}
                className="px-3 py-1 text-xs rounded-full bg-pl-card border border-pl-border text-pl-text-dim hover:text-pl-gold hover:border-pl-gold/30 transition-all"
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-6 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
                msg.role === 'user'
                  ? 'bg-pl-accent text-white'
                  : 'bg-pl-card border border-pl-border text-pl-text'
              }`}
            >
              <div className="whitespace-pre-wrap">
                {msg.content.split(/\*\*(.*?)\*\*/g).map((part, j) =>
                  j % 2 === 1 ? (
                    <strong key={j} className="text-pl-gold">{part}</strong>
                  ) : (
                    <span key={j}>{part}</span>
                  )
                )}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-pl-card border border-pl-border rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 text-pl-muted text-sm">
                <div className="w-2 h-2 bg-pl-gold rounded-full animate-pulse" />
                <div className="w-2 h-2 bg-pl-gold rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                <div className="w-2 h-2 bg-pl-gold rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                <span className="ml-2">Searching workflows...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-pl-border bg-pl-navy p-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Ask about any Rockstary workflow..."
            className="flex-1 bg-pl-card border border-pl-border rounded-lg px-4 py-3 text-sm text-pl-text placeholder-pl-muted focus:outline-none focus:border-pl-gold/50 transition-colors"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-600 text-white rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            Ask
          </button>
        </div>
      </div>
    </div>
  )
}
