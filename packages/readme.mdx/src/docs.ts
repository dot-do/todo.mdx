/**
 * Documentation and examples for readme.mdx
 */

export const EXAMPLES = {
  basic: `---
title: My Awesome Package
---

# {name}

<Badges />

{description}

## Installation

<Installation />

## Usage

<Usage />

## License

<License />
`,

  full: `---
title: My Awesome Package
badges: true
npmStats: true
---

# {name}

<Badges style="flat-square" />

<Package />

<Stats />

## Installation

<Installation />

## Usage

<Usage />

## API

<API />

## Contributing

<Contributing />

## License

<License />
`,

  minimal: `# {name}

<Badges npm={false} />

{description}

<Installation />
`,

  custom: `---
title: {name}
---

# {name}

[![npm](https://img.shields.io/npm/v/{name})](https://npmjs.com/package/{name})

> {description}

## Quick Start

<Installation />

\`\`\`typescript
import { something } from '{name}'

// Your code here
\`\`\`

## Documentation

<API />

---

<License />
`,
}

export const COMPONENTS = {
  Badges: {
    description: 'Renders npm, GitHub, license, and build status badges',
    props: {
      style: 'Badge style: flat, flat-square, plastic, for-the-badge, social',
      npm: 'Show npm badges (default: true)',
      github: 'Show GitHub badges (default: true)',
      license: 'Show license badge (default: true)',
      build: 'Show build status badge (default: false)',
      coverage: 'Show coverage badge (default: false)',
    },
    example: '<Badges style="flat-square" />',
  },

  Installation: {
    description: 'Renders package installation instructions for npm, yarn, and pnpm',
    props: {},
    example: '<Installation />',
  },

  Usage: {
    description: 'Renders a basic usage example template',
    props: {},
    example: '<Usage />',
  },

  API: {
    description: 'Renders API documentation from package.json (main, types, bin)',
    props: {},
    example: '<API />',
  },

  Contributing: {
    description: 'Renders contribution guidelines with GitHub links',
    props: {},
    example: '<Contributing />',
  },

  License: {
    description: 'Renders license information from package.json',
    props: {},
    example: '<License />',
  },

  Package: {
    description: 'Renders package description, keywords, and version',
    props: {},
    example: '<Package />',
  },

  Stats: {
    description: 'Renders GitHub stars, forks, and npm download stats',
    props: {},
    example: '<Stats />',
  },
}

export const VARIABLES = {
  name: 'Package name from package.json',
  version: 'Package version from package.json',
  description: 'Package description from package.json',
  license: 'Package license from package.json',
}

export const README = `# readme.mdx

MDX components that compile to README.md with live data from package.json, GitHub, and npm.

## Installation

\`\`\`bash
npm install readme.mdx
\`\`\`

## Usage

Create a \`README.mdx\` file:

\`\`\`mdx
# {name}

<Badges />

{description}

## Installation

<Installation />

## Usage

<Usage />

## License

<License />
\`\`\`

Compile to \`README.md\`:

\`\`\`bash
npx readme.mdx
\`\`\`

## Components

${Object.entries(COMPONENTS)
  .map(
    ([name, info]) =>
      `### <${name} />

${info.description}

**Example:**
\`\`\`mdx
${info.example}
\`\`\`

${
  Object.keys(info.props).length > 0
    ? `**Props:**
${Object.entries(info.props)
  .map(([prop, desc]) => `- \`${prop}\`: ${desc}`)
  .join('\n')}`
    : ''
}
`
  )
  .join('\n')}

## Variables

${Object.entries(VARIABLES)
  .map(([name, desc]) => `- \`{${name}}\`: ${desc}`)
  .join('\n')}

## CLI

\`\`\`bash
# Compile README.mdx to README.md
npx readme.mdx

# Initialize README.mdx template
npx readme.mdx init

# Watch mode
npx readme.mdx --watch

# Skip external API calls
npx readme.mdx --no-github --no-npm
\`\`\`

## License

MIT
`
