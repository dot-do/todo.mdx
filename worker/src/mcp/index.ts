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
import { getPayloadClient } from "../payload";

/** MCP tool result type */
type ToolResult = {
	content: Array<{ type: "text"; text: string }>;
	isError?: boolean;
};

/** Context passed to tool handlers after auth verification */
type RepoContext = {
	env: Env;
	repo: string;
	repoDoc: any;
	userRepos: any[];
};

/** Extended context with installation info (for write operations) */
type RepoContextWithInstallation = RepoContext & {
	installationId: number;
	stub: DurableObjectStub;
};

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
		const payload = await getPayloadClient(env);

		// Step 1: Find the Payload user by WorkOS ID
		const userResult = await payload.find({
			collection: "users",
			where: { workosUserId: { equals: workosUserId } },
			limit: 1,
			overrideAccess: true,
		});

		if (!userResult.docs?.length) {
			return [];
		}

		const payloadUserId = userResult.docs[0].id;

		// Step 2: Find installations the user has access to
		const installationsResult = await payload.find({
			collection: "installations",
			where: { 'users.id': { equals: payloadUserId } },
			limit: 100,
			overrideAccess: true,
		});

		if (!installationsResult.docs?.length) {
			return [];
		}

		const installationIds = installationsResult.docs.map((i: any) => i.id);

		// Step 3: Find repos for those installations
		const reposResult = await payload.find({
			collection: "repos",
			where: { installation: { in: installationIds } },
			limit: 100,
			overrideAccess: true,
		});

		return reposResult.docs || [];
	}

	/**
	 * Higher-order function that wraps tool handlers with authentication and repo access verification.
	 * Reduces boilerplate for the common pattern: auth check -> getUserRepos -> hasAccess check.
	 *
	 * @param handler - The actual tool logic to execute after access is verified
	 * @returns A wrapped handler that performs auth/access checks first
	 */
	private withRepoAccess<TArgs extends { repo: string }>(
		handler: (args: TArgs, ctx: RepoContext) => Promise<ToolResult>
	): (args: TArgs) => Promise<ToolResult> {
		return async (args: TArgs): Promise<ToolResult> => {
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
				const repoDoc = userRepos.find((r: any) => r.fullName === args.repo);

				if (!repoDoc) {
					return {
						content: [{ type: "text", text: "Access denied: You do not have access to this repository" }],
						isError: true,
					};
				}

				return await handler(args, { env, repo: args.repo, repoDoc, userRepos });
			} catch (error: any) {
				return {
					content: [{ type: "text", text: `Error: ${error.message}` }],
					isError: true,
				};
			}
		};
	}

	/**
	 * Higher-order function for write operations that need installation context and DO stub.
	 * Extends withRepoAccess to also set up the RepoDO context with installation info.
	 *
	 * @param handler - The actual tool logic to execute after context is set up
	 * @returns A wrapped handler that performs auth/access checks and sets up installation context
	 */
	private withRepoAccessAndInstallation<TArgs extends { repo: string }>(
		handler: (args: TArgs, ctx: RepoContextWithInstallation) => Promise<ToolResult>
	): (args: TArgs) => Promise<ToolResult> {
		return this.withRepoAccess(async (args: TArgs, ctx: RepoContext): Promise<ToolResult> => {
			const { env, repo, repoDoc, userRepos } = ctx;

			// Get installation ID
			const payload = await getPayloadClient(env);
			const installationResult = await payload.findByID({
				collection: "installations",
				id: repoDoc.installation,
				overrideAccess: true,
			});
			const installationId = (installationResult as any)?.installationId;

			if (!installationId) {
				return {
					content: [{ type: "text", text: "No GitHub installation found for this repository" }],
					isError: true,
				};
			}

			// Get DO stub and set context
			const doId = env.REPO.idFromName(repo);
			const stub = env.REPO.get(doId);

			await stub.fetch(new Request("http://do/context", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ repoFullName: repo, installationId }),
			}));

			return await handler(args, { env, repo, repoDoc, userRepos, installationId, stub });
		});
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
			this.withRepoAccess(async ({ repo, status, priority, issue_type, limit }, { env }) => {
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
			}),
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
			this.withRepoAccess(async ({ repo, limit }, { env }) => {
				const doId = env.REPO.idFromName(repo);
				const stub = env.REPO.get(doId);

				const response = await stub.fetch(new Request(`http://do/issues/ready?limit=${limit}`));
				const issues = await response.json();

				return {
					content: [{ type: "text", text: JSON.stringify(issues, null, 2) }],
				};
			}),
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
			this.withRepoAccess(async ({ repo }, { env }) => {
				const doId = env.REPO.idFromName(repo);
				const stub = env.REPO.get(doId);

				const response = await stub.fetch(new Request("http://do/issues/blocked"));
				const issues = await response.json();

				return {
					content: [{ type: "text", text: JSON.stringify(issues, null, 2) }],
				};
			}),
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
			this.withRepoAccess(async ({ repo, issue }, { env }) => {
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
			}),
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

		// Create issue
		this.server.tool(
			"create_issue",
			`Create a new issue in a repository.

Returns: { id, title, status, priority, issue_type, ... }

Examples:
  create_issue({ repo: "owner/repo", title: "Fix login bug" })
  create_issue({ repo: "owner/repo", title: "Add dark mode", issue_type: "feature", priority: 1 })`,
			{
				repo: z.string().describe("Repository (owner/name)"),
				title: z.string().describe("Issue title"),
				description: z.string().optional().describe("Issue description/body"),
				issue_type: z.enum(["bug", "feature", "task", "epic", "chore"]).optional().default("task").describe("Issue type"),
				priority: z.number().min(0).max(4).optional().default(2).describe("Priority (0=critical, 4=backlog)"),
				assignee: z.string().optional().describe("GitHub username to assign"),
				labels: z.array(z.string()).optional().describe("Labels to apply"),
			},
			{ destructiveHint: true },
			this.withRepoAccessAndInstallation(async ({ title, description, issue_type, priority, assignee, labels }, { stub }) => {
				const response = await stub.fetch(new Request("http://do/issues", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ title, description, issue_type, priority, assignee, labels }),
				}));

				const issue = await response.json();
				return {
					content: [{ type: "text", text: JSON.stringify(issue, null, 2) }],
				};
			}),
		);

		// Update issue
		this.server.tool(
			"update_issue",
			`Update an existing issue.

Examples:
  update_issue({ repo: "owner/repo", issue: "abc123", status: "in_progress" })
  update_issue({ repo: "owner/repo", issue: "42", priority: 0, assignee: "octocat" })`,
			{
				repo: z.string().describe("Repository (owner/name)"),
				issue: z.string().describe("Issue ID or GitHub number"),
				title: z.string().optional().describe("New title"),
				description: z.string().optional().describe("New description"),
				status: z.enum(["open", "in_progress", "blocked", "closed"]).optional().describe("New status"),
				priority: z.number().min(0).max(4).optional().describe("New priority"),
				assignee: z.string().optional().describe("New assignee (empty string to unassign)"),
				labels: z.array(z.string()).optional().describe("Replace all labels"),
			},
			{ destructiveHint: true },
			this.withRepoAccessAndInstallation(async ({ issue, title, description, status, priority, assignee, labels }, { stub }) => {
				const response = await stub.fetch(new Request(`http://do/issues/${issue}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ title, description, status, priority, assignee, labels }),
				}));

				if (!response.ok) {
					return {
						content: [{ type: "text", text: `Issue not found: ${issue}` }],
						isError: true,
					};
				}

				const updated = await response.json();
				return {
					content: [{ type: "text", text: JSON.stringify(updated, null, 2) }],
				};
			}),
		);

		// Close issue
		this.server.tool(
			"close_issue",
			`Close an issue as completed.

Examples:
  close_issue({ repo: "owner/repo", issue: "abc123" })
  close_issue({ repo: "owner/repo", issue: "42", reason: "Fixed in PR #99" })`,
			{
				repo: z.string().describe("Repository (owner/name)"),
				issue: z.string().describe("Issue ID or GitHub number"),
				reason: z.string().optional().describe("Reason for closing"),
			},
			{ destructiveHint: true },
			this.withRepoAccessAndInstallation(async ({ issue, reason }, { stub }) => {
				const response = await stub.fetch(new Request(`http://do/issues/${issue}/close`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ reason }),
				}));

				if (!response.ok) {
					return {
						content: [{ type: "text", text: `Issue not found: ${issue}` }],
						isError: true,
					};
				}

				return {
					content: [{ type: "text", text: `Issue ${issue} closed successfully` }],
				};
			}),
		);

		// Add dependency
		this.server.tool(
			"add_dependency",
			`Add a blocking dependency between issues. The first issue depends on (is blocked by) the second.

Example:
  add_dependency({ repo: "owner/repo", issue: "abc123", depends_on: "xyz789" })
  // abc123 is now blocked by xyz789`,
			{
				repo: z.string().describe("Repository (owner/name)"),
				issue: z.string().describe("Issue that depends on another"),
				depends_on: z.string().describe("Issue that blocks the first"),
				type: z.enum(["blocks", "related", "parent-child"]).optional().default("blocks").describe("Dependency type"),
			},
			{ destructiveHint: true },
			this.withRepoAccess(async ({ repo, issue, depends_on, type }, { env }) => {
				const doId = env.REPO.idFromName(repo);
				const stub = env.REPO.get(doId);

				await stub.fetch(new Request("http://do/dependencies", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ issue_id: issue, depends_on_id: depends_on, type }),
				}));

				return {
					content: [{ type: "text", text: `Dependency added: ${issue} depends on ${depends_on}` }],
				};
			}),
		);

		// Remove dependency
		this.server.tool(
			"remove_dependency",
			`Remove a dependency between issues.

Example:
  remove_dependency({ repo: "owner/repo", issue: "abc123", depends_on: "xyz789" })`,
			{
				repo: z.string().describe("Repository (owner/name)"),
				issue: z.string().describe("Issue that has the dependency"),
				depends_on: z.string().describe("Issue to remove from dependencies"),
			},
			{ destructiveHint: true },
			this.withRepoAccess(async ({ repo, issue, depends_on }, { env }) => {
				const doId = env.REPO.idFromName(repo);
				const stub = env.REPO.get(doId);

				await stub.fetch(new Request("http://do/dependencies", {
					method: "DELETE",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ issue_id: issue, depends_on_id: depends_on }),
				}));

				return {
					content: [{ type: "text", text: `Dependency removed: ${issue} no longer depends on ${depends_on}` }],
				};
			}),
		);

		// Create branch
		this.server.tool(
			"create_branch",
			`Create a new Git branch in a repository.

Returns: { ref, sha, url }

Examples:
  create_branch({ repo: "owner/repo", branch: "feature/my-feature" })
  create_branch({ repo: "owner/repo", branch: "fix/bug-123", base_sha: "abc1234" })`,
			{
				repo: z.string().describe("Repository (owner/name)"),
				branch: z.string().describe("Branch name to create"),
				base_sha: z.string().optional().describe("Base commit SHA (defaults to default branch HEAD)"),
			},
			{ destructiveHint: true },
			async ({ repo, branch, base_sha }) => {
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
					const repoDoc = userRepos.find((r: any) => r.fullName === repo);

					if (!repoDoc) {
						return {
							content: [{ type: "text", text: "Access denied: You do not have access to this repository" }],
							isError: true,
						};
					}

					// Get installation ID
					const payload = await getPayloadClient(env);
					const installationResult = await payload.findByID({
						collection: "installations",
						id: repoDoc.installation,
						overrideAccess: true,
					});
					const installationId = (installationResult as any)?.installationId;

					if (!installationId) {
						return {
							content: [{ type: "text", text: "No GitHub installation found for this repository" }],
							isError: true,
						};
					}

					// Import Octokit and create authenticated instance
					const { Octokit } = await import("@octokit/rest");
					const { createAppAuth } = await import("@octokit/auth-app");

					const auth = createAppAuth({
						appId: env.GITHUB_APP_ID,
						privateKey: env.GITHUB_PRIVATE_KEY,
						installationId,
					});

					const { token } = await auth({ type: "installation" });
					const octokit = new Octokit({ auth: token });

					const [owner, repoName] = repo.split("/");

					let sha = base_sha;

					// If no sha provided, get default branch HEAD
					if (!sha) {
						const { data: repoData } = await octokit.repos.get({ owner, repo: repoName });
						const defaultBranch = repoData.default_branch;
						const { data: branchData } = await octokit.repos.getBranch({
							owner,
							repo: repoName,
							branch: defaultBranch,
						});
						sha = branchData.commit.sha;
					}

					// Create the ref
					const { data } = await octokit.git.createRef({
						owner,
						repo: repoName,
						ref: `refs/heads/${branch}`,
						sha,
					});

					return {
						content: [{ type: "text", text: JSON.stringify({
							ref: data.ref,
							sha: data.object.sha,
							url: data.url,
						}, null, 2) }],
					};
				} catch (error: any) {
					return {
						content: [{ type: "text", text: `Error: ${error.message}` }],
						isError: true,
					};
				}
			},
		);

		// Create pull request
		this.server.tool(
			"create_pull_request",
			`Create a new pull request in a repository.

Returns: { number, url, state, title }

Examples:
  create_pull_request({ repo: "owner/repo", title: "Add feature", head: "feature/my-feature", base: "main" })
  create_pull_request({ repo: "owner/repo", title: "Fix bug", head: "fix/bug-123", base: "main", body: "This PR fixes issue #123" })`,
			{
				repo: z.string().describe("Repository (owner/name)"),
				title: z.string().describe("Pull request title"),
				head: z.string().describe("Branch to merge from"),
				base: z.string().describe("Branch to merge into"),
				body: z.string().optional().describe("Pull request description"),
			},
			{ destructiveHint: true },
			async ({ repo, title, head, base, body }) => {
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
					const repoDoc = userRepos.find((r: any) => r.fullName === repo);

					if (!repoDoc) {
						return {
							content: [{ type: "text", text: "Access denied: You do not have access to this repository" }],
							isError: true,
						};
					}

					// Get installation ID
					const payload = await getPayloadClient(env);
					const installationResult = await payload.findByID({
						collection: "installations",
						id: repoDoc.installation,
						overrideAccess: true,
					});
					const installationId = (installationResult as any)?.installationId;

					if (!installationId) {
						return {
							content: [{ type: "text", text: "No GitHub installation found for this repository" }],
							isError: true,
						};
					}

					// Import Octokit and create authenticated instance
					const { Octokit } = await import("@octokit/rest");
					const { createAppAuth } = await import("@octokit/auth-app");

					const auth = createAppAuth({
						appId: env.GITHUB_APP_ID,
						privateKey: env.GITHUB_PRIVATE_KEY,
						installationId,
					});

					const { token } = await auth({ type: "installation" });
					const octokit = new Octokit({ auth: token });

					const [owner, repoName] = repo.split("/");

					const { data } = await octokit.pulls.create({
						owner,
						repo: repoName,
						title,
						head,
						base,
						body,
					});

					return {
						content: [{ type: "text", text: JSON.stringify({
							number: data.number,
							url: data.html_url,
							state: data.state,
							title: data.title,
						}, null, 2) }],
					};
				} catch (error: any) {
					return {
						content: [{ type: "text", text: `Error: ${error.message}` }],
						isError: true,
					};
				}
			},
		);

		// Merge pull request
		this.server.tool(
			"merge_pull_request",
			`Merge a pull request in a repository.

Returns: { merged, sha, message }

Examples:
  merge_pull_request({ repo: "owner/repo", pull_number: 42 })
  merge_pull_request({ repo: "owner/repo", pull_number: 42, merge_method: "squash" })
  merge_pull_request({ repo: "owner/repo", pull_number: 42, merge_method: "rebase", commit_title: "feat: Add feature (#42)" })`,
			{
				repo: z.string().describe("Repository (owner/name)"),
				pull_number: z.number().describe("Pull request number"),
				merge_method: z.enum(["merge", "squash", "rebase"]).optional().describe("Merge method (default: merge)"),
				commit_title: z.string().optional().describe("Custom commit title (for squash/merge)"),
				commit_message: z.string().optional().describe("Custom commit message (for squash/merge)"),
			},
			{ destructiveHint: true },
			async ({ repo, pull_number, merge_method, commit_title, commit_message }) => {
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
					const repoDoc = userRepos.find((r: any) => r.fullName === repo);

					if (!repoDoc) {
						return {
							content: [{ type: "text", text: "Access denied: You do not have access to this repository" }],
							isError: true,
						};
					}

					// Get installation ID
					const payload = await getPayloadClient(env);
					const installationResult = await payload.findByID({
						collection: "installations",
						id: repoDoc.installation,
						overrideAccess: true,
					});
					const installationId = (installationResult as any)?.installationId;

					if (!installationId) {
						return {
							content: [{ type: "text", text: "No GitHub installation found for this repository" }],
							isError: true,
						};
					}

					// Import Octokit and create authenticated instance
					const { Octokit } = await import("@octokit/rest");
					const { createAppAuth } = await import("@octokit/auth-app");

					const auth = createAppAuth({
						appId: env.GITHUB_APP_ID,
						privateKey: env.GITHUB_PRIVATE_KEY,
						installationId,
					});

					const { token } = await auth({ type: "installation" });
					const octokit = new Octokit({ auth: token });

					const [owner, repoName] = repo.split("/");

					const { data } = await octokit.pulls.merge({
						owner,
						repo: repoName,
						pull_number,
						merge_method,
						commit_title,
						commit_message,
					});

					return {
						content: [{ type: "text", text: JSON.stringify({
							merged: data.merged,
							sha: data.sha,
							message: data.message,
						}, null, 2) }],
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
					const payload = await getPayloadClient(env);
					const installationResult = await payload.findByID({
						collection: "installations",
						id: repoDoc.installation,
						overrideAccess: true,
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
