import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8">
      <div className="max-w-4xl mx-auto text-center space-y-8">
        <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          claude.mdx
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          MDX components that render live data to markdown — realtime context for humans AND AI.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/docs"
            className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
          >
            Get Started
          </Link>
          <Link
            href="/dashboard"
            className="px-6 py-3 rounded-lg border border-input bg-background font-semibold hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            Dashboard
          </Link>
        </div>
        <div className="pt-12 space-y-4">
          <h2 className="text-2xl font-semibold">The core insight</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            README, TODO, ROADMAP, and AI instructions (CLAUDE.md, .cursorrules) are all views of the same data.
            Define once in MDX, render everywhere.
          </p>
        </div>
      </div>
    </main>
  )
}
