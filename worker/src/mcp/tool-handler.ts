/**
 * MCP Tool Handler
 *
 * Handles MCP tool calls for both OAuth and WorkOS JWT authentication paths.
 * This extracts the tool execution logic so it can be reused.
 */

import type { Props } from "./props";
import type { Env } from "../types";
import { executeSandboxedWorkflow } from "../sandbox";
import { createDirectDb } from "../db/direct";

interface ToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

/**
 * Get repos the authenticated user has access to via D1
 */
async function getUserRepos(env: Env, workosUserId: string): Promise<any[]> {
  const db = env.DB;

  // Direct D1 query to get user's repos via users -> installations_rels -> installations -> repos
  const result = await db.prepare(`
    SELECT r.id, r.github_id, r.name, r.full_name as fullName, r.owner, r.private, r.installation_id
    FROM repos r
    INNER JOIN installations i ON r.installation_id = i.id
    INNER JOIN installations_rels ir ON ir.parent_id = i.id AND ir.path = 'users'
    INNER JOIN users u ON ir.users_id = u.id
    WHERE u.workos_user_id = ?
    LIMIT 100
  `).bind(workosUserId).all<any>();

  return result.results || [];
}

/**
 * Handle MCP tool calls
 */
export async function handleMcpToolCall(
  toolName: string,
  args: Record<string, any>,
  props: Props,
  env: Env,
  ctx: ExecutionContext
): Promise<ToolResult> {
  const workosUserId = props.user?.id;

  if (!workosUserId) {
    return {
      content: [{ type: "text", text: "Error: Not authenticated" }],
      isError: true,
    };
  }

  switch (toolName) {
    case "search":
      return handleSearch(args as { query: string; limit?: number }, props, env);

    case "fetch":
      return handleFetch(args as { uri: string }, props, env);

    case "roadmap":
      return handleRoadmap(args as { repo?: string }, props, env);

    case "do":
      return handleDo(args as { repo: string; code: string }, props, env, ctx);

    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${toolName}` }],
        isError: true,
      };
  }
}

/**
 * Search tool handler - uses Vectorize for semantic search
 */
async function handleSearch(
  args: { query: string; limit?: number },
  props: Props,
  env: Env
): Promise<ToolResult> {
  try {
    const { query, limit = 20 } = args;

    // Generate embedding for the query using Cloudflare AI
    const embeddingResult = await env.AI.run('@cf/baai/bge-m3', {
      text: [query],
    }) as { data: number[][] };

    const queryEmbedding = embeddingResult.data[0];

    // Query Vectorize for semantically similar items
    const vectorResult = await env.VECTORIZE.query(queryEmbedding, {
      topK: Math.min(limit, 50),
      returnMetadata: 'all',
    });

    // Format results from vectorize matches
    const results = vectorResult.matches.map((match) => ({
      id: match.id,
      title: match.metadata?.title as string | undefined,
      repo: match.metadata?.repo as string | undefined,
      status: match.metadata?.status as string | undefined,
      url: match.metadata?.url as string | undefined,
      score: match.score,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(results) }],
    };
  } catch (e: any) {
    return {
      content: [{ type: "text", text: `Search error: ${e.message}` }],
      isError: true,
    };
  }
}

/**
 * Fetch tool handler
 */
async function handleFetch(
  args: { uri: string },
  props: Props,
  env: Env
): Promise<ToolResult> {
  try {
    const { uri } = args;

    // Parse URI like todo://owner/repo/issues
    const match = uri.match(/^todo:\/\/([^/]+\/[^/]+)\/(issues|milestones)$/);
    if (!match) {
      return {
        content: [{ type: "text", text: `Invalid URI format: ${uri}` }],
        isError: true,
      };
    }

    const [, repoFullName, resource] = match;
    const workosUserId = props.user?.id!;

    // Verify access
    const repos = await getUserRepos(env, workosUserId);
    const hasAccess = repos.some((r) => r.fullName === repoFullName);

    if (!hasAccess) {
      return {
        content: [{ type: "text", text: `Access denied: ${repoFullName}` }],
        isError: true,
      };
    }

    const doId = env.REPO.idFromName(repoFullName);
    const stub = env.REPO.get(doId);

    const response = await stub.fetch(
      new Request(`http://do/${resource}`, { method: "GET" })
    );

    if (!response.ok) {
      return {
        content: [{ type: "text", text: `Failed to fetch ${resource}` }],
        isError: true,
      };
    }

    const data = await response.json();
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
    };
  } catch (e: any) {
    return {
      content: [{ type: "text", text: `Fetch error: ${e.message}` }],
      isError: true,
    };
  }
}

/**
 * Roadmap tool handler
 */
async function handleRoadmap(
  args: { repo?: string },
  props: Props,
  env: Env
): Promise<ToolResult> {
  try {
    const workosUserId = props.user?.id!;
    const repos = await getUserRepos(env, workosUserId);

    // If repo specified, filter to just that one
    const targetRepos = args.repo
      ? repos.filter((r) => r.fullName === args.repo)
      : repos;

    if (targetRepos.length === 0) {
      return {
        content: [{ type: "text", text: "# Roadmap\n\nNo repositories found." }],
      };
    }

    const lines: string[] = ["# Roadmap", ""];

    for (const repo of targetRepos) {
      const doId = env.REPO.idFromName(repo.fullName);
      const stub = env.REPO.get(doId);

      try {
        const [issuesRes, milestonesRes] = await Promise.all([
          stub.fetch(new Request("http://do/issues")),
          stub.fetch(new Request("http://do/milestones")),
        ]);

        const issues = issuesRes.ok ? ((await issuesRes.json()) as any[]) : [];
        const milestones = milestonesRes.ok
          ? ((await milestonesRes.json()) as any[])
          : [];

        lines.push(`## ${repo.fullName}`);
        lines.push("");

        if (milestones.length > 0) {
          for (const ms of milestones) {
            const msIssues = issues.filter(
              (i) => i.milestoneId === ms.id || i.milestone === ms.id
            );
            const openCount = msIssues.filter((i) => i.status !== "closed").length;
            const closedCount = msIssues.filter((i) => i.status === "closed").length;

            lines.push(`### ${ms.title}`);
            if (ms.description) lines.push(ms.description);
            lines.push(`Progress: ${closedCount}/${openCount + closedCount} issues`);
            lines.push("");
          }
        }

        // Issues without milestones
        const unassigned = issues.filter((i) => !i.milestoneId && !i.milestone);
        if (unassigned.length > 0) {
          lines.push("### Backlog");
          for (const i of unassigned.slice(0, 10)) {
            const check = i.status === "closed" ? "x" : " ";
            lines.push(`- [${check}] ${i.title}`);
          }
          lines.push("");
        }
      } catch (e) {
        console.error(`Roadmap failed for ${repo.fullName}:`, e);
      }
    }

    return {
      content: [{ type: "text", text: lines.join("\n") }],
    };
  } catch (e: any) {
    return {
      content: [{ type: "text", text: `Roadmap error: ${e.message}` }],
      isError: true,
    };
  }
}

/**
 * Do (execute code) tool handler
 */
async function handleDo(
  args: { repo: string; code: string },
  props: Props,
  env: Env,
  ctx: ExecutionContext
): Promise<ToolResult> {
  try {
    const { repo, code } = args;

    if (!repo) {
      return {
        content: [{ type: "text", text: "Error: repo parameter is required" }],
        isError: true,
      };
    }

    if (!code) {
      return {
        content: [{ type: "text", text: "Error: code parameter is required" }],
        isError: true,
      };
    }

    const workosUserId = props.user?.id!;

    // Verify access
    const repos = await getUserRepos(env, workosUserId);
    const repoDoc = repos.find((r) => r.fullName === repo);

    if (!repoDoc) {
      return {
        content: [{ type: "text", text: `Access denied: ${repo}` }],
        isError: true,
      };
    }

    // Get installation ID
    const installationId =
      typeof repoDoc.installation === "object"
        ? repoDoc.installation.installationId
        : null;

    if (!installationId) {
      return {
        content: [{ type: "text", text: "Error: No installation found for repo" }],
        isError: true,
      };
    }

    // Wrap user code with sandbox client imports
    const wrappedCode = `
import { issues, milestones, github, todo, log } from 'sandbox-client.js';

export async function run() {
  ${code}
}
`;

    // Execute in sandbox
    const result = await executeSandboxedWorkflow(env, ctx, {
      id: `mcp-do-${repo}-${Date.now()}`,
      repoFullName: repo,
      installationId,
      code: wrappedCode,
      entrypoint: "run",
    });

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (e: any) {
    return {
      content: [{ type: "text", text: `Execution error: ${e.message}` }],
      isError: true,
    };
  }
}
