/**
 * CLI compiler - transforms MDX with Command components into executable CLI
 * Uses commander.js under the hood
 */

import { readFile } from 'node:fs/promises'
import { compile as mdxCompile, run as mdxRun } from '@mdx-js/mdx'
import * as runtime from 'react/jsx-runtime'
import React, { ReactElement } from 'react'
import { Command as CommanderCommand } from 'commander'
import type {
  ParsedCommand,
  ParsedArgument,
  ParsedFlag,
  CliConfig,
} from './types.js'
import * as components from './components.js'
import { setComponentData } from './components.js'
import { loadAllData } from './loader.js'

/**
 * Parse MDX file and extract Command definitions
 */
export async function parseMdxCommands(config: CliConfig = {}): Promise<ParsedCommand[]> {
  const { input = 'CLI.mdx', beads = true } = config

  // Load data from beads
  const data = beads
    ? await loadAllData()
    : {
        issues: [],
        milestones: [],
        stats: { total: 0, open: 0, in_progress: 0, blocked: 0, closed: 0, percent: 0 },
      }

  // Set component data
  setComponentData(data)

  // Read MDX file
  let mdxContent: string
  try {
    mdxContent = await readFile(input, 'utf-8')
  } catch (error) {
    throw new Error(`Failed to read ${input}: ${error}`)
  }

  // Parse frontmatter
  const { content } = parseFrontmatter(mdxContent)

  // Compile and run MDX
  let MDXComponent: React.ComponentType<any>
  try {
    // Compile MDX to JavaScript
    const compiled = await mdxCompile(content, {
      development: false,
      jsxImportSource: 'react',
      outputFormat: 'program',
    })

    // Run the compiled code to get the component
    const { default: Component } = await mdxRun(compiled, {
      ...runtime,
      baseUrl: import.meta.url,
    } as any)

    MDXComponent = Component
  } catch (error) {
    throw new Error(`Failed to compile MDX: ${error}`)
  }

  // Render the component
  const element = React.createElement(MDXComponent, {
    components: {
      ...components,
      Command: components.Command,
      Argument: components.Argument,
      Flag: components.Flag,
      Subcommand: components.Subcommand,
    },
  })

  // Extract commands from the React tree
  const commands = extractCommandsFromTree(element)

  return commands
}

/**
 * Extract Command components from React element tree
 */
function extractCommandsFromTree(element: ReactElement): ParsedCommand[] {
  const commands: ParsedCommand[] = []

  function traverse(node: any, parentCommand?: ParsedCommand) {
    if (!node) return

    // Handle arrays
    if (Array.isArray(node)) {
      node.forEach(n => traverse(n, parentCommand))
      return
    }

    // Check if valid React element
    if (!React.isValidElement(node)) return

    const { type, props } = node

    // Check if it's a Command or Subcommand component
    if (
      type === components.Command ||
      type === components.Subcommand ||
      (typeof type === 'function' && (type.name === 'Command' || type.name === 'Subcommand'))
    ) {
      const nodeProps = props as any
      const command: ParsedCommand = {
        name: nodeProps.name,
        description: nodeProps.description,
        aliases: nodeProps.aliases,
        arguments: [],
        flags: [],
        subcommands: [],
      }

      // Parse children for Arguments, Flags, and Subcommands
      const children = React.Children.toArray(nodeProps.children)
      children.forEach(child => {
        if (!React.isValidElement(child)) return

        const childType = child.type
        const childProps = child.props as any

        // Argument component
        if (
          childType === components.Argument ||
          (typeof childType === 'function' && childType.name === 'Argument')
        ) {
          command.arguments!.push({
            name: childProps.name,
            description: childProps.description,
            required: childProps.required || false,
            default: childProps.default,
            choices: childProps.choices,
          })
        }

        // Flag component
        if (
          childType === components.Flag ||
          (typeof childType === 'function' && childType.name === 'Flag')
        ) {
          command.flags!.push({
            name: childProps.name,
            alias: childProps.alias,
            type: childProps.type || 'string',
            description: childProps.description,
            required: childProps.required || false,
            default: childProps.default,
          })
        }

        // Subcommand component
        if (
          childType === components.Subcommand ||
          (typeof childType === 'function' && childType.name === 'Subcommand')
        ) {
          // Recursively parse subcommand
          traverse(child, command)
        }
      })

      // Add to parent command's subcommands or top-level commands
      if (parentCommand) {
        parentCommand.subcommands!.push(command)
      } else {
        commands.push(command)
      }
    }

    // Traverse children
    const nodeProps = props as any
    if (nodeProps.children) {
      const children = React.Children.toArray(nodeProps.children)
      children.forEach(child => traverse(child, parentCommand))
    }
  }

  traverse(element)
  return commands
}

/**
 * Build commander.js Command from parsed command definitions
 */
export function buildCommanderProgram(
  commands: ParsedCommand[],
  programName = 'cli',
  programVersion = '1.0.0'
): CommanderCommand {
  const program = new CommanderCommand()
  program.name(programName).version(programVersion)

  // Add each command
  for (const cmd of commands) {
    addCommandToProgram(program, cmd)
  }

  return program
}

/**
 * Add a command (and its subcommands) to a commander program
 */
function addCommandToProgram(program: CommanderCommand, cmd: ParsedCommand) {
  const command = program.command(cmd.name)

  // Add description
  if (cmd.description) {
    command.description(cmd.description)
  }

  // Add aliases
  if (cmd.aliases && cmd.aliases.length > 0) {
    command.aliases(cmd.aliases)
  }

  // Add arguments
  if (cmd.arguments && cmd.arguments.length > 0) {
    for (const arg of cmd.arguments) {
      const argName = arg.required ? `<${arg.name}>` : `[${arg.name}]`
      const argDesc = arg.description || ''

      command.argument(argName, argDesc, arg.default)

      // Add choices validation if specified
      if (arg.choices && arg.choices.length > 0) {
        // We'll need to validate choices in the action handler
      }
    }
  }

  // Add flags/options
  if (cmd.flags && cmd.flags.length > 0) {
    for (const flag of cmd.flags) {
      const flagName = flag.alias ? `-${flag.alias}, --${flag.name}` : `--${flag.name}`

      let flagSpec = flagName
      if (flag.type !== 'boolean') {
        flagSpec += ` <${flag.type || 'value'}>`
      }

      // Use requiredOption if required, otherwise option
      if (flag.required) {
        command.requiredOption(flagSpec, flag.description || '')
      } else {
        command.option(flagSpec, flag.description || '', flag.default)
      }
    }
  }

  // Add subcommands recursively
  if (cmd.subcommands && cmd.subcommands.length > 0) {
    for (const subcmd of cmd.subcommands) {
      addCommandToProgram(command, subcmd)
    }
  }

  // Add action handler
  if (cmd.action) {
    command.action(cmd.action)
  } else {
    // Default action: show help
    command.action(() => {
      command.help()
    })
  }
}

/**
 * Compile MDX to executable CLI program
 */
export async function compileToCli(config: CliConfig = {}): Promise<CommanderCommand> {
  const commands = await parseMdxCommands(config)

  // Extract program name and version from config or use defaults
  const programName = config.input?.replace(/\.mdx?$/, '') || 'cli'
  const programVersion = '1.0.0'

  const program = buildCommanderProgram(commands, programName, programVersion)

  return program
}

/**
 * Execute CLI from MDX file
 */
export async function executeCli(config: CliConfig = {}, argv?: string[]): Promise<void> {
  const program = await compileToCli(config)

  // Parse arguments
  const args = argv || process.argv

  await program.parseAsync(args)
}

/**
 * Parse frontmatter from MDX content
 */
function parseFrontmatter(content: string): {
  frontmatter: Record<string, any> | null
  content: string
} {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/
  const match = content.match(frontmatterRegex)

  if (!match) {
    return { frontmatter: null, content }
  }

  const frontmatterYaml = match[1]
  const frontmatter: Record<string, any> = {}

  for (const line of frontmatterYaml.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue

    const key = line.slice(0, colonIndex).trim()
    let value: any = line.slice(colonIndex + 1).trim()

    // Parse value
    if (value === 'true') value = true
    else if (value === 'false') value = false
    else if (/^\d+$/.test(value)) value = parseInt(value, 10)
    else if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1)
    }

    frontmatter[key] = value
  }

  const remainingContent = content.slice(match[0].length)

  return { frontmatter, content: remainingContent }
}
