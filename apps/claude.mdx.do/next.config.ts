import type { NextConfig } from 'next'
import { setupDevPlatform } from '@cloudflare/next-on-pages/next-dev'
import createMDX from 'fumadocs-mdx/config'

if (process.env.NODE_ENV === 'development') {
  await setupDevPlatform()
}

const withMDX = createMDX()

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    outputFileTracingIncludes: {
      '/*': ['./content/**/*'],
    },
  },
}

export default withMDX(nextConfig)
