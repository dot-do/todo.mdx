/**
 * sbx - Sandbox CLI
 *
 * Connect to a Cloudflare Sandbox terminal session.
 *
 * @example
 * ```bash
 * sbx https://todo.mdx.do/terminal
 * sbx https://todo.mdx.do/terminal --sandbox build --cmd npm --arg test
 * ```
 */

import { main } from './client'

main()
