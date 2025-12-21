/**
 * Initialize a new todo.mdx project
 * Creates TODO.mdx template and .todo/ directory structure
 */

import { existsSync } from 'node:fs'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import * as p from '@clack/prompts'

interface InitOptions {
  projectName?: string
  includeExamples?: boolean
  setupGitHub?: boolean
  beadsEnabled?: boolean
}

const DEFAULT_TEMPLATE = `---
title: TODO
beads: true
filePattern: "[id]-[title].mdx"
---

# {title}

<Stats />

## Ready to Work

<Issues.Ready limit={10} />

## All Open Issues

<Issues.Open />

## Completed

<Issues.Closed />
`

const TEMPLATE_WITH_EXAMPLES = `---
title: TODO
beads: true
filePattern: "[id]-[title].mdx"
---

# {title}

<Stats />

## Ready to Work

<Issues.Ready limit={10} />

## In Progress

<Issues.InProgress />

## Backlog

<Issues.Open />

## Completed

<Issues.Closed limit={20} />
`

const EXAMPLE_TODO_1 = `---
id: example-1
title: Set up your first task
status: open
priority: 1
type: task
---

# Set up your first task

Welcome to todo.mdx! This is an example task to help you get started.

## What you can do

- Edit this file directly in \`.todo/example-1-set-up-your-first-task.mdx\`
- Run \`npx todo.mdx\` to compile your TODO.mdx template to TODO.md
- Run \`npx todo.mdx --watch\` to automatically recompile on changes
- Run \`npx todo.mdx --generate\` to sync with beads/GitHub issues

## Acceptance Criteria

- [ ] Understand how todo.mdx works
- [ ] Create your first real task
- [ ] Delete this example task

## Next Steps

1. Check out the [documentation](https://todo.mdx.do)
2. Set up GitHub sync (optional)
3. Start tracking your work!
`

const EXAMPLE_TODO_2 = `---
id: example-2
title: Explore todo.mdx features
status: open
priority: 2
type: feature
---

# Explore todo.mdx features

todo.mdx supports multiple data sources and powerful features.

## Features

### Data Sources
- **beads**: Local git-based issue tracking
- **GitHub Issues**: Sync with your GitHub repository
- **todo.mdx.do API**: Cloud-hosted issue tracking

### File Patterns
You can configure how issue files are named in TODO.mdx frontmatter:

\`\`\`yaml
filePattern: "[id]-[title].mdx"    # default
filePattern: "[type]/[id].mdx"     # organize by type
filePattern: "[status]/[id].mdx"   # organize by status
\`\`\`

### Components
- \`<Stats />\` - Show project statistics
- \`<Issues.Ready />\` - Tasks ready to work (no blockers)
- \`<Issues.Open />\` - All open issues
- \`<Issues.InProgress />\` - Currently in progress
- \`<Issues.Closed />\` - Completed tasks

## Learn More

Visit [todo.mdx.do](https://todo.mdx.do) for full documentation.
`

const README = `# {projectName}

## Getting Started

This project uses [todo.mdx](https://todo.mdx.do) for task management.

### Commands

\`\`\`bash
# Compile TODO.mdx to TODO.md
npx todo.mdx

# Watch for changes and auto-compile
npx todo.mdx --watch

# Generate .todo/*.md files from issues
npx todo.mdx --generate

# Generate from GitHub issues
npx todo.mdx --generate --source github
\`\`\`

### File Structure

- \`TODO.mdx\` - Template that defines how your TODO.md is generated
- \`TODO.md\` - Compiled markdown (auto-generated, do not edit)
- \`.todo/*.mdx\` - Individual task files (edit these!)

### Configuration

Edit \`TODO.mdx\` frontmatter to configure:
- \`beads\`: Enable beads integration
- \`filePattern\`: How to name .todo files
- \`owner\`/\`repo\`: GitHub repository (for GitHub sync)

## Learn More

- [Documentation](https://todo.mdx.do)
- [GitHub](https://github.com/dot-do/todo.mdx)
`

export async function init(options: Partial<InitOptions> = {}): Promise<void> {
  p.intro('todo.mdx init')

  // Check if already initialized
  if (existsSync('TODO.mdx') || existsSync('.todo')) {
    const shouldContinue = await p.confirm({
      message: 'todo.mdx appears to be already initialized. Continue anyway?',
      initialValue: false,
    })

    if (p.isCancel(shouldContinue) || !shouldContinue) {
      p.cancel('Operation cancelled')
      process.exit(0)
    }
  }

  // Get current directory name as default project name
  const defaultProjectName = basename(resolve(process.cwd()))

  // Interactive prompts
  const projectName =
    options.projectName ||
    ((await p.text({
      message: 'Project name?',
      placeholder: defaultProjectName,
      defaultValue: defaultProjectName,
      validate: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Project name is required'
        }
      },
    })) as string)

  if (p.isCancel(projectName)) {
    p.cancel('Operation cancelled')
    process.exit(0)
  }

  const includeExamples =
    options.includeExamples ??
    ((await p.confirm({
      message: 'Include example tasks?',
      initialValue: true,
    })) as boolean)

  if (p.isCancel(includeExamples)) {
    p.cancel('Operation cancelled')
    process.exit(0)
  }

  const beadsEnabled =
    options.beadsEnabled ??
    ((await p.confirm({
      message: 'Enable beads integration? (local git-based issue tracking)',
      initialValue: true,
    })) as boolean)

  if (p.isCancel(beadsEnabled)) {
    p.cancel('Operation cancelled')
    process.exit(0)
  }

  const setupGitHub =
    options.setupGitHub ??
    ((await p.confirm({
      message: 'Set up GitHub sync?',
      initialValue: false,
    })) as boolean)

  if (p.isCancel(setupGitHub)) {
    p.cancel('Operation cancelled')
    process.exit(0)
  }

  let githubOwner = ''
  let githubRepo = ''

  if (setupGitHub) {
    githubOwner = (await p.text({
      message: 'GitHub owner (username or org)?',
      placeholder: 'your-username',
      validate: (value) => {
        if (!value || value.trim().length === 0) {
          return 'GitHub owner is required'
        }
      },
    })) as string

    if (p.isCancel(githubOwner)) {
      p.cancel('Operation cancelled')
      process.exit(0)
    }

    githubRepo = (await p.text({
      message: 'GitHub repository name?',
      placeholder: 'your-repo',
      validate: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Repository name is required'
        }
      },
    })) as string

    if (p.isCancel(githubRepo)) {
      p.cancel('Operation cancelled')
      process.exit(0)
    }
  }

  const s = p.spinner()
  s.start('Creating project structure...')

  try {
    // Create .todo directory
    if (!existsSync('.todo')) {
      await mkdir('.todo', { recursive: true })
    }

    // Create TODO.mdx with appropriate template
    let template = includeExamples ? TEMPLATE_WITH_EXAMPLES : DEFAULT_TEMPLATE

    // Add GitHub config if requested
    if (setupGitHub) {
      const frontmatterMatch = template.match(/^---\r?\n([\s\S]*?)\r?\n---/)
      if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1]
        const updatedFrontmatter = `${frontmatter}\nowner: ${githubOwner}\nrepo: ${githubRepo}`
        template = template.replace(
          /^---\r?\n[\s\S]*?\r?\n---/,
          `---\n${updatedFrontmatter}\n---`
        )
      }
    }

    // Update beads setting in frontmatter
    if (!beadsEnabled) {
      template = template.replace(/beads: true/, 'beads: false')
    }

    await writeFile('TODO.mdx', template)

    // Create example tasks if requested
    if (includeExamples) {
      await writeFile('.todo/example-1-set-up-your-first-task.mdx', EXAMPLE_TODO_1)
      await writeFile('.todo/example-2-explore-todo-mdx-features.mdx', EXAMPLE_TODO_2)
    }

    // Create README.md if it doesn't exist
    if (!existsSync('README.md')) {
      const readme = README.replace('{projectName}', projectName)
      await writeFile('README.md', readme)
    }

    // Create .gitignore entry if .gitignore exists
    if (existsSync('.gitignore')) {
      const gitignore = await readFile('.gitignore', 'utf-8')
      if (!gitignore.includes('TODO.md')) {
        await writeFile('.gitignore', `${gitignore}\n# todo.mdx generated files\nTODO.md\n`)
      }
    }

    s.stop('Project structure created!')

    // Show next steps
    p.note(
      [
        'Next steps:',
        '',
        '1. Edit TODO.mdx to customize your template',
        includeExamples ? '2. Check out the example tasks in .todo/' : '2. Create your first task',
        '3. Run `npx todo.mdx` to compile TODO.mdx → TODO.md',
        '4. Run `npx todo.mdx --watch` for auto-compilation',
        '',
        beadsEnabled && '   Initialize beads: `bd init`',
        beadsEnabled && '   Create issues: `bd create --title="My task"`',
        '',
        setupGitHub && '   Set up GitHub App:',
        setupGitHub && '   https://github.com/apps/todo-mdx',
        setupGitHub && '',
        setupGitHub && '   Set GITHUB_TOKEN to sync issues:',
        setupGitHub && '   export GITHUB_TOKEN=ghp_your_token',
        setupGitHub && '   npx todo.mdx --generate --source github',
        '',
        'Learn more: https://todo.mdx.do',
      ]
        .filter(Boolean)
        .join('\n'),
      'Get Started'
    )

    p.outro('Happy tracking!')
  } catch (error) {
    s.stop('Failed to create project')
    throw error
  }
}
