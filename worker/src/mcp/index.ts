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

export class TodoMCP extends McpAgent<Env, unknown, Props> {
	server = new McpServer({
		name: "todo.mdx",
		version: "0.1.0",
	});

	async init() {
		// Basic test tool
		this.server.tool(
			"add",
			"Add two numbers",
			{ a: z.number(), b: z.number() },
			async ({ a, b }) => ({
				content: [{ type: "text", text: String(a + b) }],
			}),
		);

		// List todos from a repository
		this.server.tool(
			"list_todos",
			"List todos from a repository",
			{
				repo: z.string().describe("Repository in owner/name format"),
				status: z.enum(["open", "closed", "all"]).optional().describe("Filter by status"),
			},
			async ({ repo, status }) => {
				try {
					const env = this.env as Env;
					const userId = this.props?.user?.id;

					// Verify access via Payload RPC
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

					const response = await stub.fetch(new Request("http://do/issues"));
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

		// Create a new todo
		this.server.tool(
			"create_todo",
			"Create a new todo in a repository",
			{
				repo: z.string().describe("Repository in owner/name format"),
				title: z.string().describe("Todo title"),
				body: z.string().optional().describe("Todo body/description"),
				labels: z.array(z.string()).optional().describe("Labels to apply"),
			},
			async ({ repo, title, body, labels }) => {
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
							content: [{ type: "text", text: "Access denied" }],
							isError: true,
						};
					}

					const doId = env.REPO.idFromName(repo);
					const stub = env.REPO.get(doId);

					await stub.fetch(new Request("http://do/issues/sync", {
						method: "POST",
						body: JSON.stringify({
							source: "mcp",
							issues: [{
								title,
								body: body || "",
								state: "open",
								labels: labels || [],
							}],
						}),
						headers: { "Content-Type": "application/json" },
					}));

					return {
						content: [{ type: "text", text: `Created todo: ${title}` }],
					};
				} catch (error: any) {
					return {
						content: [{ type: "text", text: `Error: ${error.message}` }],
						isError: true,
					};
				}
			},
		);

		// List milestones
		this.server.tool(
			"list_milestones",
			"List milestones from a repository",
			{
				repo: z.string().describe("Repository in owner/name format"),
			},
			async ({ repo }) => {
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
							content: [{ type: "text", text: "Access denied" }],
							isError: true,
						};
					}

					const doId = env.REPO.idFromName(repo);
					const stub = env.REPO.get(doId);

					const response = await stub.fetch(new Request("http://do/milestones"));
					const milestones = await response.json();

					return {
						content: [{ type: "text", text: JSON.stringify(milestones, null, 2) }],
					};
				} catch (error: any) {
					return {
						content: [{ type: "text", text: `Error: ${error.message}` }],
						isError: true,
					};
				}
			},
		);

		// Semantic search across all repos using Vectorize
		this.server.tool(
			"search",
			"Semantic search across all your issues and milestones",
			{
				query: z.string().describe("Natural language search query"),
				limit: z.number().optional().default(10).describe("Maximum results to return"),
				type: z.enum(["issue", "milestone", "all"]).optional().default("all").describe("Filter by type"),
			},
			async ({ query, limit, type }) => {
				try {
					const env = this.env as Env;

					// Generate query embedding via Workers AI
					const embeddingResult = await env.AI.run("@cf/baai/bge-m3", {
						text: [query],
					}) as { data: number[][] };

					const queryEmbedding = embeddingResult.data[0];

					// Query Vectorize for semantic matches
					const vectorResults = await env.VECTORIZE.query(queryEmbedding, {
						topK: limit,
						filter: type !== "all" ? { type } : undefined,
						returnMetadata: "all",
					});

					// Format results
					const results = vectorResults.matches.map((match) => ({
						id: match.id,
						title: match.metadata?.title as string | undefined,
						type: match.metadata?.type as string | undefined,
						repo: match.metadata?.repo as string | undefined,
						status: match.metadata?.status as string | undefined,
						url: match.metadata?.url as string | undefined,
						score: match.score,
					}));

					return {
						content: [{
							type: "text",
							text: JSON.stringify(results, null, 2),
						}],
					};
				} catch (error: any) {
					return {
						content: [{ type: "text", text: `Search error: ${error.message}` }],
						isError: true,
					};
				}
			},
		);

		// Roadmap - get current roadmap state
		this.server.tool(
			"roadmap",
			"Get current roadmap state: all milestones, issues, and progress",
			{},
			async () => {
				try {
					const env = this.env as Env;
					const userId = this.props?.user?.id;

					const reposResult = await env.PAYLOAD.find({
						collection: "repos",
						where: {
							"installation.users.workosUserId": { equals: userId },
						},
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

					// Render roadmap
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
