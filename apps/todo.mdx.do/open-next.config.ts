import type { OpenNextConfig } from '@opennextjs/cloudflare'

const config: OpenNextConfig = {
  default: {
    override: {
      wrapper: 'cloudflare-node',
      queue: 'sqs-lite',
      incrementalCache: 'dummy',
      tagCache: 'dummy',
    },
  },
}

export default config
