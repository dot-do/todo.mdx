/**
 * Component registry - manages built-in and custom components
 */

import type { Component, ComponentRenderer } from '../types.js'

const components = new Map<string, Component>()

/**
 * Register a component for use in ROADMAP.mdx
 */
export function registerComponent(
  name: string,
  render: ComponentRenderer,
  description?: string
): void {
  components.set(name, { name, render, description })
}

/**
 * Get a registered component by name
 */
export function getComponent(name: string): Component | undefined {
  return components.get(name)
}

/**
 * List all registered components
 */
export function listComponents(): Component[] {
  return Array.from(components.values())
}

/**
 * Check if a component is registered
 */
export function hasComponent(name: string): boolean {
  return components.has(name)
}

/**
 * Unregister a component
 */
export function unregisterComponent(name: string): boolean {
  return components.delete(name)
}
