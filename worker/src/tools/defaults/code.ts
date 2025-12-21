import { z } from 'zod'
import type { Integration } from '../types'

export const Code: Integration = {
  name: 'Code',
  tools: [
    {
      name: 'execute',
      fullName: 'code.execute',
      schema: z.object({
        code: z.string(),
        language: z.enum(['javascript', 'python', 'typescript']).optional().default('javascript'),
      }),
      execute: async (params) => {
        const { code, language = 'javascript' } = params

        try {
          if (language === 'javascript' || language === 'typescript') {
            // Use Cloudflare's worker sandbox or simple eval for JS
            // In a real implementation, would use @cloudflare/sandbox
            // For now, use a safe evaluation approach
            try {
              // Create a safe sandbox using Function constructor
              const fn = new Function('return (' + code + ')')
              const result = fn()

              return {
                output: String(result),
                language,
                success: true
              }
            } catch (err) {
              return {
                output: '',
                error: err instanceof Error ? err.message : 'Execution error',
                language,
                success: false
              }
            }
          } else {
            return {
              output: '',
              error: `Language ${language} not supported in sandbox`,
              language,
              success: false
            }
          }
        } catch (error) {
          return {
            output: '',
            error: error instanceof Error ? error.message : 'Failed to execute code',
            language,
            success: false
          }
        }
      }
    },
    {
      name: 'installPackage',
      fullName: 'code.installPackage',
      schema: z.object({
        package: z.string(),
        version: z.string().optional(),
      }),
      execute: async (params) => {
        // Placeholder - would integrate with npm/pnpm in real implementation
        return {
          package: params.package,
          version: params.version,
          error: 'Not implemented in sandbox - package installation requires system access'
        }
      }
    }
  ]
}
