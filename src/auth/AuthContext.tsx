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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    seedDefaultUsers()
    const session = loadSession()
    setUser(session)
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
  }, [])

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
