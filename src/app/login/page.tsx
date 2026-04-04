'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const router = useRouter()

  const validateEmail = (email: string) => {
    return email.endsWith('@platinumlist.net')
  }

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')

    if (!validateEmail(email)) {
      setError('Only @platinumlist.net email addresses are allowed.')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
        },
      })
      if (error) throw error
      setMessage(`A 6-digit code has been sent to ${email}`)
      setStep('otp')
    } catch (err: any) {
      setError(err.message || 'Failed to send code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (otp.length !== 6) {
      setError('Please enter the 6-digit code from your email.')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      })
      if (error) throw error
      router.push('/dashboard/events')
    } catch (err: any) {
      setError(err.message || 'Invalid or expired code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setError('')
    setMessage('')
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      })
      if (error) throw error
      setMessage('A new code has been sent to your email.')
    } catch (err: any) {
      setError(err.message || 'Failed to resend code.')
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
          {step === 'email' ? (
            <>
              <h2 className="text-xl font-semibold text-white mb-2">Sign In</h2>
              <p className="text-sm text-pl-text-dim mb-6">
                We&apos;ll send a login code to your Platinumlist email.
              </p>

              <form onSubmit={handleSendCode} className="space-y-4">
                <div>
                  <label className="block text-sm text-pl-text-dim mb-2">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.name@platinumlist.net"
                    className="pl-input"
                    required
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="bg-pl-danger/10 border border-pl-danger/30 rounded-lg px-4 py-3 text-pl-danger text-sm">
                    {error}
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
                    'Send Login Code'
                  )}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-white mb-2">Enter Your Code</h2>
              {message && (
                <p className="text-sm text-pl-success mb-4">{message}</p>
              )}
              <p className="text-sm text-pl-text-dim mb-6">
                Sent to <span className="text-white">{email}</span>
              </p>

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="block text-sm text-pl-text-dim mb-2">6-Digit Code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="pl-input text-center text-2xl tracking-[0.5em] font-mono"
                    required
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="bg-pl-danger/10 border border-pl-danger/30 rounded-lg px-4 py-3 text-pl-danger text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="pl-btn-primary w-full flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-pl-dark/30 border-t-pl-dark rounded-full animate-spin" />
                  ) : (
                    'Verify & Sign In'
                  )}
                </button>
              </form>

              <div className="mt-6 text-center space-y-2">
                <button
                  onClick={handleResend}
                  disabled={loading}
                  className="text-sm text-pl-gold hover:text-pl-gold-light transition-colors"
                >
                  Resend code
                </button>
                <div>
                  <button
                    onClick={() => { setStep('email'); setOtp(''); setError(''); setMessage('') }}
                    className="text-sm text-pl-muted hover:text-pl-text-dim transition-colors"
                  >
                    ← Use a different email
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="mt-6 pt-4 border-t border-pl-border">
            <p className="text-xs text-pl-muted text-center">
              Restricted to @platinumlist.net email addresses
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
