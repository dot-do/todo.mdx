import type { Config } from 'tailwindcss'
import { createPreset } from 'fumadocs-ui/tailwind-plugin'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './content/**/*.{md,mdx}',
    './src/**/*.{ts,tsx}',
    './node_modules/fumadocs-ui/dist/**/*.js',
  ],
  presets: [createPreset()],
}

export default config
