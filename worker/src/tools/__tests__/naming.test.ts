import { describe, it, expect } from 'vitest'
import { toBindingName, toStorageName, toFullToolName } from '../naming'

describe('naming utilities', () => {
  describe('toBindingName', () => {
    it('converts PascalCase to camelCase', () => {
      expect(toBindingName('GitHub')).toBe('github')
      expect(toBindingName('Linear')).toBe('linear')
      expect(toBindingName('Slack')).toBe('slack')
    })

    it('handles already lowercase names', () => {
      expect(toBindingName('github')).toBe('github')
    })

    it('handles multi-word PascalCase', () => {
      expect(toBindingName('GoogleDrive')).toBe('googleDrive')
      expect(toBindingName('MicrosoftTeams')).toBe('microsoftTeams')
    })
  })

  describe('toStorageName', () => {
    it('converts camelCase to PascalCase', () => {
      expect(toStorageName('github')).toBe('GitHub')
      expect(toStorageName('linear')).toBe('Linear')
      expect(toStorageName('slack')).toBe('Slack')
    })

    it('handles already capitalized names', () => {
      expect(toStorageName('GitHub')).toBe('GitHub')
    })

    it('handles multi-word camelCase', () => {
      expect(toStorageName('googleDrive')).toBe('GoogleDrive')
      expect(toStorageName('microsoftTeams')).toBe('MicrosoftTeams')
    })
  })

  describe('toFullToolName', () => {
    it('builds full tool name with binding format', () => {
      expect(toFullToolName('GitHub', 'createPullRequest')).toBe('github.createPullRequest')
      expect(toFullToolName('Linear', 'createIssue')).toBe('linear.createIssue')
    })

    it('handles camelCase app names', () => {
      expect(toFullToolName('github', 'createPullRequest')).toBe('github.createPullRequest')
    })

    it('preserves action name casing', () => {
      expect(toFullToolName('GitHub', 'getPR')).toBe('github.getPR')
      expect(toFullToolName('GitHub', 'get_pr')).toBe('github.get_pr')
    })
  })
})
