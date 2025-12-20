import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between text-center">
        <h1 className="text-6xl font-bold mb-8">roadmap.mdx</h1>
        <p className="text-xl mb-12 text-muted-foreground">
          MDX-powered roadmap rendering with live data
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/docs"
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Documentation
          </Link>
          <Link
            href="/dashboard"
            className="px-6 py-3 bg-secondary text-secondary-foreground rounded-lg font-medium hover:bg-secondary/90 transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
