import { z } from 'zod'
import type { Integration } from '../types'

export const Browser: Integration = {
  name: 'Browser',
  tools: [
    {
      name: 'fetchPage',
      fullName: 'browser.fetchPage',
      schema: z.object({
        url: z.string().url(),
        waitForSelector: z.string().optional(),
      }),
      execute: async (params) => {
        const { url } = params

        try {
          const response = await fetch(url)
          const html = await response.text()

          // Extract text content (basic implementation - strips HTML tags)
          const text = html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()

          // Extract title
          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
          const title = titleMatch ? titleMatch[1].trim() : ''

          return {
            html,
            text,
            title,
            url,
            status: response.status
          }
        } catch (error) {
          return {
            error: error instanceof Error ? error.message : 'Failed to fetch page',
            url
          }
        }
      }
    },
    {
      name: 'screenshot',
      fullName: 'browser.screenshot',
      schema: z.object({
        url: z.string().url(),
      }),
      execute: async (params) => {
        // Placeholder - would use puppeteer/playwright in real implementation
        return {
          image: null,
          error: 'Not implemented in sandbox - requires puppeteer/playwright'
        }
      }
    }
  ]
}
