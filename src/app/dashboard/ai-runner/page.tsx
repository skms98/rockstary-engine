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
      content: 'Welcome to the Rockstary AI Runner. Ask me about any workflow, and I will guide you through the steps. I can help with events pipeline, attractions pipeline, mini tools, B2B/B2C tone of voice, categories and tags, setup, troubleshooting, and more.\n\nTry asking things like:\n- \"How do I process a new event?\"\n- \"What are the steps for attractions mode?\"\n- \"How do I use Mini Tools?\"\n- \"What is B2B TOV?\"\n- \"How does the Block Tagger work?\"\n- \"How do I add categories and tags?\"'
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<string[]>([])
  const [mode, setMode] = useState<string>('general')
  const [selectedWidgets, setSelectedWidgets] = useState<string[]>([])
  const [filterCategory, setFilterCategory] = useState<string|null>(null)
  const [activeFilter, setActiveFilter] = useState<string[]>([])
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null)
  const [filteredWorkflows, setFilteredWorkflows] = useState<Workflow[]>([])
  const [userSearch, setUserSearch] = useState<string>('')

  useEffect(() => {
    fetchWorkflows()
  }, [])

  useEffect(() => {
    if (activeFilter.length > 0) {
      const filtered = workflows.filter(wf =>
        activeFilter.some(f => wf.category === f)
      )
      setFilteredWorkflows(filtered)
    } else {
      setFilteredWorkflows(workflows)
    }
  }, [activeFilter, workflows])

  const fetchWorkflows = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase.from('ai_coach').select('*')
      if (error) throw error
      if (data) setWorkflows(data as Workflow[])
    } catch (e) {
      console.error('Error fetching workflows:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleModeChange = (newMode: string) => {
    setMode(newMode)
    const widgetsMap: {[ key: string ]: string[] } = {
      general: [''],
      events: ['Event Pipeline', 'Event Filters', 'Event Tags', 'B2B TOV'],
      attractions: ['Attractions Pipeline', 'Attractions Filters', 'Attractions Tags', 'Block Tagger'],
      mini: ['Mini Tools'],
      admin: ['Categories & Tags Management', 'Setup', 'Troubleshooting']
    }

    if (newMode in widgetsMap) {
      setSelectedWidgets(widgetsMap[newMode])
    } else {
      setSelectedWidgets([])
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!input.trim()) {
      alert('Please enter a message')
      return
    }

    const newMessage: Message = {
      role: 'user',
      content: input,
    }

    setMessages(prev => [...prev, newMessage])
    setInput('')
  }

  return (
    <div className="flex border border-gray-300 h-full rounded-lg">
      <div className="flex flex-col p-6 space-y-4 hover:bg-gray-50">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">AI Runner</h1>
          <select
            value={mode}
            onChange={(e) => handleModeChange(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1 text-sm"
          >
            <option value="general">General</option>
            <option value="events">Events</option>
            <option value="attractions">Attractions</option>
            <option value="mini">Mini Tools</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`p-3 rounded-lg ${msg.role === 'assistant' ? 'bg-gray-100' : 'bg-blue-50'}`}>
              <p className="text-sm font-semibold mb-1">{msg.role === 'assistant' ? 'AI Runner' : 'You'}</p>
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
          ))}
          {loading && <p className="text-sm text-gray-400">Loading...</p>}
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about a workflow..."
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
            Send
          </button>
        </form>
      </div>
    </div>
  )
}
