/**
 * MCP Server with WorkOS AuthKit
 *
 * Implements the Model Context Protocol using the Cloudflare agents framework
 * with OAuth 2.1 authentication via WorkOS AuthKit.
 */

import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";
import { AuthkitHandler } from "./authkit-handler";
import type { Props } from "./props";
import type { Env } from "../types";
import { executeSandboxedWorkflow } from "../sandbox";

export class TodoMCP extends McpAgent<Env, unknown, Props> {
	server = new McpServer({
		name: "todo.mdx",
		version: "0.1.0",
	});

	/**
	 * Helper to get repos the authenticated user has access to.
	 * Uses two-step query since nested relationship queries aren't supported.
	 */
	private async getUserRepos(env: Env, workosUserId: string): Promise<any[]> {
		// Step 1: Find the Payload user by WorkOS ID
		const userResult = await env.PAYLOAD.find({
			collection: "users",
			where: { workosUserId: { equals: workosUserId } },
			limit: 1,
		});

		if (!userResult.docs?.length) {
			return [];
		}

		const payloadUserId = userResult.docs[0].id;

		// Step 2: Find installations the user has access to
		const installationsResult = await env.PAYLOAD.find({
			collection: "installations",
			where: { users: { contains: payloadUserId } },
			limit: 100,
		});

		if (!installationsResult.docs?.length) {
			return [];
		}

		const installationIds = installationsResult.docs.map((i: any) => i.id);

		// Step 3: Find repos for those installations
		const reposResult = await env.PAYLOAD.find({
			collection: "repos",
			where: { installation: { in: installationIds } },
			limit: 100,
		});

		return reposResult.docs || [];
	}

	async init() {
		// Search: hybrid keyword + vector search across all issues
		this.server.tool(
			"search",
			`Search issues across all repositories.

Returns: Array<{ id, title, repo, status, priority }>

Examples:
  search({ query: "authentication bug" })
  search({ query: "P0 urgent", limit: 5 })`,
			{
				query: z.string().describe("Search text (matches title, description, labels)"),
				limit: z.number().optional().default(20).describe("Max results (default: 20)"),
			},
			{ readOnlyHint: true },
			async ({ query, limit }) => {
				try {
					const env = this.env as Env;
					const workosUserId = this.props?.user?.id;

					if (!workosUserId) {
						return {
							content: [{ type: "text", text: "Error: Not authenticated" }],
							isError: true,
						};
					}

					const repos = await this.getUserRepos(env, workosUserId);

					const [keywordResults, vectorResults] = await Promise.all([
						// Keyword search via RepoDO
						(async () => {
							const results: Array<{ id: string; title: string; repo: string; status: string; priority: number }> = [];

							for (const repo of repos) {
								const doId = env.REPO.idFromName(repo.fullName);
								const stub = env.REPO.get(doId);
								const searchResponse = await stub.fetch(
									new Request(`http://do/issues/search?q=${encodeURIComponent(query)}`)
								);
								const issues = await searchResponse.json() as any[];

								for (const issue of issues) {
									results.push({
										id: issue.github_number?.toString() || issue.id,
										title: issue.title,
										repo: repo.fullName,
										status: issue.status,
										priority: issue.priority,
									});
								}
							}
							return results;
						})(),

						// Vector search
						(async () => {
							const results: Array<{ id: string; title: string; repo: string; status: string; priority: number; score: number }> = [];
							try {
								const embeddingResult = await env.AI.run("@cf/baai/bge-m3", { text: [query] }) as { data: number[][] };
								const vectorResult = await env.VECTORIZE.query(embeddingResult.data[0], {
									topK: Math.min(limit, 50),
									returnMetadata: "all",
								});

								for (const match of vectorResult.matches) {
									results.push({
										id: match.id,
										title: match.metadata?.title as string || "Untitled",
										repo: match.metadata?.repo as string || "",
										status: match.metadata?.status as string || "unknown",
										priority: match.metadata?.priority as number || 2,
										score: match.score,
									});
								}
							} catch (e) {
								console.log("Vector search error:", e);
							}
							return results;
						})(),
					]);

					// Combine: keyword first, then vector (deduplicated)
					const seenIds = new Set<string>();
					const results: Array<{ id: string; title: string; repo: string; status: string; priority: number }> = [];

					for (const r of keywordResults) {
						if (!seenIds.has(r.id) && results.length < limit) {
							seenIds.add(r.id);
							results.push(r);
						}
					}

					for (const r of vectorResults.sort((a, b) => b.score - a.score)) {
						if (!seenIds.has(r.id) && results.length < limit) {
							seenIds.add(r.id);
							results.push({ id: r.id, title: r.title, repo: r.repo, status: r.status, priority: r.priority });
						}
					}

					return {
						content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
					};
				} catch (error: any) {
					return {
						content: [{ type: "text", text: `Error: ${error.message}` }],
						isError: true,
					};
				}
			},
		);

		// List: get issues with optional filters
		this.server.tool(
			"list",
			`List issues with optional filters.

Returns: Array<{ id, title, status, priority, issue_type, assignee }>

Examples:
  list({ repo: "owner/repo" })                          // all issues
  list({ repo: "owner/repo", status: "open" })          // open issues
  list({ repo: "owner/repo", priority: 1, limit: 10 })  // high priority`,
			{
				repo: z.string().describe("Repository (owner/name)"),
				status: z.enum(["open", "in_progress", "blocked", "closed"]).optional().describe("Filter by status"),
				priority: z.number().optional().describe("Filter by priority (0-4)"),
				issue_type: z.enum(["bug", "feature", "task", "epic", "chore"]).optional().describe("Filter by type"),
				limit: z.number().optional().default(50).describe("Max results (default: 50)"),
			},
			{ readOnlyHint: true },
			async ({ repo, status, priority, issue_type, limit }) => {
				try {
					const env = this.env as Env;
					const workosUserId = this.props?.user?.id;

					if (!workosUserId) {
						return {
							content: [{ type: "text", text: "Error: Not authenticated" }],
							isError: true,
						};
					}

					const userRepos = await this.getUserRepos(env, workosUserId);
					const hasAccess = userRepos.some((r: any) => r.fullName === repo);

					if (!hasAccess) {
						return {
							content: [{ type: "text", text: "Access denied: You do not have access to this repository" }],
							isError: true,
						};
					}

					const doId = env.REPO.idFromName(repo);
					const stub = env.REPO.get(doId);

					const params = new URLSearchParams();
					if (status) params.set("status", status);
					if (priority !== undefined) params.set("priority", String(priority));
					if (issue_type) params.set("type", issue_type);
					if (limit) params.set("limit", String(limit));

					const response = await stub.fetch(new Request(`http://do/issues?${params}`));
					const issues = await response.json();

					return {
						content: [{ type: "text", text: JSON.stringify(issues, null, 2) }],
					};
				} catch (error: any) {
					return {
						content: [{ type: "text", text: `Error: ${error.message}` }],
						isError: true,
					};
				}
			},
		);

		// Ready: get issues ready to work on (no blockers)
		this.server.tool(
			"ready",
			`Get issues ready to work on (open, no blocking dependencies).

Returns: Array<{ id, title, priority, issue_type }> sorted by priority

Examples:
  ready({ repo: "owner/repo" })           // all ready issues
  ready({ repo: "owner/repo", limit: 5 }) // top 5 ready`,
			{
				repo: z.string().describe("Repository (owner/name)"),
				limit: z.number().optional().default(20).describe("Max results (default: 20)"),
			},
			{ readOnlyHint: true },
			async ({ repo, limit }) => {
				try {
					const env = this.env as Env;
					const workosUserId = this.props?.user?.id;

					if (!workosUserId) {
						return {
							content: [{ type: "text", text: "Error: Not authenticated" }],
							isError: true,
						};
					}

					const userRepos = await this.getUserRepos(env, workosUserId);
					const hasAccess = userRepos.some((r: any) => r.fullName === repo);

					if (!hasAccess) {
						return {
							content: [{ type: "text", text: "Access denied: You do not have access to this repository" }],
							isError: true,
						};
					}

					const doId = env.REPO.idFromName(repo);
					const stub = env.REPO.get(doId);

					const response = await stub.fetch(new Request(`http://do/issues/ready?limit=${limit}`));
					const issues = await response.json();

					return {
						content: [{ type: "text", text: JSON.stringify(issues, null, 2) }],
					};
				} catch (error: any) {
					return {
						content: [{ type: "text", text: `Error: ${error.message}` }],
						isError: true,
					};
				}
			},
		);

		// Blocked: get issues that are blocked by dependencies
		this.server.tool(
			"blocked",
			`Get issues that are blocked by unfinished dependencies.

Returns: Array<{ id, title, blocked_by: string[] }> showing what's blocking each issue

Example:
  blocked({ repo: "owner/repo" })`,
			{
				repo: z.string().describe("Repository (owner/name)"),
			},
			{ readOnlyHint: true },
			async ({ repo }) => {
				try {
					const env = this.env as Env;
					const workosUserId = this.props?.user?.id;

					if (!workosUserId) {
						return {
							content: [{ type: "text", text: "Error: Not authenticated" }],
							isError: true,
						};
					}

					const userRepos = await this.getUserRepos(env, workosUserId);
					const hasAccess = userRepos.some((r: any) => r.fullName === repo);

					if (!hasAccess) {
						return {
							content: [{ type: "text", text: "Access denied: You do not have access to this repository" }],
							isError: true,
						};
					}

					const doId = env.REPO.idFromName(repo);
					const stub = env.REPO.get(doId);

					const response = await stub.fetch(new Request("http://do/issues/blocked"));
					const issues = await response.json();

					return {
						content: [{ type: "text", text: JSON.stringify(issues, null, 2) }],
					};
				} catch (error: any) {
					return {
						content: [{ type: "text", text: `Error: ${error.message}` }],
						isError: true,
					};
				}
			},
		);

		// Fetch: get details of a specific issue
		this.server.tool(
			"fetch",
			`Get full details of a specific issue.

Returns: { id, title, description, status, priority, issue_type, labels[], assignee, created_at, updated_at, github_number? }

Examples:
  fetch({ repo: "owner/repo", issue: "42" })      // by GitHub number
  fetch({ repo: "owner/repo", issue: "abc123" })  // by local ID`,
			{
				repo: z.string().describe("Repository (owner/name)"),
				issue: z.string().describe("Issue number or local ID"),
			},
			{ readOnlyHint: true },
			async ({ repo, issue }) => {
				try {
					const env = this.env as Env;
					const workosUserId = this.props?.user?.id;

					if (!workosUserId) {
						return {
							content: [{ type: "text", text: "Error: Not authenticated" }],
							isError: true,
						};
					}

					// Verify access using the helper
					const userRepos = await this.getUserRepos(env, workosUserId);
					const hasAccess = userRepos.some((r: any) => r.fullName === repo);

					if (!hasAccess) {
						return {
							content: [{ type: "text", text: "Access denied: You do not have access to this repository" }],
							isError: true,
						};
					}

					const doId = env.REPO.idFromName(repo);
					const stub = env.REPO.get(doId);

					const response = await stub.fetch(new Request(`http://do/issues/${issue}`));
					if (!response.ok) {
						return {
							content: [{ type: "text", text: `Issue not found: ${issue}` }],
							isError: true,
						};
					}

					const issueData = await response.json();
					return {
						content: [{ type: "text", text: JSON.stringify(issueData, null, 2) }],
					};
				} catch (error: any) {
					return {
						content: [{ type: "text", text: `Error: ${error.message}` }],
						isError: true,
					};
				}
			},
		);

		// Roadmap: get current roadmap state
		this.server.tool(
			"roadmap",
			`Get roadmap with issues grouped by priority and status. No parameters needed.

Returns: Markdown with progress stats, issues grouped by priority (P0-P4), showing blocked/ready status.

Example output:
  # Roadmap
  5/12 complete · 3 in progress · 2 blocked

  ## P0 - Critical
  - [x] Fix auth bug
  - [ ] 🚧 API rate limiting (in progress)

  ## P1 - High
  - [ ] ⛔ Dashboard charts (blocked)
  - [ ] Add user settings

  ## P2 - Medium
  - [ ] Improve docs`,
			{},
			{ readOnlyHint: true },
			async () => {
				try {
					const env = this.env as Env;
					const workosUserId = this.props?.user?.id;

					if (!workosUserId) {
						return {
							content: [{ type: "text", text: "Error: Not authenticated" }],
							isError: true,
						};
					}

					const repos = await this.getUserRepos(env, workosUserId);

					// Fetch issues from all repos
					const repoDataPromises = repos.map(async (repo) => {
						const doId = env.REPO.idFromName(repo.fullName);
						const stub = env.REPO.get(doId);
						const issuesRes = await stub.fetch(new Request("http://do/issues"));
						const issues = await issuesRes.json() as any[];
						return issues.map(i => ({ ...i, repo: repo.fullName }));
					});

					const repoDataResults = await Promise.all(repoDataPromises);
					const allIssues: any[] = repoDataResults.flat();

					const closed = allIssues.filter(i => i.status === "closed").length;
					const inProgress = allIssues.filter(i => i.status === "in_progress").length;
					const blocked = allIssues.filter(i => i.status === "blocked").length;

					const lines = [
						"# Roadmap",
						"",
						`${closed}/${allIssues.length} complete · ${inProgress} in progress · ${blocked} blocked`,
						"",
					];

					// Group by priority (0-4)
					const priorityLabels: Record<number, string> = {
						0: "P0 - Critical",
						1: "P1 - High",
						2: "P2 - Medium",
						3: "P3 - Low",
						4: "P4 - Backlog",
					};

					for (let p = 0; p <= 4; p++) {
						const pIssues = allIssues.filter(i => (i.priority ?? 2) === p);
						if (pIssues.length === 0) continue;

						lines.push(`## ${priorityLabels[p]}`);
						lines.push("");

						for (const i of pIssues) {
							const check = i.status === "closed" ? "x" : " ";
							let prefix = "";
							if (i.status === "in_progress") prefix = "🚧 ";
							else if (i.status === "blocked") prefix = "⛔ ";

							const suffix = i.status !== "closed" && i.status !== "open" ? ` (${i.status.replace("_", " ")})` : "";
							lines.push(`- [${check}] ${prefix}${i.title}${suffix}`);
						}
						lines.push("");
					}

					return {
						content: [{ type: "text", text: lines.join("\n") }],
					};
				} catch (error: any) {
					return {
						content: [{ type: "text", text: `Error: ${error.message}` }],
						isError: true,
					};
				}
			},
		);

		// Do: execute dynamic code with full API access
		this.server.tool(
			"do",
			`Execute JavaScript in a sandboxed environment with full API access.

Available APIs:

issues.get(id)                    → Issue | null
issues.list({ status?, limit? })  → Issue[]
issues.update(id, { status?, title?, description?, priority? })
issues.close(id, reason?)
issues.ready()                    → Issue[] (unblocked, open issues)
issues.blocked()                  → Issue[] (issues waiting on dependencies)

deps.add(issueId, dependsOnId)    → Add dependency
deps.remove(issueId, dependsOnId) → Remove dependency
deps.list(issueId)                → Get dependencies for an issue

github.createComment(num, body)   → creates comment on issue #num
github.updateIssue(num, { title?, body?, state?, labels?, assignees? })
github.addLabels(num, labels[])   → adds labels to issue #num
github.createLabel(name, color, description?)

todo.render()                     → markdown string of open issues
log(level, msg)                   → level: 'info' | 'warn' | 'error'

Examples:
  // List open issues
  const open = await issues.list({ status: 'open' })
  return open.map(i => i.title)

  // Get ready-to-work issues
  const ready = await issues.ready()
  return ready.slice(0, 5)

  // Close issue and comment
  await issues.close('abc123', 'Fixed in PR #45')
  await github.createComment(42, 'Closing as resolved')

  // Bulk label
  const bugs = await issues.list({ status: 'open' })
  for (const bug of bugs.filter(i => i.title.includes('bug'))) {
    await github.addLabels(bug.github_number, ['bug'])
  }`,
			{
				repo: z.string().describe("Repository (owner/name)"),
				code: z.string().describe("JavaScript code (async, use return for output)"),
			},
			{ destructiveHint: true },
			async ({ repo, code }) => {
				try {
					const env = this.env as Env;
					const workosUserId = this.props?.user?.id;

					if (!workosUserId) {
						return {
							content: [{ type: "text", text: "Error: Not authenticated" }],
							isError: true,
						};
					}

					// Verify access and get repo details
					const userRepos = await this.getUserRepos(env, workosUserId);
					const repoDoc = userRepos.find((r: any) => r.fullName === repo);

					if (!repoDoc) {
						return {
							content: [{ type: "text", text: "Access denied: You do not have access to this repository" }],
							isError: true,
						};
					}

					// Get installation ID - need to fetch the installation relationship
					const installationResult = await env.PAYLOAD.findByID({
						collection: "installations",
						id: repoDoc.installation,
					});

					const installationId = (installationResult as any)?.installationId;

					if (!installationId) {
						return {
							content: [{ type: "text", text: "No GitHub installation found for this repository" }],
							isError: true,
						};
					}

					// Wrap the user's code in a module that exports a run function
					const wrappedCode = `
import { issues, milestones, github, todo, log } from 'sandbox-client.js';

export async function run() {
  ${code}
}
`;

					// Create execution context for sandbox
					const ctx = {
						waitUntil: (promise: Promise<any>) => { /* DO handles this internally */ },
						passThroughOnException: () => { /* no-op for DO */ },
					} as ExecutionContext;

					// Execute in sandbox
					const sandboxResult = await executeSandboxedWorkflow(
						env,
						ctx,
						{
							id: `mcp-do-${Date.now()}`,
							repoFullName: repo,
							installationId,
							code: wrappedCode,
							entrypoint: "run",
							args: [],
						}
					);

					return {
						content: [{ type: "text", text: JSON.stringify(sandboxResult, null, 2) }],
					};
				} catch (error: any) {
					return {
						content: [{ type: "text", text: `Error: ${error.message}` }],
						isError: true,
					};
				}
			},
		);
	}
}

export const mcp = new OAuthProvider({
	apiRoute: "/mcp",
	apiHandler: TodoMCP.mount("/mcp") as any,
	defaultHandler: AuthkitHandler as any,
	authorizeEndpoint: "/authorize",
	tokenEndpoint: "/token",
	clientRegistrationEndpoint: "/register",
});
