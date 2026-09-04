/**
 * A deliberately minimal footer: a quiet base edge that balances the nav's
 * depth and nothing else. No links, no columns, no detail — this is a private
 * studio, not a marketing site.
 */
export function GlobalFooter({ user }: { user?: { email?: string } | null }) {
  return (
    <footer className="global-footer">
      <span><span className="dot" />Japanese Shikhi · Content Studio</span>
      <span className="hide-sm">{user?.email ?? 'Private workspace'}</span>
    </footer>
  )
}
