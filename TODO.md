# TODO

## Open

### Bugs

- [ ] [#todo-dp5x] CLI uses mock beadsOps that don't persist data - *bug, P1 #code-review #incomplete #worker*
- [ ] [#todo-2tj0] Missing error handling: GitHub API pagination not implemented - *bug, P1 #code-review #data-loss #worker*
- [ ] [#todo-bqc2] Race condition: beadsUpdatedAt not updated correctly after conflict resolution - *bug, P1 #code-review #sync #worker*
- [ ] [#todo-g354] Templates use handlebars syntax but renderTemplate uses different slot system - *bug, P1 #architecture #code-review #src #templates*
- [ ] [#todo-v18a] Type mismatch: Installation entity interfaces differ between entities.ts and index.ts - *bug, P1 #code-review #type-safety #worker*
- [ ] [#todo-67ch] .github/README.md references non-existent documentation file - *bug, P2 #code-review #docs*
- [ ] [#todo-5jeo] .github/README.md webhook URLs mismatch app-manifest.json - *bug, P2 #code-review #docs*
- [ ] [#todo-2ys6] Bug: generateId uses Math.random() which is not cryptographically secure - *bug, P2 #code-review #security #worker*
- [ ] [#todo-vjpw] CLI init command writes to .beads/TODO.mdx without checking if .beads exists - *bug, P2 #cli #code-review #error-handling #src*
- [ ] [#todo-8h01] Generator YAML serialization doesn't escape backslashes - *bug, P2 #code-review #generator #serialization #src*
- [ ] [#todo-rl4l] Infinite loop potential in handleCollision function - *bug, P2 #code-review #patterns #src*
- [ ] [#todo-w5j0] Memory leak: processedDeliveryIds Set grows unbounded in sync-orchestrator - *bug, P2 #code-review #memory-leak #worker*
- [ ] [#todo-wz8f] Missing error handling for invalid date strings in parser - *bug, P2 #code-review #parser #src #validation*
- [ ] [#todo-op30] Missing error handling: removeLabel fails silently if label doesn't exist - *bug, P2 #code-review #error-handling #worker*
- [ ] [#todo-a0ao] Parser validateId returns untrimmed ID but validates trimmed version - *bug, P2 #code-review #parser #src #validation*
- [ ] [#todo-f8ou] Potential ReDoS: User-provided regex patterns used unsafely - *bug, P2 #code-review #security #worker*
- [ ] [#todo-257n] README.md and CLAUDE.md show incorrect file naming pattern - *bug, P2 #code-review #docs*
- [ ] [#todo-ljby] Security: constantTimeCompare leaks length information - *bug, P2 #code-review #security #worker*

### Tasks

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

- [x] [#todo-0raa] Race condition: watcher can process events during shutdown - *closed 2025-12-24*
- [x] [#todo-wq9p] Deploy worker to todo.mdx.workers.dev - *closed 2025-12-24*
- [x] [#todo-hd4v] Path traversal vulnerability in generator despite validation - *closed 2025-12-24*
- [x] [#todo-203p] sync.ts creates issues without using provided ID - *closed 2025-12-24*
- [x] [#todo-1vuu] Sync detectChanges doesn't handle deleted issues - *closed 2025-12-24*
- [x] [#todo-3lkg] Uncaught errors in watcher debounce callback can crash process - *closed 2025-12-24*
- [x] [#todo-gpm0] Test anti-pattern: beads.test.ts tests against live project data - *closed 2025-12-24*
- [x] [#todo-51s3] Test anti-pattern: integration.test.ts tests against live project data - *closed 2025-12-24*
- [x] [#todo-znxc] Incomplete implementation: handleIssueEvent and handleCommentEvent have TODO stubs - *closed 2025-12-24*
- [x] [#todo-140e] Publish todo.mdx package to npm - *closed 2025-12-24*