// Force dynamic rendering for all IDE pages to avoid monaco/xterm SSR issues
export const dynamic = 'force-dynamic'

export default function IDELayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
