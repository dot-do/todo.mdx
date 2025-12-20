import { execa } from 'execa'
import path from 'path'
import fs from 'fs/promises'
import crypto from 'crypto'

const FIXTURES_DIR = process.env.FIXTURES_DIR || path.join(__dirname, '..', 'fixtures')
const SUBMODULE_PATH = path.join(FIXTURES_DIR, 'test.mdx')
const WORKTREES_DIR = path.join(FIXTURES_DIR, '.worktrees')

export interface Worktree {
  path: string
  branch: string
  cleanup: () => Promise<void>
}

// Track active worktrees for cleanup
const activeWorktrees: Set<string> = new Set()

function randomId(): string {
  return crypto.randomBytes(4).toString('hex')
}

export async function createTestWorktree(testName: string): Promise<Worktree> {
  const branchName = `test/${testName}-${randomId()}`
  const worktreePath = path.join(WORKTREES_DIR, branchName.replace(/\//g, '-'))

  // Ensure worktrees directory exists
  await fs.mkdir(WORKTREES_DIR, { recursive: true })

  // Create new branch and worktree from submodule
  await execa('git', ['worktree', 'add', '-b', branchName, worktreePath], {
    cwd: SUBMODULE_PATH,
  })

  activeWorktrees.add(worktreePath)

  return {
    path: worktreePath,
    branch: branchName,
    cleanup: async () => {
      try {
        // Remove worktree
        await execa('git', ['worktree', 'remove', worktreePath, '--force'], {
          cwd: SUBMODULE_PATH,
        })
        // Delete the branch
        await execa('git', ['branch', '-D', branchName], {
          cwd: SUBMODULE_PATH,
        }).catch(() => {}) // Ignore if branch already deleted
        activeWorktrees.delete(worktreePath)
      } catch (error) {
        console.warn(`Failed to cleanup worktree ${worktreePath}:`, error)
      }
    },
  }
}

export async function cleanupAllWorktrees(): Promise<void> {
  // List all worktrees
  const { stdout } = await execa('git', ['worktree', 'list', '--porcelain'], {
    cwd: SUBMODULE_PATH,
  }).catch(() => ({ stdout: '' }))

  // Parse worktree paths that are in our worktrees directory
  const worktreePaths = stdout
    .split('\n')
    .filter((line) => line.startsWith('worktree '))
    .map((line) => line.replace('worktree ', ''))
    .filter((p) => p.startsWith(WORKTREES_DIR))

  // Remove each worktree
  for (const worktreePath of worktreePaths) {
    try {
      await execa('git', ['worktree', 'remove', worktreePath, '--force'], {
        cwd: SUBMODULE_PATH,
      })
    } catch {
      // Try to remove directory manually if git fails
      await fs.rm(worktreePath, { recursive: true, force: true }).catch(() => {})
    }
  }

  // Prune worktree references
  await execa('git', ['worktree', 'prune'], { cwd: SUBMODULE_PATH }).catch(() => {})

  activeWorktrees.clear()
}

export async function execInWorktree(
  worktree: Worktree,
  command: string,
  args: string[] = []
): Promise<{ stdout: string; stderr: string }> {
  return execa(command, args, { cwd: worktree.path })
}
