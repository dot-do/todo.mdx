import { docs, meta } from '@/.source/server'
import { createMDXSource } from 'fumadocs-mdx'
import { loader } from 'fumadocs-core/source'

export const source = loader({
  baseUrl: '/docs',
  source: createMDXSource(docs, meta),
})

export const pageTree = source.pageTree
