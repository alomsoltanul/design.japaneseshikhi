import { useAuth } from './AuthContext'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-body)',
        color: 'var(--text-secondary)',
        fontSize: 14,
        fontWeight: 500,
      }}>
        Loading…
      </div>
    )
  }

  if (!user) {
    return null // Parent will show login page
  }

  return <>{children}</>
}
