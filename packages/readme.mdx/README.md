# readme.mdx

MDX components that compile to README.md with live data from package.json, GitHub, and npm.

## Features

- **Live data** - Pulls from package.json, GitHub API, and npm API
- **MDX components** - `<Badges />`, `<Installation />`, `<Usage />`, etc.
- **Zero config** - Works out of the box with sensible defaults
- **Customizable** - Control which data sources to use
- **Fast** - Compiles in milliseconds

## Installation

```bash
npm install readme.mdx
```

## Quick Start

1. Create a `README.mdx` file:

```mdx
# {name}

<Badges />

{description}

## Installation

<Installation />

## Usage

<Usage />

## License

<License />
```

2. Compile to `README.md`:

```bash
npx readme.mdx
```

## Components

### `<Badges />`

Renders npm, GitHub, license, and build status badges.

**Props:**
- `style` - Badge style: flat, flat-square, plastic, for-the-badge, social
- `npm` - Show npm badges (default: true)
- `github` - Show GitHub badges (default: true)
- `license` - Show license badge (default: true)
- `build` - Show build status badge (default: false)

**Example:**
```mdx
<Badges style="flat-square" />
```

### `<Installation />`

Renders package installation instructions for npm, yarn, and pnpm.

**Example:**
```mdx
<Installation />
```

### `<Usage />`

Renders a basic usage example template.

**Example:**
```mdx
<Usage />
```

### `<API />`

Renders API documentation from package.json (main, types, bin).

**Example:**
```mdx
<API />
```

### `<Contributing />`

Renders contribution guidelines with GitHub links.

**Example:**
```mdx
<Contributing />
```

### `<License />`

Renders license information from package.json.

**Example:**
```mdx
<License />
```

### `<Package />`

Renders package description, keywords, and version.

**Example:**
```mdx
<Package />
```

### `<Stats />`

Renders GitHub stars, forks, and npm download stats.

**Example:**
```mdx
<Stats />
```

## Variables

Use these variables in your template:

- `{name}` - Package name from package.json
- `{version}` - Package version
- `{description}` - Package description
- `{license}` - Package license

## CLI

```bash
# Compile README.mdx to README.md
npx readme.mdx

# Initialize README.mdx template
npx readme.mdx init

# Watch mode (coming soon)
npx readme.mdx --watch

# Skip external API calls
npx readme.mdx --no-github --no-npm

# Custom output file
npx readme.mdx -o docs/README.md
```

## Programmatic Usage

```typescript
import { compile } from 'readme.mdx'

await compile({
  input: 'README.mdx',
  output: 'README.md',
  config: {
    badges: true,
    npmStats: true,
  },
})
```

## Data Sources

### package.json

Always loaded from the current directory. Contains:
- Name, version, description
- License, author
- Repository, homepage
- Scripts, bin, dependencies
- Keywords

### GitHub API

Fetches (if repository is in package.json):
- Stars, forks, watchers
- Open issues count
- Topics, license
- Last update time

Set `GITHUB_TOKEN` environment variable for authenticated requests (higher rate limits).

### npm API

Fetches (if package is published):
- Download stats (daily, weekly, monthly)
- Published date
- Latest version

## Examples

### Minimal

```mdx
# {name}

<Badges npm={false} />

{description}

<Installation />
```

### Full

```mdx
---
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
```

## License

MIT
