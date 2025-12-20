import { setupDevPlatform } from '@cloudflare/next-on-pages/next-dev'
import type { NextConfig } from 'next'
import { createMDX } from 'fumadocs-mdx/next'

const withMDX = createMDX()

if (process.env.NODE_ENV === 'development') {
  await setupDevPlatform()
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'export',
  images: {
    unoptimized: true,
  },
}

export default withMDX(nextConfig)
