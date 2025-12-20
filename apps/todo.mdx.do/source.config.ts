import { defineConfig, defineDocs } from 'fumadocs-mdx/config'
import { remarkInstall } from 'fumadocs-docgen'

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [remarkInstall],
  },
})

export const { docs, meta } = defineDocs({
  dir: 'content/docs',
})
