/**
 * MDX compiler for cli.mdx
 * Compiles MDX to terminal output or markdown files
 */

import { readFile, writeFile } from 'node:fs/promises'
import { compile as mdxCompile, run as mdxRun } from '@mdx-js/mdx'
import * as runtime from 'react/jsx-runtime'
import React from 'react'
import { renderToTerminal, renderToMarkdown } from './renderer.js'
import { setComponentData } from './components.js'
import { loadAllData } from './loader.js'
import type { CliConfig, RenderContext } from './types.js'
import * as components from './components.js'
import { extractFrontmatter, serializeYaml } from '@todo.mdx/shared/yaml'

/** Compile MDX file to terminal or markdown output */
export async function compile(config: CliConfig = {}): Promise<string> {
  const {
    input = 'CLI.mdx',
    output,
    mode = 'terminal',
    beads = true,
  } = config

  // Load data from beads
  let data = beads
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
  const { frontmatter, content } = extractFrontmatter(mdxContent)

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

  // Create render context
  const context: RenderContext = {
    mode: mode === 'dual' ? 'terminal' : mode,
    issues: data.issues,
    milestones: data.milestones,
    stats: data.stats,
    config,
  }

  // Render to terminal or markdown
  const element = React.createElement(MDXComponent, {
    components: {
      ...components,
      Issues: components.Issues,
      Roadmap: components.Roadmap,
      Stats: components.Stats,
      Command: components.Command,
      Agent: components.Agent,
    },
  })

  let result = ''

  if (mode === 'terminal' || mode === 'dual') {
    result = renderToTerminal(element, context)
    if (mode === 'terminal') {
      console.log(result)
    }
  }

  if (mode === 'markdown' || mode === 'dual') {
    const mdContext = { ...context, mode: 'markdown' as const }
    const mdResult = renderToMarkdown(element, mdContext)

    if (output) {
      // Add frontmatter back
      const finalOutput = frontmatter && Object.keys(frontmatter).length > 0
        ? `---\n${serializeYaml(frontmatter)}\n---\n\n${mdResult}`
        : mdResult
      await writeFile(output, finalOutput)
    }

    if (mode === 'markdown') {
      result = mdResult
    }
  }

  return result
}

/** Compile and render to terminal (shorthand) */
export async function renderCli(config: CliConfig = {}): Promise<void> {
  await compile({ ...config, mode: 'terminal' })
}

/** Compile and write to markdown file (shorthand) */
export async function renderMarkdown(config: CliConfig = {}): Promise<void> {
  await compile({ ...config, mode: 'markdown' })
}

/** Compile and do both (shorthand) */
export async function renderDual(config: CliConfig = {}): Promise<void> {
  await compile({ ...config, mode: 'dual' })
}

// Re-export CLI compiler functions
export {
  parseMdxCommands,
  buildCommanderProgram,
  compileToCli,
  executeCli,
} from './cli-compiler.js'
