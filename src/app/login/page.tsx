'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const router = useRouter()

  const validateEmail = (email: string) => {
    return email.endsWith('@platinumlist.net')
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')

    if (!validateEmail(email)) {
      setError('Only @platinumlist.net email addresses are allowed.')
      return
    }

    setLoading(true)

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          }
        })
        if (error) throw error
        // Auto sign-in after registration (email auto-confirmed via DB trigger)
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
        router.push('/dashboard/events')
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        router.push('/dashboard/events')
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-pl-gold/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pl-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">
            <span className="gold-shimmer">ROCKSTARY</span>
          </h1>
          <p className="text-pl-text-dim text-sm">
            Platinumlist Content Engine
          </p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="w-8 h-px bg-pl-border" />
            <span className="text-xs text-pl-muted uppercase tracking-widest">Events & Attractions</span>
            <span className="w-8 h-px bg-pl-border" />
          </div>
        </div>

        {/* Login Card */}
        <div className="pl-card p-8">
          <h2 className="text-xl font-semibold text-white mb-6">
            {isSignUp ? 'Create Account' : 'Sign In'}
          </h2>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm text-pl-text-dim mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.name@platinumlist.net"
                className="pl-input"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-pl-text-dim mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="pl-input"
                required
                minLength={6}
              />
            </div>

            {error && (
              <div className="bg-pl-danger/10 border border-pl-danger/30 rounded-lg px-4 py-3 text-pl-danger text-sm">
                {error}
              </div>
            )}

            {message && (
              <div className="bg-pl-success/10 border border-pl-success/30 rounded-lg px-4 py-3 text-pl-success text-sm">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="pl-btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-pl-dark/30 border-t-pl-dark rounded-full animate-spin" />
              ) : (
                isSignUp ? 'Create Account' : 'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(''); setMessage('') }}
              className="text-sm text-pl-gold hover:text-pl-gold-light transition-colors"
            >
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </button>
          </div>

          <div className="mt-4 pt-4 border-t border-pl-border">
            <p className="text-xs text-pl-muted text-center">
              Restricted to @platinumlist.net email addresses
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
