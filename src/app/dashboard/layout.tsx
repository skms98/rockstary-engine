'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const isEvents = pathname.startsWith('/dashboard/events')
  const isAttractions = pathname.startsWith('/dashboard/attractions')
  const isAIRunner = pathname.startsWith('/dashboard/ai-runner')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login')
      } else {
        setUser(session.user)
      }
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

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-pl-gold/30 border-t-pl-gold rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-pl-navy border-r border-pl-border flex flex-col transition-all duration-300`}>
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
        <div className="p-4 space-y-1">
          {sidebarOpen && (
            <p className="text-[10px] text-pl-muted uppercase tracking-wider px-3 mb-3">Mode</p>
          )}

          <button
            onClick={() => router.push('/dashboard/events')}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
              isEvents
                ? 'bg-pl-gold/10 border border-pl-gold/30 text-pl-gold'
                : 'text-pl-text-dim hover:text-pl-text hover:bg-pl-card'
            }`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {sidebarOpen && <span className="font-medium">Events</span>}
          </button>

          <button
            onClick={() => router.push('/dashboard/attractions')}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
              isAttractions
                ? 'bg-pl-gold/10 border border-pl-gold/30 text-pl-gold'
                : 'text-pl-text-dim hover:text-pl-text hover:bg-pl-card'
            }`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {sidebarOpen && <span className="font-medium">Attractions</span>}
          </button>

          {sidebarOpen && (
            <div className="pt-4 pb-2">
              <p className="text-[10px] text-pl-muted uppercase tracking-wider px-3 mb-3">Tools</p>
            </div>
          )}

          <button
            onClick={() => router.push('/dashboard/ai-runner')}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
              isAIRunner
                ? 'bg-purple-500/10 border border-purple-500/30 text-purple-400'
                : 'text-pl-text-dim hover:text-pl-text hover:bg-pl-card'
            }`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
            </svg>
            {sidebarOpen && <span className="font-medium">AI Runner</span>}
          </button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Toggle sidebar */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-4 border-t border-pl-border text-pl-muted hover:text-pl-text transition-colors"
        >
          <svg className={`w-5 h-5 mx-auto transition-transform ${sidebarOpen ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>

        {/* User */}
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
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
