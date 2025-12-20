# GitHub App Configuration

This directory contains the GitHub App manifest for the todo.mdx integration.

## Installing the GitHub App

### Creating a New GitHub App

1. Go to your GitHub organization settings
2. Navigate to **Developer settings** → **GitHub Apps** → **New GitHub App**
3. Click **Create GitHub App from a manifest**
4. Paste the contents of `app-manifest.json`
5. Review and create the app

### Manifest Contents

The `app-manifest.json` file configures:

#### Permissions

- **Issues**: `write` - Create, update, and sync issues
- **Pull Requests**: `write` - Sync PR status in projects
- **Contents**: `write` - Read TODO.md, ROADMAP.md files
- **Repository Projects**: `write` - Sync repo-level projects
- **Organization Projects**: `write` - Sync org-level projects
- **Metadata**: `read` - Access repository metadata

#### Webhook Events

- `issues` - Issue created, edited, closed, etc.
- `milestone` - Milestone created, edited, closed
- `push` - File changes (TODO.md, ROADMAP.md, .beads/*, .todo/*, .roadmap/*)
- `projects_v2` - Project created, edited, deleted
- `projects_v2_item` - Project item created, edited, archived, reordered

#### Endpoints

- **Webhook URL**: `https://api.todo.mdx.do/github/webhook`
- **Redirect URL**: `https://api.todo.mdx.do/github/callback`

## After Installation

1. **Save App Credentials**
   - App ID
   - Private key (download and store securely)
   - Webhook secret

2. **Configure Worker Environment**
   Add these to your worker's wrangler configuration:
   ```toml
   [vars]
   GITHUB_APP_ID = "123456"

   [[secret]]
   name = "GITHUB_PRIVATE_KEY"

   [[secret]]
   name = "GITHUB_WEBHOOK_SECRET"
   ```

3. **Install on Repositories**
   - Install the app on repositories you want to sync
   - Grant access to specific repos or all repos
   - The app will sync TODO.md, ROADMAP.md, and GitHub issues/milestones/projects

## Updating Permissions

If you need to change permissions:

1. Update `app-manifest.json`
2. Recreate the app or manually update permissions in GitHub App settings
3. Users will be prompted to accept new permissions

## Security

- **Webhook Secret**: Used to verify webhook payloads (HMAC SHA-256)
- **Private Key**: Used to generate installation access tokens (JWT)
- **OAuth Flow**: For user authentication via WorkOS

Never commit credentials to version control!

## Testing Webhooks

Use the GitHub App settings to:

1. View recent webhook deliveries
2. Redeliver failed webhooks
3. Test webhook endpoints

Or use the GitHub CLI:

```bash
gh api repos/OWNER/REPO/hooks
```

## Documentation

See `/docs/github-projects-integration.md` for detailed integration documentation.
