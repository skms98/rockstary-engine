'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

const AI_API_PATHS = [
  '/api/ai/',
  '/api/optimiser/',
  '/api/mini-tools/',
  '/api/tagging/',
  '/api/attractions/generate-seo',
  '/api/ai-runner/',
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Settings panel state
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pinUnlocked, setPinUnlocked] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinLoading, setPinLoading] = useState(false)
  const [customKey, setCustomKey] = useState('')
  const [savedKey, setSavedKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [keySaved, setKeySaved] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [aiMode, setAiMode] = useState<'regular' | 'pro'>('regular')
  const [recoveredPin, setRecoveredPin] = useState('')
  const [recoverLoading, setRecoverLoading] = useState(false)
  const [testKeyStatus, setTestKeyStatus] = useState<'idle' | 'loading' | 'ok' | 'fail'>('idle')
  const pinRef = useRef<HTMLInputElement>(null)

  const isEvents = pathname.startsWith('/dashboard/events') && !pathname.startsWith('/dashboard/events-db')
  const isEventsDB = pathname.startsWith('/dashboard/events-db')
  const isAttractions = pathname.startsWith('/dashboard/attractions')
  const isAIRunner = pathname.startsWith('/dashboard/ai-runner')
  const isTagging = pathname.startsWith('/dashboard/tagging')
  const isMiniTools = pathname.startsWith('/dashboard/mini-tools')
  const isB2BTOV = pathname.startsWith('/dashboard/b2b-tov')
  const isB2CTOV = pathname.startsWith('/dashboard/b2c-tov')
  const isOptimiser = pathname.startsWith('/dashboard/optimiser')
  const isQATagging = pathname.startsWith('/dashboard/qa-tagging')

  // Load saved key and mode from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('rs_custom_ai_key') || ''
    setSavedKey(stored)
    setCustomKey(stored)
    const storedMode = (localStorage.getItem('rs_ai_mode') as 'regular' | 'pro') || 'regular'
    setAiMode(storedMode)
  }, [])

  // Global fetch interceptor — injects x-openai-key and x-ai-mode on every AI API call
  useEffect(() => {
    const origFetch = window.fetch.bind(window)
    window.fetch = function (input: RequestInfo | URL, init: RequestInit = {}) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url
      const key = localStorage.getItem('rs_custom_ai_key')
      const mode = localStorage.getItem('rs_ai_mode') || 'regular'
      if (AI_API_PATHS.some(p => url.includes(p))) {
        const extraHeaders: Record<string, string> = {}
        if (key) extraHeaders['x-openai-key'] = key
        if (mode === 'pro' && key) extraHeaders['x-ai-mode'] = 'pro'
        init = {
          ...init,
          headers: { ...(init.headers as Record<string, string> || {}), ...extraHeaders },
        }
      }
      return origFetch(input as RequestInfo, init)
    }
    return () => { window.fetch = origFetch }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/login')
      else setUser(session.user)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.push('/login')
      else setUser(session.user)
    })
    return () => subscription.unsubscribe()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleOpenSettings = () => {
    setSettingsOpen(true)
    setPinInput('')
    setPinError('')
    setTimeout(() => pinRef.current?.focus(), 100)
  }

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPinLoading(true)
    setPinError('')
    try {
      const res = await fetch('/api/settings/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput }),
      })
      const data = await res.json()
      if (data.ok) {
        setPinUnlocked(true)
      } else {
        setPinError('Incorrect PIN. Try again.')
        setPinInput('')
        pinRef.current?.focus()
      }
    } catch {
      setPinError('Connection error.')
    } finally {
      setPinLoading(false)
    }
  }

  const handleSaveKey = () => {
    const trimmed = customKey.trim()
    localStorage.setItem('rs_custom_ai_key', trimmed)
    setSavedKey(trimmed)
    setKeySaved(true)
    setEditMode(false)
    setTimeout(() => setKeySaved(false), 2000)
  }

  const handleEditKey = () => {
    setCustomKey(savedKey)
    setEditMode(true)
    setShowKey(false)
  }

  const handleDeleteKey = () => {
    localStorage.removeItem('rs_custom_ai_key')
    setSavedKey('')
    setCustomKey('')
    setEditMode(false)
    setShowKey(false)
  }

  const handleCancelEdit = () => {
    setCustomKey(savedKey)
    setEditMode(false)
    setShowKey(false)
  }

  const handleCloseSettings = () => {
    setSettingsOpen(false)
    setPinUnlocked(false)
    setPinInput('')
    setPinError('')
    setShowKey(false)
    setEditMode(false)
    setRecoveredPin('')
  }

  const handleSetMode = (mode: 'regular' | 'pro') => {
    setAiMode(mode)
    localStorage.setItem('rs_ai_mode', mode)
  }

  const handleRecoverPin = async () => {
    setRecoverLoading(true)
    setRecoveredPin('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { setRecoveredPin('Not authenticated.'); return }
      const res = await fetch('/api/settings/recover-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: session.access_token }),
      })
      const data = await res.json()
      if (data.pin) setRecoveredPin(data.pin)
      else setRecoveredPin(data.error || 'Could not retrieve PIN.')
    } catch {
      setRecoveredPin('Connection error.')
    } finally {
      setRecoverLoading(false)
    }
  }

  const handleTestKey = async () => {
    setTestKeyStatus('loading')
    try {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${savedKey}` },
      })
      setTestKeyStatus(res.ok ? 'ok' : 'fail')
    } catch {
      setTestKeyStatus('fail')
    }
  }

  const keyIsActive = savedKey.startsWith('sk-')
  const canAccessSettings = user?.email === 'samir.badawy@platinumlist.net'

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-pl-gold/30 border-t-pl-gold rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} h-screen sticky top-0 bg-pl-navy border-r border-pl-border flex flex-col transition-all duration-300 flex-shrink-0`}>
        {/* Logo */}
        <div className="p-6 border-b border-pl-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-pl-gold to-pl-gold-dark rounded-lg flex items-center justify-center font-bold text-pl-dark text-lg">
              R
            </div>
            {sidebarOpen && (
              <div>
                <h1 className="font-bold text-white">Rockstary</h1>
                <p className="text-[10px] text-pl-muted uppercase tracking-wider">Content Engine</p>
              </div>
            )}
          </div>
        </div>

        {/* Mode Selector */}
        <div className="p-4 space-y-1 overflow-y-auto flex-1">
          {sidebarOpen && (
            <p className="text-[10px] text-pl-muted uppercase tracking-wider px-3 mb-3">Mode</p>
          )}

          <button
            onClick={() => router.push('/dashboard/events')}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
              isEvents ? 'bg-pl-gold/10 border border-pl-gold/30 text-pl-gold' : 'text-pl-text-dim hover:text-pl-text hover:bg-pl-card'
            }`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {sidebarOpen && <span className="font-medium">Events</span>}
          </button>

          <button
            onClick={() => router.push('/dashboard/events-db')}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
              isEventsDB ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'text-pl-text-dim hover:text-pl-text hover:bg-pl-card'
            }`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
            {sidebarOpen && <span className="font-medium">Events DB</span>}
          </button>

          <button
            onClick={() => router.push('/dashboard/attractions')}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
              isAttractions ? 'bg-pl-gold/10 border border-pl-gold/30 text-pl-gold' : 'text-pl-text-dim hover:text-pl-text hover:bg-pl-card'
            }`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {sidebarOpen && <span className="font-medium">Attractions</span>}
          </button>

          <button
            onClick={() => router.push('/dashboard/tagging')}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
              isTagging ? 'bg-pl-gold/10 border border-pl-gold/30 text-pl-gold' : 'text-pl-text-dim hover:text-pl-text hover:bg-pl-card'
            }`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            {sidebarOpen && <span className="font-medium">Tagging</span>}
          </button>

          {sidebarOpen && (
            <div className="pt-4 pb-2">
              <p className="text-[10px] text-pl-muted uppercase tracking-wider px-3 mb-3">Tools</p>
            </div>
          )}

          <button
            onClick={() => router.push('/dashboard/ai-runner')}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
              isAIRunner ? 'bg-purple-500/10 border border-purple-500/30 text-purple-400' : 'text-pl-text-dim hover:text-pl-text hover:bg-pl-card'
            }`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
            </svg>
            {sidebarOpen && <span className="font-medium">AI Runner</span>}
          </button>

          <button
            onClick={() => router.push('/dashboard/mini-tools')}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
              isMiniTools ? 'bg-pl-gold/10 border border-pl-gold/30 text-pl-gold' : 'text-pl-text-dim hover:text-pl-text hover:bg-pl-card'
            }`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {sidebarOpen && <span className="font-medium">Mini Tools</span>}
          </button>

          <button
            onClick={() => router.push('/dashboard/optimiser')}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
              isOptimiser ? 'bg-orange-500/10 border border-orange-500/30 text-orange-400' : 'text-pl-text-dim hover:text-pl-text hover:bg-pl-card'
            }`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            {sidebarOpen && <span className="font-medium">Optimiser</span>}
          </button>

          {sidebarOpen && (
            <div className="pt-4 pb-2">
              <p className="text-[10px] text-pl-muted uppercase tracking-wider px-3 mb-3">Voice</p>
            </div>
          )}

          <button
            onClick={() => router.push('/dashboard/b2b-tov')}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
              isB2BTOV ? 'bg-blue-500/10 border border-blue-500/30 text-blue-400' : 'text-pl-text-dim hover:text-pl-text hover:bg-pl-card'
            }`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            {sidebarOpen && <span className="font-medium">B2B TOV</span>}
          </button>

          <button
            onClick={() => router.push('/dashboard/b2c-tov')}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
              isB2CTOV ? 'bg-pink-500/10 border border-pink-500/30 text-pink-400' : 'text-pl-text-dim hover:text-pl-text hover:bg-pl-card'
            }`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {sidebarOpen && <span className="font-medium">B2C TOV</span>}
          </button>

          {sidebarOpen && (
            <div className="pt-4 pb-2">
              <p className="text-[10px] text-pl-muted uppercase tracking-wider px-3 mb-3">QA</p>
            </div>
          )}

          <button
            onClick={() => router.push('/dashboard/qa-tagging')}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
              isQATagging ? 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400' : 'text-pl-text-dim hover:text-pl-text hover:bg-pl-card'
            }`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {sidebarOpen && <span className="font-medium">QA: Tags &amp; Cats</span>}
          </button>
        </div>

        {/* Toggle sidebar */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-4 border-t border-pl-border text-pl-muted hover:text-pl-text transition-colors"
        >
          <svg className={`w-5 h-5 mx-auto transition-transform ${sidebarOpen ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>

        {/* User + Settings */}
        <div className="p-4 border-t border-pl-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-pl-accent/20 rounded-full flex items-center justify-center text-pl-accent text-sm font-medium flex-shrink-0">
              {user.email?.[0].toUpperCase()}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-xs text-pl-text truncate">{user.email}</p>
                <button onClick={handleLogout} className="text-xs text-pl-muted hover:text-pl-danger transition-colors">
                  Sign Out
                </button>
              </div>
            )}
            {/* Settings gear with active-key dot — only for samir */}
            {canAccessSettings && (
              <button
                onClick={handleOpenSettings}
                title="AI Key Settings"
                className="relative flex-shrink-0 text-pl-muted hover:text-pl-gold transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {keyIsActive && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full" />
                )}
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>

      {/* Settings Modal — only for samir */}
      {settingsOpen && canAccessSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-pl-navy border border-pl-border rounded-2xl w-full max-w-md mx-4 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-pl-border">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-pl-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                <h2 className="font-semibold text-white">AI Key Settings</h2>
              </div>
              <button onClick={handleCloseSettings} className="text-pl-muted hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              {!pinUnlocked ? (
                /* PIN gate */
                <form onSubmit={handlePinSubmit} className="space-y-4">
                  <div className="text-center mb-6">
                    <div className="w-14 h-14 bg-pl-gold/10 border border-pl-gold/20 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-7 h-7 text-pl-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <p className="text-pl-text text-sm">Enter your PIN to access settings</p>
                    <p className="text-pl-muted text-xs mt-1">Settings are PIN-protected</p>
                  </div>

                  <div>
                    <input
                      ref={pinRef}
                      type="password"
                      inputMode="numeric"
                      maxLength={8}
                      value={pinInput}
                      onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="Enter PIN"
                      className="w-full bg-pl-card border border-pl-border rounded-lg px-4 py-3 text-white text-center text-xl tracking-[0.5em] placeholder:tracking-normal placeholder:text-base placeholder:text-pl-muted focus:outline-none focus:border-pl-gold/50 transition-colors"
                    />
                    {pinError && <p className="text-red-400 text-xs mt-2 text-center">{pinError}</p>}
                  </div>

                  <button
                    type="submit"
                    disabled={pinInput.length < 4 || pinLoading}
                    className="w-full bg-pl-gold hover:bg-pl-gold-dark disabled:opacity-40 text-pl-dark font-semibold py-3 rounded-lg transition-colors"
                  >
                    {pinLoading ? 'Verifying...' : 'Unlock'}
                  </button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handleRecoverPin}
                      disabled={recoverLoading}
                      className="text-xs text-pl-muted hover:text-pl-gold transition-colors disabled:opacity-50"
                    >
                      {recoverLoading ? 'Retrieving...' : 'Forgot PIN?'}
                    </button>
                    {recoveredPin && (
                      <div className="mt-2 p-2 rounded-lg bg-pl-gold/10 border border-pl-gold/20">
                        <p className="text-xs text-pl-muted mb-0.5">Your PIN is:</p>
                        <p className="text-lg font-bold text-pl-gold tracking-[0.4em]">{recoveredPin}</p>
                      </div>
                    )}
                  </div>
                </form>
              ) : (
                /* API key panel */
                <div className="space-y-5">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-emerald-400 text-xs font-medium">Settings unlocked for this session</p>
                  </div>

                  <div>
                    <label className="block text-xs text-pl-muted mb-2 uppercase tracking-wider">Additional OpenAI API Key</label>
                    <p className="text-xs text-pl-muted mb-3">
                      Your personal key. Used as a backup when the primary AI service fails. Stored locally in your browser — not shared with anyone.
                    </p>

                    {/* State 2: Key saved and not editing — show masked key + Test + Edit + Delete */}
                    {savedKey && !editMode ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 p-3 bg-pl-card border border-pl-border rounded-lg">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                          <p className="text-sm text-emerald-400 font-mono flex-1 truncate">
                            {savedKey.slice(0, 7)}••••••••••••{savedKey.slice(-4)}
                          </p>
                          {keySaved && (
                            <span className="text-xs text-emerald-400 font-medium">✓ Saved</span>
                          )}
                        </div>
                        <button
                          onClick={handleTestKey}
                          disabled={testKeyStatus === 'loading'}
                          className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm border transition-colors ${
                            testKeyStatus === 'ok'
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              : testKeyStatus === 'fail'
                              ? 'bg-red-500/10 border-red-500/30 text-red-400'
                              : 'border-pl-border text-pl-muted hover:border-pl-gold/40 hover:text-pl-gold'
                          }`}
                        >
                          {testKeyStatus === 'loading' ? (
                            <>
                              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              Testing key...
                            </>
                          ) : testKeyStatus === 'ok' ? (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Key is valid - Pro mode active
                            </>
                          ) : testKeyStatus === 'fail' ? (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Invalid key - check and re-enter
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              Test Key
                            </>
                          )}
                        </button>
                        <div className="flex gap-2">
                          <button
                            onClick={handleEditKey}
                            className="flex-1 flex items-center justify-center gap-2 border border-pl-border text-pl-text hover:bg-pl-card hover:border-pl-gold/40 hover:text-pl-gold py-2.5 rounded-lg text-sm transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit
                          </button>
                          <button
                            onClick={handleDeleteKey}
                            className="flex-1 flex items-center justify-center gap-2 border border-red-500/30 text-red-400 hover:bg-red-500/10 py-2.5 rounded-lg text-sm transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* State 1 & 3: No key saved OR editing — show input */
                      <div className="space-y-3">
                        <div className="relative">
                          <input
                            type={showKey ? 'text' : 'password'}
                            value={customKey}
                            onChange={e => setCustomKey(e.target.value)}
                            placeholder="sk-..."
                            className="w-full bg-pl-card border border-pl-border rounded-lg px-4 py-3 pr-10 text-white text-sm font-mono placeholder:text-pl-muted focus:outline-none focus:border-pl-gold/50 transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => setShowKey(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-pl-muted hover:text-pl-text transition-colors"
                          >
                            {showKey ? (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            )}
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveKey}
                            disabled={!customKey.trim() || customKey.trim() === savedKey}
                            className="flex-1 bg-pl-gold hover:bg-pl-gold-dark disabled:opacity-40 text-pl-dark font-semibold py-2.5 rounded-lg text-sm transition-colors"
                          >
                            {editMode ? 'Update Key' : 'Add Key'}
                          </button>
                          {editMode && (
                            <button
                              onClick={handleCancelEdit}
                              className="px-4 py-2.5 border border-pl-border text-pl-muted hover:text-pl-text hover:bg-pl-card rounded-lg text-sm transition-colors"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* AI Mode Toggle */}
                  <div className="pt-2 border-t border-pl-border">
                    <label className="block text-xs text-pl-muted mb-3 uppercase tracking-wider">AI Mode</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleSetMode('regular')}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all text-sm ${
                          aiMode === 'regular'
                            ? 'bg-pl-gold/10 border-pl-gold/40 text-pl-gold'
                            : 'border-pl-border text-pl-muted hover:border-pl-border/60 hover:text-pl-text'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span className="font-medium">Regular</span>
                        <span className="text-[10px] opacity-70">Standard flow</span>
                      </button>
                      <button
                        onClick={() => handleSetMode('pro')}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all text-sm ${
                          aiMode === 'pro'
                            ? 'bg-purple-500/10 border-purple-500/40 text-purple-400'
                            : 'border-pl-border text-pl-muted hover:border-pl-border/60 hover:text-pl-text'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        <span className="font-medium">Pro</span>
                        <span className="text-[10px] opacity-70">Direct via your key</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-pl-muted text-center mt-2">
                      {aiMode === 'pro'
                        ? 'Pro: skips standard routing, uses your key directly.'
                        : 'Regular: uses standard AI routing with your key as backup.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
