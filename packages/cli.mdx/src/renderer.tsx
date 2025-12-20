/**
 * Dual renderer for terminal and markdown output
 * Inspired by Ink but simpler, focused on CLI documentation
 */

import React, { ReactElement, ReactNode } from 'react'
import chalk from 'chalk'
import stripAnsi from 'strip-ansi'
import type { RenderContext, TerminalNode, TerminalStyle } from './types.js'

/** Render React elements to terminal string */
export function renderToTerminal(element: ReactElement, context: RenderContext): string {
  const node = elementToNode(element, { ...context, mode: 'terminal' })
  return nodeToTerminal(node)
}

/** Render React elements to markdown string */
export function renderToMarkdown(element: ReactElement, context: RenderContext): string {
  const node = elementToNode(element, { ...context, mode: 'markdown' })
  return nodeToMarkdown(node)
}

/** Convert React element to terminal node */
function elementToNode(element: ReactNode, context: RenderContext): TerminalNode {
  if (!element) {
    return { type: 'text', content: '' }
  }

  if (typeof element === 'string' || typeof element === 'number') {
    return { type: 'text', content: String(element) }
  }

  if (Array.isArray(element)) {
    return {
      type: 'text',
      children: element.map(e => elementToNode(e, context)),
    }
  }

  if (!React.isValidElement(element)) {
    return { type: 'text', content: '' }
  }

  const { type, props } = element

  // Text node
  if (type === 'text' || typeof type === 'symbol') {
    return { type: 'text', content: props.children || '' }
  }

  // Handle built-in elements
  if (typeof type === 'string') {
    return handleBuiltInElement(type, props, context)
  }

  // Handle component
  if (typeof type === 'function') {
    // Check if it's a class component or function component
    const isClassComponent = type.prototype && type.prototype.isReactComponent
    if (isClassComponent) {
      const instance = new (type as any)(props)
      const rendered = instance.render()
      return elementToNode(rendered, context)
    } else {
      const rendered = (type as any)(props)
      return elementToNode(rendered, context)
    }
  }

  return { type: 'text', content: '' }
}

/** Handle built-in HTML/MDX elements */
function handleBuiltInElement(
  tag: string,
  props: any,
  context: RenderContext
): TerminalNode {
  const children = props.children
    ? Array.isArray(props.children)
      ? props.children.map((c: ReactNode) => elementToNode(c, context))
      : [elementToNode(props.children, context)]
    : []

  switch (tag) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return {
        type: 'text',
        children,
        style: { bold: true, color: context.mode === 'terminal' ? 'cyan' : undefined },
      }

    case 'strong':
    case 'b':
      return { type: 'text', children, style: { bold: true } }

    case 'em':
    case 'i':
      return { type: 'text', children, style: { italic: true } }

    case 'code':
      return {
        type: 'text',
        children,
        style: { color: context.mode === 'terminal' ? 'yellow' : undefined },
      }

    case 'ul':
    case 'ol':
      return { type: 'list', children }

    case 'li':
      return { type: 'text', content: '  • ', children }

    case 'p':
      return { type: 'text', children }

    case 'br':
      return { type: 'newline' }

    default:
      return { type: 'text', children }
  }
}

/** Convert terminal node to ANSI terminal string */
function nodeToTerminal(node: TerminalNode, indent = 0): string {
  const prefix = ' '.repeat(indent)

  if (node.type === 'newline') {
    return '\n'
  }

  if (node.type === 'text') {
    let text = node.content || ''

    // Process children
    if (node.children) {
      const childText = node.children
        .map(child => nodeToTerminal(child, indent))
        .join('')
      text += childText
    }

    // Apply styling
    if (node.style && text) {
      text = applyTerminalStyle(text, node.style)
    }

    return text
  }

  if (node.type === 'list') {
    if (!node.children) return ''
    return node.children.map(child => nodeToTerminal(child, indent)).join('\n')
  }

  return ''
}

/** Apply terminal styling with chalk */
function applyTerminalStyle(text: string, style: TerminalStyle): string {
  let result = text

  if (style.color) {
    result = (chalk as any)[style.color](result)
  }

  if (style.bg) {
    const bgKey = `bg${style.bg.charAt(0).toUpperCase()}${style.bg.slice(1)}`
    result = (chalk as any)[bgKey](result)
  }

  if (style.bold) result = chalk.bold(result)
  if (style.italic) result = chalk.italic(result)
  if (style.underline) result = chalk.underline(result)
  if (style.dim) result = chalk.dim(result)

  return result
}

/** Convert terminal node to markdown string */
function nodeToMarkdown(node: TerminalNode, indent = 0): string {
  const prefix = ' '.repeat(indent)

  if (node.type === 'newline') {
    return '\n'
  }

  if (node.type === 'text') {
    let text = node.content || ''

    // Process children
    if (node.children) {
      const childText = node.children
        .map(child => nodeToMarkdown(child, indent))
        .join('')
      text += childText
    }

    // Apply markdown styling
    if (node.style && text) {
      text = applyMarkdownStyle(text, node.style)
    }

    return text
  }

  if (node.type === 'list') {
    if (!node.children) return ''
    return node.children.map(child => nodeToMarkdown(child, indent)).join('\n')
  }

  return ''
}

/** Apply markdown styling */
function applyMarkdownStyle(text: string, style: TerminalStyle): string {
  let result = text

  if (style.bold) result = `**${result}**`
  if (style.italic) result = `_${result}_`

  return result
}

/** Box component for terminal */
export function Box({ children, ...props }: { children?: ReactNode; style?: TerminalStyle }) {
  return <text style={props.style}>{children}</text>
}

/** Text component */
export function Text({ children, ...props }: { children?: ReactNode; style?: TerminalStyle }) {
  return <text style={props.style}>{children}</text>
}

/** Newline component */
export function Newline() {
  return <br />
}

/** Render helper that strips ANSI codes */
export function stripAnsiCodes(text: string): string {
  return stripAnsi(text)
}
