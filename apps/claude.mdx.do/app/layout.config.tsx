import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'

export const baseOptions: BaseLayoutProps = {
  nav: {
    title: 'claude.mdx',
  },
  links: [
    {
      text: 'Documentation',
      url: '/docs',
      active: 'nested-url',
    },
    {
      text: 'Dashboard',
      url: '/dashboard',
    },
  ],
  githubUrl: 'https://github.com/dot-do/todo.mdx',
}
