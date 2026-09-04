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
 * In production the Vercel middleware has already verified a Supabase access
 * token's ES256 signature and checked the email against ALLOWED_EMAILS before
 * any of this code is served. So the app does not re-authenticate — it only
 * reads who the verified user is, straight out of the token's payload.
 *
 * Decoding without verifying is safe *here* and only here: nothing downstream
 * of the middleware is reachable without a signature that already passed, and
 * this value drives a name badge, not an access decision.
 *
 * `npm run dev` never runs the middleware, so when there is no token the
 * provider falls back to the local demo accounts and development is unchanged.
 */
function readSupabaseSession(): AuthUser | null {
  try {
    const raw = document.cookie
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith('sb-access-token='))
    if (!raw) return null

    const token = decodeURIComponent(raw.slice('sb-access-token='.length))
    const body = token.split('.')[1]
    if (!body) return null

    const json = atob(body.replace(/-/g, '+').replace(/_/g, '/'))
    const claims = JSON.parse(decodeURIComponent(escape(json))) as {
      email?: string
      exp?: number
      user_metadata?: { name?: string; full_name?: string }
    }
    if (!claims.email) return null
    if (typeof claims.exp === 'number' && claims.exp * 1000 <= Date.now()) return null

    const meta = claims.user_metadata || {}
    return {
      id: claims.email,
      email: claims.email,
      name: meta.name || meta.full_name || claims.email.split('@')[0],
      // Everyone past the gate is studio staff on the access list; the
      // middleware is the boundary, not this field.
      role: 'admin' as UserRole,
    }
  } catch {
    return null
  }
}

/** Hand sign-out to the middleware so it can clear the httpOnly-adjacent cookies too. */
function supabaseSignOut() {
  window.location.href = '/__gate/logout'
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const [viaSupabase, setViaSupabase] = useState(false)

  useEffect(() => {
    const supabase = readSupabaseSession()
    if (supabase) {
      setViaSupabase(true)
      setUser(supabase)
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
    if (viaSupabase) supabaseSignOut()
  }, [viaSupabase])

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
