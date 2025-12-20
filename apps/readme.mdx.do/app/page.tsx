import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="max-w-5xl w-full items-center justify-between font-mono text-sm">
        <div className="text-center">
          <h1 className="text-6xl font-bold mb-4">readme.mdx</h1>
          <p className="text-xl text-muted-foreground mb-8">
            MDX components for beautiful README files
          </p>
          <p className="text-lg mb-12 max-w-2xl mx-auto">
            Turn your README into a living document with MDX components that render live data to markdown.
            Perfect for AI agents and humans alike.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/docs"
              className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
            >
              Get Started
            </Link>
            <Link
              href="/dashboard"
              className="px-6 py-3 border border-border rounded-lg hover:bg-accent transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
