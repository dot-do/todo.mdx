import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  driver: 'd1-http',
  out: './src/db/schema',
  dbCredentials: {
    // D1 database ID from wrangler.jsonc
    databaseId: '7773cb8c-af79-4ae9-8473-342acbbc0444',
    accountId: 'b6641681fe423910342b9ffa1364c76d',
    token: process.env.CLOUDFLARE_API_TOKEN!,
  },
})
