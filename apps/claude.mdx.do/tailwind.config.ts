import type { Config } from 'tailwindcss'
import { createPreset } from 'fumadocs-ui/tailwind-plugin'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './content/**/*.{md,mdx}',
    './node_modules/fumadocs-ui/dist/**/*.js',
    './node_modules/@todo.mdx/dashboard/dist/**/*.js',
  ],
  presets: [createPreset()],
  theme: {
    extend: {},
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
