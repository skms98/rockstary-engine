'use client'

import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Screenshot {
  number: number
  url: string
  caption: string
}

interface Workflow {
  id?: string
  category: string
  topic: string
  workflow_steps: string
  prerequisites: string
  notes: string
  mode: string
  reference_url: string
  screenshots: Screenshot[]
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  workflows?: any[]
}

const EMPTY_WORKFLOW: Workflow = {
  category: '',
  topic: '',
  workflow_steps: '',
  prerequisites: '',
  notes: '',
  mode: 'general',
  reference_url: '',
  screenshots: []
}

export default function AIRunnerPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Welcome to the Rockstary AI Runner. Ask me about any workflow, and I will guide you through the steps. I can help with events pipeline, attractions pipeline, categories and tags, setup, troubleshooting, and more.\n\nTry asking things like:\n- \"How do I process a new event?\"\n- \"What are the steps for attractions mode?\"\n- \"How does the fact check step work?\"\n- \"How do I add categories and tags?\"'
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<'chat' | 'manage'>('chat')
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow>(EMPTY_WORKFLOW)
  const [isEditing, setIsEditing] = useState(false)
  const [savingWorkflow, setSavingWorkflow] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    loadCategories()
    loadWorkflows()
  }, [])

  const loadCategories = async () => {
    try {
      const res = await fetch('/api/ai-runner/query')
      const data = await res.json()
      if (data.categories) setCategories(data.categories)
    } catch {}
  }

  const loadWorkflows = async () => {
    const { data } = await supabase
      .from('ai_runner_workflows')
      .select('*')
      .order('category')
      .order('topic')
    if (data) setWorkflows(data)
  }

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
            if (w.reference_url) text += `\n\n**Reference:** ${w.reference_url}`
            if (w.screenshots?.length > 0) {
              text += `\n\n**Screenshots:** ${w.screenshots.length} visual guide(s) available`
            }
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

  // Screenshot management
  const addScreenshot = () => {
    const nextNum = editingWorkflow.screenshots.length + 1
    setEditingWorkflow({
      ...editingWorkflow,
      screenshots: [...editingWorkflow.screenshots, { number: nextNum, url: '', caption: '' }]
    })
  }

  const updateScreenshot = (index: number, field: keyof Screenshot, value: string | number) => {
    const updated = [...editingWorkflow.screenshots]
    updated[index] = { ...updated[index], [field]: value }
    setEditingWorkflow({ ...editingWorkflow, screenshots: updated })
  }

  const removeScreenshot = (index: number) => {
    const updated = editingWorkflow.screenshots.filter((_, i) => i !== index)
    // Re-number
    const renumbered = updated.map((s, i) => ({ ...s, number: i + 1 }))
    setEditingWorkflow({ ...editingWorkflow, screenshots: renumbered })
  }

  const moveScreenshot = (index: number, direction: 'up' | 'down') => {
    const updated = [...editingWorkflow.screenshots]
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= updated.length) return
    ;[updated[index], updated[newIndex]] = [updated[newIndex], updated[index]]
    const renumbered = updated.map((s, i) => ({ ...s, number: i + 1 }))
    setEditingWorkflow({ ...editingWorkflow, screenshots: renumbered })
  }

  const openNewWorkflow = () => {
    setEditingWorkflow(EMPTY_WORKFLOW)
    setIsEditing(false)
    setShowModal(true)
  }

  const openEditWorkflow = (wf: Workflow) => {
    setEditingWorkflow({
      ...wf,
      screenshots: wf.screenshots || [],
      reference_url: wf.reference_url || '',
      prerequisites: wf.prerequisites || '',
      notes: wf.notes || ''
    })
    setIsEditing(true)
    setShowModal(true)
  }

  const saveWorkflow = async () => {
    if (!editingWorkflow.category || !editingWorkflow.topic || !editingWorkflow.workflow_steps) return
    setSavingWorkflow(true)

    try {
      const payload = {
        category: editingWorkflow.category,
        topic: editingWorkflow.topic,
        workflow_steps: editingWorkflow.workflow_steps,
        prerequisites: editingWorkflow.prerequisites || null,
        notes: editingWorkflow.notes || null,
        mode: editingWorkflow.mode || 'general',
        reference_url: editingWorkflow.reference_url || null,
        screenshots: editingWorkflow.screenshots.length > 0 ? editingWorkflow.screenshots : []
      }

      if (isEditing && editingWorkflow.id) {
        await supabase
          .from('ai_runner_workflows')
          .update(payload)
          .eq('id', editingWorkflow.id)
      } else {
        await supabase
          .from('ai_runner_workflows')
          .insert(payload)
      }

      setShowModal(false)
      setEditingWorkflow(EMPTY_WORKFLOW)
      await loadWorkflows()
      await loadCategories()
    } catch (error) {
      console.error('Failed to save workflow:', error)
    } finally {
      setSavingWorkflow(false)
    }
  }

  const deleteWorkflow = async (id: string) => {
    if (!confirm('Delete this workflow?')) return
    await supabase.from('ai_runner_workflows').delete().eq('id', id)
    await loadWorkflows()
    await loadCategories()
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b border-pl-border bg-pl-navy p-6">
        <div className="flex items-center justify-between">
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

          {/* Tab switcher */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-4 py-2 text-sm rounded-lg transition-all ${
                activeTab === 'chat'
                  ? 'bg-purple-500/20 border border-purple-500/40 text-purple-300'
                  : 'text-pl-text-dim hover:text-pl-text hover:bg-pl-card'
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setActiveTab('manage')}
              className={`px-4 py-2 text-sm rounded-lg transition-all ${
                activeTab === 'manage'
                  ? 'bg-purple-500/20 border border-purple-500/40 text-purple-300'
                  : 'text-pl-text-dim hover:text-pl-text hover:bg-pl-card'
              }`}
            >
              Manage
            </button>
          </div>
        </div>

        {/* Category chips - only in chat mode */}
        {activeTab === 'chat' && categories.length > 0 && (
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

      {/* Chat Tab */}
      {activeTab === 'chat' && (
        <>
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
                    {msg.content.split(/\*\*(.+?)\*\*/g).map((part, j) =>
                      j % 2 === 1 ? (
                        <strong key={j} className="text-pl-gold">{part}</strong>
                      ) : (
                        <span key={j}>{part}</span>
                      )
                    )}
                  </div>
                  {/* Show screenshots if available */}
                  {msg.workflows?.some((w: any) => w.screenshots?.length > 0) && (
                    <div className="mt-3 pt-3 border-t border-pl-border">
                      {msg.workflows?.map((w: any) =>
                        w.screenshots?.map((s: Screenshot) => (
                          <div key={`${w.topic}-${s.number}`} className="mt-2">
                            <p className="text-xs text-pl-muted mb-1">Screenshot #{s.number}{s.caption ? `: ${s.caption}` : ''}</p>
                            <img src={s.url} alt={s.caption || `Step ${s.number}`} className="rounded-lg border border-pl-border max-h-64 object-contain" />
                          </div>
                        ))
                      )}
                    </div>
                  )}
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
        </>
      )}

      {/* Manage Tab */}
      {activeTab === 'manage' && (
        <div className="flex-1 overflow-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-white">Workflow Knowledge Base</h2>
              <p className="text-xs text-pl-muted">{workflows.length} workflows</p>
            </div>
            <button
              onClick={openNewWorkflow}
              className="px-4 py-2 bg-pl-gold text-pl-dark rounded-lg font-medium text-sm hover:bg-pl-gold-dark transition-colors"
            >
              + New Workflow
            </button>
          </div>

          <div className="space-y-3">
            {workflows.map(wf => (
              <div key={wf.id} className="bg-pl-card border border-pl-border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 text-[10px] rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {wf.category}
                      </span>
                      <span className="px-2 py-0.5 text-[10px] rounded-full bg-pl-card border border-pl-border text-pl-muted">
                        {wf.mode}
                      </span>
                      {wf.screenshots && wf.screenshots.length > 0 && (
                        <span className="px-2 py-0.5 text-[10px] rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          {wf.screenshots.length} screenshot{wf.screenshots.length > 1 ? 's' : ''}
                        </span>
                      )}
                      {wf.reference_url && (
                        <span className="px-2 py-0.5 text-[10px] rounded-full bg-green-500/20 text-green-300 border border-green-500/30">
                          has URL
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-medium text-white truncate">{wf.topic}</h3>
                    <p className="text-xs text-pl-text-dim mt-1 line-clamp-2">{wf.workflow_steps.substring(0, 150)}...</p>
                  </div>
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    <button
                      onClick={() => openEditWorkflow(wf)}
                      className="px-3 py-1.5 text-xs bg-pl-card border border-pl-border rounded text-pl-text-dim hover:text-pl-gold hover:border-pl-gold/30 transition-all"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => wf.id && deleteWorkflow(wf.id)}
                      className="px-3 py-1.5 text-xs bg-pl-card border border-pl-border rounded text-pl-text-dim hover:text-red-400 hover:border-red-400/30 transition-all"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-pl-navy border border-pl-border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="p-6">
              <h2 className="text-lg font-bold text-white mb-6">
                {isEditing ? 'Edit Workflow' : 'New Workflow'}
              </h2>

              {/* Category & Topic */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs font-medium text-pl-gold block mb-1">Category</label>
                  <input
                    type="text"
                    value={editingWorkflow.category}
                    onChange={e => setEditingWorkflow({ ...editingWorkflow, category: e.target.value })}
                    placeholder="e.g. events-pipeline"
                    className="w-full bg-pl-card border border-pl-border rounded-lg px-3 py-2 text-sm text-pl-text placeholder-pl-muted focus:outline-none focus:border-pl-gold/50"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-pl-gold block mb-1">Mode</label>
                  <select
                    value={editingWorkflow.mode}
                    onChange={e => setEditingWorkflow({ ...editingWorkflow, mode: e.target.value })}
                    className="w-full bg-pl-card border border-pl-border rounded-lg px-3 py-2 text-sm text-pl-text focus:outline-none focus:border-pl-gold/50"
                  >
                    <option value="general">General</option>
                    <option value="events">Events</option>
                    <option value="attractions">Attractions</option>
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="text-xs font-medium text-pl-gold block mb-1">Topic</label>
                <input
                  type="text"
                  value={editingWorkflow.topic}
                  onChange={e => setEditingWorkflow({ ...editingWorkflow, topic: e.target.value })}
                  placeholder="e.g. Processing a new event (full 13-step pipeline)"
                  className="w-full bg-pl-card border border-pl-border rounded-lg px-3 py-2 text-sm text-pl-text placeholder-pl-muted focus:outline-none focus:border-pl-gold/50"
                />
              </div>

              {/* Workflow Steps */}
              <div className="mb-4">
                <label className="text-xs font-medium text-pl-gold block mb-1">Workflow Steps</label>
                <textarea
                  value={editingWorkflow.workflow_steps}
                  onChange={e => setEditingWorkflow({ ...editingWorkflow, workflow_steps: e.target.value })}
                  placeholder="Step-by-step workflow instructions..."
                  rows={6}
                  className="w-full bg-pl-card border border-pl-border rounded-lg px-3 py-2 text-sm text-pl-text placeholder-pl-muted focus:outline-none focus:border-pl-gold/50 resize-y"
                />
              </div>

              {/* Prerequisites & Notes */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs font-medium text-pl-gold block mb-1">Prerequisites</label>
                  <input
                    type="text"
                    value={editingWorkflow.prerequisites}
                    onChange={e => setEditingWorkflow({ ...editingWorkflow, prerequisites: e.target.value })}
                    placeholder="Optional prerequisites..."
                    className="w-full bg-pl-card border border-pl-border rounded-lg px-3 py-2 text-sm text-pl-text placeholder-pl-muted focus:outline-none focus:border-pl-gold/50"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-pl-gold block mb-1">Notes</label>
                  <input
                    type="text"
                    value={editingWorkflow.notes}
                    onChange={e => setEditingWorkflow({ ...editingWorkflow, notes: e.target.value })}
                    placeholder="Optional notes..."
                    className="w-full bg-pl-card border border-pl-border rounded-lg px-3 py-2 text-sm text-pl-text placeholder-pl-muted focus:outline-none focus:border-pl-gold/50"
                  />
                </div>
              </div>

              {/* Reference URL */}
              <div className="mb-4">
                <label className="text-xs font-medium text-pl-gold block mb-1">Reference URL</label>
                <input
                  type="url"
                  value={editingWorkflow.reference_url}
                  onChange={e => setEditingWorkflow({ ...editingWorkflow, reference_url: e.target.value })}
                  placeholder="https://rockstary.vercel.app/dashboard/..."
                  className="w-full bg-pl-card border border-pl-border rounded-lg px-3 py-2 text-sm text-pl-text placeholder-pl-muted focus:outline-none focus:border-pl-gold/50"
                />
              </div>

              {/* Screenshots */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-pl-gold">Screenshots (numbered)</label>
                  <button
                    onClick={addScreenshot}
                    className="px-3 py-1 text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded hover:bg-blue-500/30 transition-colors"
                  >
                    + Add Screenshot
                  </button>
                </div>

                {editingWorkflow.screenshots.length === 0 ? (
                  <p className="text-xs text-pl-muted italic">No screenshots added. Click &quot;+ Add Screenshot&quot; to add visual guides.</p>
                ) : (
                  <div className="space-y-3">
                    {editingWorkflow.screenshots.map((ss, idx) => (
                      <div key={idx} className="bg-pl-card border border-pl-border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-purple-300">Screenshot #{ss.number}</span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => moveScreenshot(idx, 'up')}
                              disabled={idx === 0}
                              className="px-2 py-0.5 text-xs text-pl-muted hover:text-white disabled:opacity-30 transition-colors"
                            >
                              ↑
                            </button>
                            <button
                              onClick={() => moveScreenshot(idx, 'down')}
                              disabled={idx === editingWorkflow.screenshots.length - 1}
                              className="px-2 py-0.5 text-xs text-pl-muted hover:text-white disabled:opacity-30 transition-colors"
                            >
                              ↓
                            </button>
                            <button
                              onClick={() => removeScreenshot(idx)}
                              className="px-2 py-0.5 text-xs text-red-400 hover:text-red-300 transition-colors"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                        <input
                          type="url"
                          value={ss.url}
                          onChange={e => updateScreenshot(idx, 'url', e.target.value)}
                          placeholder="Screenshot URL (paste image link)..."
                          className="w-full bg-pl-navy border border-pl-border rounded px-3 py-1.5 text-xs text-pl-text placeholder-pl-muted focus:outline-none focus:border-pl-gold/50 mb-2"
                        />
                        <input
                          type="text"
                          value={ss.caption}
                          onChange={e => updateScreenshot(idx, 'caption', e.target.value)}
                          placeholder="Caption (e.g. Click the gold button in the top right)..."
                          className="w-full bg-pl-navy border border-pl-border rounded px-3 py-1.5 text-xs text-pl-text placeholder-pl-muted focus:outline-none focus:border-pl-gold/50"
                        />
                        {ss.url && (
                          <img src={ss.url} alt={ss.caption || `Screenshot ${ss.number}`} className="mt-2 rounded border border-pl-border max-h-32 object-contain" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-pl-text-dim hover:text-pl-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveWorkflow}
                  disabled={savingWorkflow || !editingWorkflow.category || !editingWorkflow.topic || !editingWorkflow.workflow_steps}
                  className="px-6 py-2 bg-pl-gold text-pl-dark rounded-lg font-medium text-sm hover:bg-pl-gold-dark disabled:opacity-40 transition-all"
                >
                  {savingWorkflow ? 'Saving...' : isEditing ? 'Update Workflow' : 'Create Workflow'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
