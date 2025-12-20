import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="max-w-5xl w-full space-y-8 text-center">
        <h1 className="text-6xl font-bold tracking-tight">
          agents.mdx
        </h1>
        <p className="text-xl text-muted-foreground">
          AI Agent Framework in MDX
        </p>
        <p className="text-lg max-w-2xl mx-auto">
          Define AI agent behavior, context, and workflows in markdown.
          Build intelligent agents that understand your codebase and domain.
        </p>
        <div className="flex gap-4 justify-center pt-8">
          <Link
            href="/docs"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Get Started
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-lg border border-input bg-background px-6 py-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
