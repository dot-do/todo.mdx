# Ecosystem Reference

Detailed reference for the autonomous startups.studio ecosystem. See SKILL.md for overview and workflows.

## Core Vision: Every Noun → Beautiful Design

**The fundamental insight of mdxui**: Any Thing can render at any level.

```
Thing (schema.org.ai)  ×  Level (Site/Page/Section)  ×  Display (cards/rows/kanban)  =  Component
```

Traditional components are buttons and forms. But business isn't made of buttons—it's made of **Agents**, **Services**, **Workflows**, **Startups**. mdxui lifts the abstraction to where business actually lives.

### Domain Components
```tsx
<Startup />     // Venture-backed company with billing, auth, dashboards
<Agency />      // Service business with clients and projects
<SaaS />        // Software-as-a-Service with subscriptions
<Agent />       // AI agent with tools and capabilities
<Service />     // Professional service offering
<Workflow />    // Multi-step automated process
```

Each component deploys real infrastructure. **Type-safe. Auto-wired. Production-ready.**

## Vision Matrix

The autonomous startups.studio generates startups as permutations across:

| Dimension | Count | Examples |
|-----------|-------|----------|
| Occupations | 1,459 | O*NET occupations (accountant, designer, developer...) |
| Industries | 68 | NAICS industries (healthcare, finance, manufacturing...) |
| Processes | 100+ | Business processes (onboarding, billing, support...) |
| Tasks | 17,588 | O*NET tasks mapped to occupations |
| Tools | 1,000+ | Software tools (Salesforce, Slack, GitHub...) |
| Technologies | 500+ | Tech stack options (React, Python, AWS...) |
| Business Models | 20+ | SaaS, marketplace, API, agency... |

**Potential combinations**: Billions of unique startup opportunities

## Package Inventory

### db.sb Repo Packages

| Package | Version | Purpose | Maturity |
|---------|---------|---------|----------|
| api.sb | 0.1.2 | TypeScript client & schemas | 80% |
| db.sb | 0.1.7 | Payload collections & fields | 75% |
| business-as-code | 0.2.1 | Business definition DSL | 50% |
| startups.studio | 0.1.4 | MDX business sync CLI | 40% |
| startup-builder | 0.1.0 | CLI for creating startups | 30% |
| services-builder | - | Create service products | Planning |
| sales-builder | - | Autonomous demand-gen | Planning |

### ui Submodule Packages

| Package | Purpose | Status |
|---------|---------|--------|
| mdxui | Type contracts (SiteComponents, AppComponents) | Active |
| @mdxui/primitives | Core UI components | Active |
| @mdxui/widgets | Complex widgets (Chatbox, Editor) | Active |
| @mdxui/beacon | Site template components | Active |
| @mdxui/cockpit | App template components | Active |
| @mdxui/zero | Zero email client components | Active |

### Platform Repo Packages (Reference)

| Package | Purpose | Status |
|---------|---------|--------|
| graphdl | Graph definition language | Published v1.0.0 |
| autonomous-agents | Agent orchestration | 60% |
| digital-workers | Worker definitions | 70% |
| do.industries | Industry verticals | 75% |
| sdk.do | TypeScript semantic API | Stable |
| cli.do | CLI interface | Stable |
| mcp.do | Model Context Protocol | Active |

## Workers

### db.sb Workers

| Worker | Port | Purpose |
|--------|------|---------|
| api | 4200 | Full API (AI, payments, enrichment) |
| db | 4201 | Database operations |
| admin | - | Payload CMS admin |
| app | 4203 | Web application |
| editor | 4204 | Code/document editor |
| mcp | - | Model Context Protocol |
| vibecode | 4205 | AI code generation |
| docs | - | Documentation site |
| site | 4206 | Marketing site |
| directory | 4207 | Public directory |

## API Categories

### AI Functions
- `generate()` - Structured output
- `write()` - Markdown/text
- `list()` / `lists()` - List generation
- `embed()` - Vector embeddings
- `search()` - Vector similarity
- `generateImage()` - Image generation
- `generateSpeech()` - Text-to-speech

### Communications
- `sendEmail()` - AWS SES
- `sendText()` - Twilio SMS

### Enrichment
- `searchPeople()` - Apollo.io
- `searchCompanies()` - Apollo.io
- `enrichPerson()` - Apollo.io

### Payments
- `createCustomer()` - Stripe
- `createSubscription()` - Stripe
- `createCheckout()` - Stripe

### Sandbox
- `runJavaScript()` / `runTypeScript()` / `runPython()`
- `runClaudeCode()` - AI-powered execution

## Function Types

| Type | Description | Execution |
|------|-------------|-----------|
| **Code** | JS/TS/Python scripts | Cloudflare Sandbox |
| **Generative** | AI content generation | AI Gateway |
| **Agentic** | Tool-calling agents | LLM + recursive tools |
| **Human** | Task queue | Creates Tasks for humans |

## Strategic Dependencies

### Critical Path to Profitability

```
Platform Foundation (Q1)
    ├── db.sb collections complete
    ├── api.sb SDK stable
    └── Auth/payments/comms working
            ↓
Product Excellence (Q2)
    ├── business-as-code DSL
    ├── services-as-software templates
    └── UI components (mdxui)
            ↓
Sales Automation (Q3-Q4)
    ├── startup-builder generating startups
    ├── services-builder creating service products
    └── sales-builder autonomous demand-gen ★
            ↓
Autonomous Profitable Startups
```

### Dependency Rules

1. **sales-builder** depends on startup-builder + services-builder
2. **services-builder** depends on business-as-code + services-as-software
3. **startup-builder** depends on db.sb + api.sb + business-as-code
4. **business-as-code** depends on db.sb collections
5. **UI components** needed for all user-facing products

## GDPval Framework (Services-as-Software)

Score services for automation potential:

| Factor | Weight | Description |
|--------|--------|-------------|
| **G**rowth | 1-10 | Market growth rate |
| **D**eliverability | 1-10 | Can AI deliver quality? |
| **P**rice | 1-10 | Price point sustainability |
| **V**olume | 1-10 | Market size |
| **A**utomation | 1-10 | % automatable |
| **L**everage | 1-10 | Scalability multiplier |

**Score**: G × D × P × V × A × L (higher = better opportunity)

## ICP Matrix (Sales-Builder)

Target customers as intersection of:

| Dimension | Source | Count |
|-----------|--------|-------|
| Occupation | O*NET | 1,459 |
| Industry | NAICS | 68 |
| Company Size | Segment | 5 (startup → enterprise) |
| Geography | Region | Variable |
| Pain Point | Mapped | Per occupation × process |

**Example ICP**: "Marketing Manager at mid-size Healthcare company struggling with lead generation"

## Content Generation Matrix

For each startup permutation, generate:

| Content Type | Template | Volume |
|--------------|----------|--------|
| Problems | Per occupation × industry × task | 10M+ |
| Solutions | Per problem × tool × tech | 100M+ |
| Landing Pages | Per solution × business model | Billions |
| Campaigns | Per ICP × pain point | Billions |

## Revenue Model

### Platform Revenue
- Domain sales ($500K ARR target)
- Startup templates ($200K ARR target)
- Subscriptions ($200K ARR target)
- Marketplace fees ($100K ARR target)

### Per-Startup Revenue
- SaaS subscriptions
- API usage fees
- Transaction fees
- Human task fees

### Autonomous Scaling
- Cost per startup creation: ~$0
- Cost per campaign variation: ~$0
- Cost per lead: Variable by channel
- Revenue per customer: $200-2000+ MRR

## Technology Stack

### Runtime
- Cloudflare Workers (primary)
- Vercel (Next.js apps)
- Neon PostgreSQL (production DB)

### Frameworks
- TypeScript (everywhere)
- React 19 / Next.js 15
- Payload CMS 3.68
- Hono (worker framework)
- Tailwind CSS v4

### AI
- Anthropic Claude (primary)
- OpenAI (secondary)
- Cloudflare AI (edge)

### Build
- pnpm 9.15+
- Turbo 2.3+
- Vitest (testing)
- Playwright (E2E)

## Beads Issue Conventions

### Epic Naming
```
[AREA]: [Goal] - [Scope]
Examples:
- "Platform: Complete auth system"
- "UI: mdxui type system v1"
- "Sales: Autonomous campaign engine"
```

### Task Naming
```
[Verb] [object] [context]
Examples:
- "Implement OAuth2 provider"
- "Add visual regression tests for Hero"
- "Create campaign template DSL"
```

### Labels
- `type`: epic, feature, task, bug
- `priority`: P0-P4
- `area`: platform, ui, business, sales
- `status`: open, in_progress, blocked, closed

## Submodule Management

### Adding New Submodule
```bash
# Add submodule
git submodule add <repo-url> <path>

# Initialize beads
cd <path>
bd init
bd create --title="Initial roadmap epic" --type=epic --priority=1

# Link to main roadmap
cd ..
# Document cross-repo dependency in epic description
```

### Updating Submodules
```bash
# Update all submodules
git submodule update --remote --merge

# Sync beads in each
for dir in ui; do
  (cd $dir && bd sync)
done
```

## Growth Targets

| Metric | Q1 | Q2 | Q3 | Q4 |
|--------|-----|-----|-----|-----|
| Users | 1K | 10K | 50K | 100K |
| ARR | $50K | $200K | $500K | $1M |
| Startups Created | 100 | 1K | 10K | 100K |
| Campaigns Running | 10 | 100 | 1K | 10K |
