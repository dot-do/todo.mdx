import { docs, meta } from '@/.source/server'
import { loader } from 'fumadocs-core/source'
import { createMDXSource } from 'fumadocs-mdx'

export const source = loader({
  baseUrl: '/docs',
  source: createMDXSource(docs, meta),
})
