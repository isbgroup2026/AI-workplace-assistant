import { useState } from 'react'
import { signIn } from '../lib/api'

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('Enter your email')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!username || !password) {
      setError('Enter both your username and password to continue.')
      return
    }
    setError('')
    setLoading(true)
    const email = username.includes('@') ? username : `${username}@Innodatatics Inc..com`
    const { error: authError } = await signIn(email, password)
    setLoading(false)
    if (authError) {
      setError(authError.message)
      return
    }
    onLogin()
  }

  return (
    <div className="min-h-screen flex bg-panel">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 px-16 py-14 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="grid" width="34" height="34" patternUnits="userSpaceOnUse">
                <path d="M 34 0 L 0 0 0 34" fill="none" stroke="white" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-md bg-steel-500 flex items-center justify-center font-display font-bold">
            I
          </div>
          <span className="font-display font-semibold text-lg">Innodatatics Inc.</span>
        </div>

        <div className="relative max-w-md">
          <p className="text-xs font-mono tracking-widest text-amber-400 mb-4">
            SHIFT STATUS · LIVE
          </p>
          <h1 className="font-display text-4xl font-semibold leading-tight mb-4">
            One workplace,
            <br />
            every shift, every line.
          </h1>
          <p className="text-white/60 text-sm leading-relaxed">
            Tasks, meetings, approvals and your AI assistant — in the same place your
            floor teams already work.
          </p>
        </div>

        <div className="relative flex gap-8 text-xs font-mono text-white/40">
          <span>© 2026 Innodatatics Inc. Industries</span>
          <span>Pune · Chennai · Ahmedabad</span>
        </div>
      </div>

      {/* Right login panel */}
      <div className="w-full lg:w-1/2 bg-canvas flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2.5 mb-10 justify-center">
            <div className="w-8 h-8 rounded-md bg-steel-600 flex items-center justify-center font-display font-bold text-white">
              A
            </div>
            <span className="font-display font-semibold text-lg text-ink">Innodatatics Inc.</span>
          </div>

          <h2 className="font-display text-2xl font-semibold text-ink mb-1.5">Sign in</h2>
          <p className="text-sm text-inkmuted mb-8">
            Access your workplace assistant with your Innodatatics Inc. credentials.
          </p>

          <form onSubmit={handleSubmit} noValidate>
            <label className="block mb-4">
              <span className="block text-sm font-medium text-ink mb-1.5">Username</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="firstname.lastname"
                className="w-full rounded-lg border border-line px-3 py-2.5 text-sm bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus:border-steel-500"
              />
            </label>
            <label className="block mb-2">
              <span className="block text-sm font-medium text-ink mb-1.5">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-line px-3 py-2.5 text-sm bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus:border-steel-500"
              />
            </label>

            <div className="flex items-center justify-between mb-6 mt-3">
              <label className="flex items-center gap-2 text-sm text-inkmuted">
                <input type="checkbox" className="rounded border-line" defaultChecked />
                Keep me signed in
              </label>
              <button type="button" className="text-sm text-steel-600 hover:underline">
                Forgot password?
              </button>
            </div>

            {error && (
              <p className="text-sm text-signal-red bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-steel-600 hover:bg-steel-700 text-white font-medium text-sm rounded-lg py-2.5 transition-colors disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-xs text-inkmuted mt-8 text-center">
            Trouble signing in? Contact your plant IT desk at{' '}
            <span className="font-mono">it-support@Innodatatics Inc..com</span>
          </p>
        </div>
      </div>
    </div>
  )
}
