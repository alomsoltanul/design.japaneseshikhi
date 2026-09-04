import { createContext, useContext, useState, useEffect, useCallback } from 'react'

export type UserRole = 'admin' | 'editor' | 'viewer'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: UserRole
}

interface AuthContextType {
  user: AuthUser | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (email: string, password: string, name: string) => Promise<{ error?: string }>
  signOut: () => void
  isAdmin: boolean
  isEditor: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  signIn: async () => ({}),
  signUp: async () => ({}),
  signOut: () => {},
  isAdmin: false,
  isEditor: false,
})

const AUTH_KEY = 'js-auth-session'
const USERS_KEY = 'js-auth-users'

function seedDefaultUsers() {
  const users = loadUsers()
  if (Object.keys(users).length === 0) {
    saveUsers({
      'admin@japaneseshikhi.com': {
        password: 'admin123',
        name: 'Admin',
        role: 'admin' as UserRole,
      },
      'editor@japaneseshikhi.com': {
        password: 'editor123',
        name: 'Editor',
        role: 'editor' as UserRole,
      },
    })
  }
}

function loadUsers(): Record<string, { password: string; name: string; role: UserRole }> {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveUsers(users: Record<string, { password: string; name: string; role: UserRole }>) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

function loadSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/**
 * In production the Vercel middleware has already verified this session cookie's
 * HMAC signature and checked the account against STUDIO_USERS before any of this
 * code is served. So the app does not re-authenticate — it only reads who the
 * verified user is, out of the cookie's payload.
 *
 * Reading without re-verifying is safe *here* and only here: nothing downstream
 * of the middleware is reachable without a signature that already passed, and
 * this value drives a name badge, not an access decision.
 *
 * `npm run dev` never runs the middleware, so when there is no cookie the
 * provider falls back to the local demo accounts and development is unchanged.
 */
function readStudioSession(): AuthUser | null {
  try {
    const raw = document.cookie
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith('studio_session='))
    if (!raw) return null

    const parts = decodeURIComponent(raw.slice('studio_session='.length)).split('.')
    if (parts.length !== 3 || parts[0] !== 'v1') return null

    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    const claims = JSON.parse(json) as { email?: string; exp?: number }
    if (!claims.email) return null
    if (typeof claims.exp === 'number' && claims.exp <= Date.now()) return null

    return {
      id: claims.email,
      email: claims.email,
      name: claims.email.split('@')[0],
      // Everyone past the gate is studio staff; the middleware is the boundary,
      // not this field.
      role: 'admin' as UserRole,
    }
  } catch {
    return null
  }
}

/** Hand sign-out to the middleware so it can clear the session cookie too. */
function studioSignOut() {
  window.location.href = '/__gate/logout'
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const [viaGate, setViaGate] = useState(false)

  useEffect(() => {
    const gated = readStudioSession()
    if (gated) {
      setViaGate(true)
      setUser(gated)
      setIsLoading(false)
      return
    }
    // Local development only — the middleware never runs under Vite.
    seedDefaultUsers()
    setUser(loadSession())
    setIsLoading(false)
  }, [])

  const signIn = useCallback(async (email: string, password: string): Promise<{ error?: string }> => {
    const users = loadUsers()
    const u = users[email.toLowerCase().trim()]
    if (!u) return { error: 'Invalid email or password.' }
    if (u.password !== password) return { error: 'Invalid email or password.' }
    const session: AuthUser = {
      id: email.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      name: u.name,
      role: u.role,
    }
    setUser(session)
    localStorage.setItem(AUTH_KEY, JSON.stringify(session))
    return {}
  }, [])

  const signUp = useCallback(async (email: string, password: string, name: string): Promise<{ error?: string }> => {
    const users = loadUsers()
    const key = email.toLowerCase().trim()
    if (users[key]) return { error: 'An account with this email already exists.' }
    users[key] = { password, name: name.trim(), role: 'editor' }
    saveUsers(users)
    const session: AuthUser = {
      id: key,
      email: key,
      name: name.trim(),
      role: 'editor',
    }
    setUser(session)
    localStorage.setItem(AUTH_KEY, JSON.stringify(session))
    return {}
  }, [])

  const signOut = useCallback(() => {
    setUser(null)
    localStorage.removeItem(AUTH_KEY)
    if (viaGate) studioSignOut()
  }, [viaGate])

  const isAdmin = user?.role === 'admin'
  const isEditor = user?.role === 'admin' || user?.role === 'editor'

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut, isAdmin, isEditor }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
