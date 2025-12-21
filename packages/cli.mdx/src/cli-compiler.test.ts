/**
 * Tests for CLI compiler
 */

import { describe, it, expect } from 'vitest'
import { buildCommanderProgram } from './cli-compiler.js'
import type { ParsedCommand } from './types.js'

describe('CLI Compiler', () => {
  describe('buildCommanderProgram', () => {
    it('should create a basic command', () => {
      const commands: ParsedCommand[] = [
        {
          name: 'deploy',
          description: 'Deploy to production',
          arguments: [],
          flags: [],
          subcommands: [],
        },
      ]

      const program = buildCommanderProgram(commands, 'test-cli', '1.0.0')

      expect(program).toBeDefined()
      expect(program.name()).toBe('test-cli')
      expect(program.version()).toBe('1.0.0')
    })

    it('should create a command with arguments', () => {
      const commands: ParsedCommand[] = [
        {
          name: 'deploy',
          description: 'Deploy to production',
          arguments: [
            {
              name: 'environment',
              description: 'Target environment',
              required: true,
            },
          ],
          flags: [],
          subcommands: [],
        },
      ]

      const program = buildCommanderProgram(commands, 'test-cli', '1.0.0')

      expect(program).toBeDefined()
    })

    it('should create a command with flags', () => {
      const commands: ParsedCommand[] = [
        {
          name: 'deploy',
          description: 'Deploy to production',
          arguments: [],
          flags: [
            {
              name: 'dry-run',
              type: 'boolean',
              description: 'Preview changes without deploying',
            },
            {
              name: 'env',
              alias: 'e',
              type: 'string',
              description: 'Environment name',
              default: 'staging',
            },
          ],
          subcommands: [],
        },
      ]

      const program = buildCommanderProgram(commands, 'test-cli', '1.0.0')

      expect(program).toBeDefined()
    })

    it('should create a command with subcommands', () => {
      const commands: ParsedCommand[] = [
        {
          name: 'db',
          description: 'Database commands',
          arguments: [],
          flags: [],
          subcommands: [
            {
              name: 'migrate',
              description: 'Run migrations',
              arguments: [],
              flags: [
                {
                  name: 'rollback',
                  type: 'boolean',
                  description: 'Rollback last migration',
                },
              ],
              subcommands: [],
            },
            {
              name: 'seed',
              description: 'Seed database',
              arguments: [],
              flags: [],
              subcommands: [],
            },
          ],
        },
      ]

      const program = buildCommanderProgram(commands, 'test-cli', '1.0.0')

      expect(program).toBeDefined()
    })

    it('should handle command aliases', () => {
      const commands: ParsedCommand[] = [
        {
          name: 'deploy',
          description: 'Deploy to production',
          aliases: ['d', 'ship'],
          arguments: [],
          flags: [],
          subcommands: [],
        },
      ]

      const program = buildCommanderProgram(commands, 'test-cli', '1.0.0')

      expect(program).toBeDefined()
    })

    it('should handle required flags', () => {
      const commands: ParsedCommand[] = [
        {
          name: 'deploy',
          description: 'Deploy to production',
          arguments: [],
          flags: [
            {
              name: 'api-key',
              type: 'string',
              description: 'API key for authentication',
              required: true,
            },
          ],
          subcommands: [],
        },
      ]

      const program = buildCommanderProgram(commands, 'test-cli', '1.0.0')

      expect(program).toBeDefined()
    })

    it('should handle argument choices', () => {
      const commands: ParsedCommand[] = [
        {
          name: 'deploy',
          description: 'Deploy to production',
          arguments: [
            {
              name: 'environment',
              description: 'Target environment',
              required: true,
              choices: ['dev', 'staging', 'production'],
            },
          ],
          flags: [],
          subcommands: [],
        },
      ]

      const program = buildCommanderProgram(commands, 'test-cli', '1.0.0')

      expect(program).toBeDefined()
    })

    it('should handle optional arguments with defaults', () => {
      const commands: ParsedCommand[] = [
        {
          name: 'deploy',
          description: 'Deploy to production',
          arguments: [
            {
              name: 'version',
              description: 'Version to deploy',
              required: false,
              default: 'latest',
            },
          ],
          flags: [],
          subcommands: [],
        },
      ]

      const program = buildCommanderProgram(commands, 'test-cli', '1.0.0')

      expect(program).toBeDefined()
    })
  })
})
