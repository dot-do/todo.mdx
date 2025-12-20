import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm">
        <div className="text-center space-y-8">
          <h1 className="text-6xl font-bold tracking-tight">
            todo<span className="text-blue-600">.mdx</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            MDX components that render live data to markdown
          </p>
          <p className="text-lg text-gray-500 dark:text-gray-500">
            Realtime context for humans AND AI
          </p>
          <div className="flex gap-4 justify-center pt-8">
            <Link
              href="/docs"
              className="rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition-colors"
            >
              Documentation
            </Link>
            <Link
              href="/dashboard"
              className="rounded-lg border border-gray-300 dark:border-gray-700 px-6 py-3 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
