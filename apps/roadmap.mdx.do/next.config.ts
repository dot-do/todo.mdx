import type { NextConfig } from 'next'
import createMDX from 'fumadocs-mdx/config'

const withMDX = createMDX()

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
}

export default withMDX(nextConfig)
