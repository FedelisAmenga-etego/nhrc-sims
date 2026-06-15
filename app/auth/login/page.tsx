'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Package, Eye, EyeOff, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--nhrc-navy)' }}>
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] p-12"
        style={{ background: 'linear-gradient(160deg, #0f1f3d 0%, #0a1628 100%)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #c8963e, #e8b84b)' }}>
            <Package size={20} className="text-white" />
          </div>
          <div>
            <div className="font-display font-700 text-white text-base">NHRC Stores MIS</div>
            <div className="text-white/40 text-xs">Navrongo Health Research Centre</div>
          </div>
        </div>

        <div>
          <h1 className="font-display text-5xl font-800 text-white leading-tight mb-6">
            Stores<br />
            <span style={{ color: '#c8963e' }}>Management</span><br />
            Information<br />
            System
          </h1>
          <p className="text-white/50 text-base max-w-xs leading-relaxed">
            Track inventory, manage procurement, issue vouchers, and generate comprehensive reports — all in one place.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Real-time Stock', desc: 'Live inventory tracking' },
            { label: 'Full Audit Trail', desc: 'Every action logged' },
            { label: 'Smart Alerts', desc: 'Low stock notifications' },
          ].map((f) => (
            <div key={f.label} className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="text-xs font-700 text-white/80 mb-1 font-display">{f.label}</div>
              <div className="text-xs text-white/40">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6"
        style={{ background: '#f5f7fa' }}>
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #c8963e, #e8b84b)' }}>
              <Package size={20} className="text-white" />
            </div>
            <div>
              <div className="font-display font-700 text-gray-900 text-base">NHRC Stores MIS</div>
              <div className="text-gray-500 text-xs">Navrongo Health Research Centre</div>
            </div>
          </div>

          <div className="card p-8">
            <h2 className="font-display font-700 text-2xl text-gray-900 mb-1">Welcome back</h2>
            <p className="text-gray-500 text-sm mb-8">Sign in to access the stores system</p>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-600 text-gray-700 mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input"
                  placeholder="you@nhrc.org"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-600 text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="form-input pr-12"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
                  <AlertCircle size={15} className="flex-shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center py-3"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in…
                  </span>
                ) : 'Sign In'}
              </button>
            </form>

            <p className="text-xs text-gray-400 mt-6 text-center">
              Contact your system administrator if you need access.
            </p>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            NHRC Stores MIS · Navrongo Health Research Centre
          </p>
        </div>
      </div>
    </div>
  )
}
