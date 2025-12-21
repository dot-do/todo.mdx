// Force dynamic rendering for all terminal pages to avoid xterm SSR issues
export const dynamic = 'force-dynamic'

export default function TerminalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
