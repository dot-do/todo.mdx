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

	async init() {
		// Search: hybrid keyword + vector search across all issues
		this.server.tool(
			"search",
			"Search across all your issues and projects using keyword and semantic search",
			{
				query: z.string().describe("Search query"),
				limit: z.number().optional().default(20).describe("Maximum results"),
			},
			async ({ query, limit }) => {
				try {
					const env = this.env as Env;
					const userId = this.props?.user?.id;
					const queryLower = query.toLowerCase();

					const [keywordResults, vectorResults] = await Promise.all([
						// Keyword search
						(async () => {
							const results: Array<{ id: string; title: string; repo: string; state: string }> = [];
							const reposResult = await env.PAYLOAD.find({
								collection: "repos",
								where: { "installation.users.workosUserId": { equals: userId } },
								limit: 100,
							});

							for (const repo of (reposResult.docs || []) as any[]) {
								const doId = env.REPO.idFromName(repo.fullName);
								const stub = env.REPO.get(doId);
								const issuesResponse = await stub.fetch(new Request("http://do/issues"));
								const issues = await issuesResponse.json() as any[];

								for (const issue of issues) {
									if (
										issue.title?.toLowerCase().includes(queryLower) ||
										issue.body?.toLowerCase().includes(queryLower) ||
										issue.labels?.some((l: string) => l.toLowerCase().includes(queryLower))
									) {
										results.push({
											id: issue.githubNumber?.toString() || issue.id,
											title: issue.title,
											repo: repo.fullName,
											state: issue.state,
										});
									}
								}
							}
							return results;
						})(),

						// Vector search
						(async () => {
							const results: Array<{ id: string; title: string; repo: string; state: string; score: number }> = [];
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
										state: match.metadata?.status as string || "unknown",
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
					const results: Array<{ id: string; title: string; repo: string; state: string }> = [];

					for (const r of keywordResults) {
						if (!seenIds.has(r.id) && results.length < limit) {
							seenIds.add(r.id);
							results.push(r);
						}
					}

					for (const r of vectorResults.sort((a, b) => b.score - a.score)) {
						if (!seenIds.has(r.id) && results.length < limit) {
							seenIds.add(r.id);
							results.push({ id: r.id, title: r.title, repo: r.repo, state: r.state });
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

		// Fetch: get details of a specific issue
		this.server.tool(
			"fetch",
			"Fetch details of a specific issue by number or ID",
			{
				repo: z.string().describe("Repository in owner/name format"),
				issue: z.string().describe("Issue number or ID"),
			},
			async ({ repo, issue }) => {
				try {
					const env = this.env as Env;
					const userId = this.props?.user?.id;

					const result = await env.PAYLOAD.find({
						collection: "repos",
						where: {
							and: [
								{ fullName: { equals: repo } },
								{ "installation.users.workosUserId": { equals: userId } },
							],
						},
						limit: 1,
					});

					if (!result.docs?.length) {
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
			"Get current roadmap: milestones, issues, and progress across all repositories",
			{},
			async () => {
				try {
					const env = this.env as Env;
					const userId = this.props?.user?.id;

					const reposResult = await env.PAYLOAD.find({
						collection: "repos",
						where: { "installation.users.workosUserId": { equals: userId } },
						limit: 100,
					});

					const allIssues: any[] = [];
					const allMilestones: any[] = [];

					for (const repo of (reposResult.docs || []) as any[]) {
						const doId = env.REPO.idFromName(repo.fullName);
						const stub = env.REPO.get(doId);

						const [issuesRes, milestonesRes] = await Promise.all([
							stub.fetch(new Request("http://do/issues")),
							stub.fetch(new Request("http://do/milestones")),
						]);

						const issues = await issuesRes.json() as any[];
						const milestones = await milestonesRes.json() as any[];

						allIssues.push(...issues.map(i => ({ ...i, repo: repo.fullName })));
						allMilestones.push(...milestones.map(m => ({ ...m, repo: repo.fullName })));
					}

					const closed = allIssues.filter(i => i.state === "closed").length;
					const lines = [
						"# Roadmap",
						"",
						`${closed}/${allIssues.length} complete · ${allMilestones.filter(m => m.state === "open").length} milestones`,
						"",
					];

					for (const m of allMilestones) {
						const mIssues = allIssues.filter(i => i.milestoneId === m.id);
						const mClosed = mIssues.filter(i => i.state === "closed").length;
						const pct = mIssues.length ? Math.round((mClosed / mIssues.length) * 100) : 0;

						lines.push(`## ${m.title} ${m.state === "closed" ? "✓" : `(${pct}%)`}`);
						if (m.dueOn) lines.push(`Due: ${m.dueOn}`);
						lines.push("");
						for (const i of mIssues) lines.push(`- [${i.state === "closed" ? "x" : " "}] ${i.title}`);
						lines.push("");
					}

					const backlog = allIssues.filter(i => !i.milestoneId);
					if (backlog.length) {
						lines.push("## Backlog", "");
						for (const i of backlog) lines.push(`- [${i.state === "closed" ? "x" : " "}] ${i.title}`);
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
			"Execute code with full API access to issues, milestones, GitHub, and more. The code runs in a sandboxed environment with access to: issues.list(), issues.get(id), issues.update(id, data), issues.close(id), milestones.list(), milestones.get(id), github.createComment(num, body), github.updateIssue(num, data), github.addLabels(num, labels), todo.render(), log(level, msg)",
			{
				repo: z.string().describe("Repository in owner/name format"),
				code: z.string().describe("JavaScript code to execute. Has access to: issues, milestones, github, todo, log APIs"),
			},
			async ({ repo, code }) => {
				try {
					const env = this.env as Env;
					const userId = this.props?.user?.id;

					// Verify access
					const result = await env.PAYLOAD.find({
						collection: "repos",
						where: {
							and: [
								{ fullName: { equals: repo } },
								{ "installation.users.workosUserId": { equals: userId } },
							],
						},
						limit: 1,
					});

					if (!result.docs?.length) {
						return {
							content: [{ type: "text", text: "Access denied: You do not have access to this repository" }],
							isError: true,
						};
					}

					const repoDoc = result.docs[0] as any;
					const installationId = repoDoc.installation?.installationId;

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
