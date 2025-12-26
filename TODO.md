# TODO

## Open

### Bugs

- [ ] [#todo-g354] Rewrite template system to use MDX components with @mdxld/markdown and @mdxld/extract - *bug, P1 #architecture #code-review #src #templates*
- [ ] [#todo-67ch] .github/README.md references non-existent documentation file - *bug, P2 #code-review #docs*
- [ ] [#todo-5jeo] .github/README.md webhook URLs mismatch app-manifest.json - *bug, P2 #code-review #docs*
- [ ] [#todo-2ys6] Bug: generateId uses Math.random() which is not cryptographically secure - *bug, P2 #code-review #security #worker*
- [ ] [#todo-8h01] Generator YAML serialization doesn't escape backslashes - *bug, P2 #code-review #generator #serialization #src*
- [ ] [#todo-w5j0] Memory leak: processedDeliveryIds Set grows unbounded in sync-orchestrator - *bug, P2 #code-review #memory-leak #worker*
- [ ] [#todo-op30] Missing error handling: removeLabel fails silently if label doesn't exist - *bug, P2 #code-review #error-handling #worker*
- [ ] [#todo-f8ou] Potential ReDoS: User-provided regex patterns used unsafely - *bug, P2 #code-review #security #worker*
- [ ] [#todo-257n] README.md and CLAUDE.md show incorrect file naming pattern - *bug, P2 #code-review #docs*

### Tasks

- [ ] [#todo-es3r] Add extractFromMarkdown using @mdxld/extract - *task, P1 #mdx #sync #templates*
- [ ] [#todo-4y3r] Create default MDX templates with component syntax - *task, P1 #mdx #templates*
- [ ] [#todo-vong] Create roundTripComponent definitions for MDX issue components - *task, P1 #components #mdx #templates*
- [ ] [#todo-b8iz] Rewrite renderTemplate to use @mdxld/markdown render() - *task, P1 #mdx #templates*
- [ ] [#todo-ciiu] README.md uses different webhook URL than app-manifest.json - *task, P2 #code-review #docs*
- [ ] [#todo-nahq] Test improvement: Missing error path tests in github-client.test.ts - *task, P2 #code-review #test-coverage #tests*
- [ ] [#todo-jmd8] Test improvement: sync.test.ts mocks hide implementation bugs - *task, P2 #code-review #test-coverage #tests*
- [ ] [#todo-8fe7] Add E2E tests for worker with mock GitHub API - *task, P3 #testing #worker*
- [ ] [#todo-5ic2] CLAUDE.md project structure missing several source files - *task, P3 #code-review #docs*
- [ ] [#todo-p6sx] Compiler non-null assertion on Map.get result - *task, P3 #code-review #compiler #src #type-safety*
- [ ] [#todo-2o80] docs/README.md has outdated TODO list with completed items - *task, P3 #code-review #docs*
- [ ] [#todo-f6g2] Key dependencies list incomplete in CLAUDE.md and README.md - *task, P3 #code-review #docs*
- [ ] [#todo-ldl2] Missing test coverage: src/templates.ts has no direct tests - *task, P3 #code-review #test-coverage #tests*
- [ ] [#todo-9snk] Missing 'blocked' status handling in mapLabels - *task, P3 #code-review #feature-gap #worker*
- [ ] [#todo-gt7k] Potential flaky test: watcher.test.ts relies on timer synchronization - *task, P3 #code-review #flaky-tests #tests*
- [ ] [#todo-6mi5] Type safety: WebhookEvent payload is typed as 'any' - *task, P3 #code-review #type-safety #worker*

### Chores

- [ ] [#todo-h2i6] Missing test coverage: src/patterns.ts and src/presets.ts have no tests - *chore, P2 #code-review #test-coverage #tests*
- [ ] [#todo-larg] Test anti-pattern: sync-orchestrator.test.ts placeholder test with expect(true).toBe(true) - *chore, P2 #code-review #tests*
- [ ] [#todo-y5lg] Patterns.ts has orphaned variable declaration inside function docstring - *chore, P3 #cleanup #code-review #patterns #src*
- [ ] [#todo-a8oq] Test code smell: cli.test.ts uses require() inside tests - *chore, P3 #code-quality #code-review #tests*

## Recently Completed

- [x] [#todo-2tj0] Missing error handling: GitHub API pagination not implemented - *closed 2025-12-25*
- [x] [#todo-ljby] Security: constantTimeCompare leaks length information - *closed 2025-12-25*
- [x] [#todo-bqc2] Race condition: beadsUpdatedAt not updated correctly after conflict resolution - *closed 2025-12-25*
- [x] [#todo-rl4l] Infinite loop potential in handleCollision function - *closed 2025-12-25*
- [x] [#todo-v18a] Type mismatch: Installation entity interfaces differ between entities.ts and index.ts - *closed 2025-12-25*
- [x] [#todo-vjpw] CLI init command writes to .beads/TODO.mdx without checking if .beads exists - *closed 2025-12-25*
- [x] [#todo-dp5x] CLI uses mock beadsOps that don't persist data - *closed 2025-12-25*
- [x] [#todo-a0ao] Parser validateId returns untrimmed ID but validates trimmed version - *closed 2025-12-25*
- [x] [#todo-wz8f] Missing error handling for invalid date strings in parser - *closed 2025-12-25*
- [x] [#todo-0raa] Race condition: watcher can process events during shutdown - *closed 2025-12-24*