import { useState } from 'react'
import { useAuth } from './AuthContext'

export function LoginPage({ onSwitch }: { onSwitch: () => void }) {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await signIn(email, password)
    setLoading(false)
    if (result.error) setError(result.error)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <img src="/assets/logo-light.webp" alt="Japanese Shikhi" className="auth-logo" />
          <h1>Content Studio</h1>
          <p>Sign in to your team workspace</p>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@japaneseshikhi.com"
              required
            />
          </div>
          <div className="auth-field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <div className="auth-footer">
          <span>Need an account?</span>
          <button type="button" className="auth-link" onClick={onSwitch}>
            Sign up
          </button>
        </div>
      </div>
    </div>
  )
}
