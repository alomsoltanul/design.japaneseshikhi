import { useState } from 'react'
import { useAuth } from './AuthContext'

export function SignupPage({ onSwitch }: { onSwitch: () => void }) {
  const { signUp } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    const result = await signUp(email, password, name)
    setLoading(false)
    if (result.error) setError(result.error)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <img src="/assets/logo-light.webp" alt="Japanese Shikhi" className="auth-logo" />
          <h1>Create Account</h1>
          <p>Join the content team</p>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label>Full Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              required
            />
          </div>
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
              placeholder="Min 6 characters"
              required
            />
          </div>
          <div className="auth-field">
            <label>Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repeat password"
              required
            />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>
        <div className="auth-footer">
          <span>Already have an account?</span>
          <button type="button" className="auth-link" onClick={onSwitch}>
            Sign in
          </button>
        </div>
      </div>
    </div>
  )
}
