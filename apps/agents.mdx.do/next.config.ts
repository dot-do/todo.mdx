import type { NextConfig } from 'next'
import createMDX from 'fumadocs-mdx/config'

const withMDX = createMDX()

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Required for OpenNext Cloudflare
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
}

export default withMDX(nextConfig)
