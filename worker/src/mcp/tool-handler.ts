/**
 * MCP Tool Handler
 *
 * Handles MCP tool calls for both OAuth and WorkOS JWT authentication paths.
 * This extracts the tool execution logic so it can be reused.
 */

import type { Props } from "./props";
import type { Env } from "../types";
import { executeSandboxedWorkflow } from "../sandbox";

interface ToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

/**
 * Get repos the authenticated user has access to
 */
async function getUserRepos(env: Env, workosUserId: string): Promise<any[]> {
  const userResult = await env.PAYLOAD.find({
    collection: "users",
    where: { workosUserId: { equals: workosUserId } },
    limit: 1,
    overrideAccess: true,
  });

  if (!userResult.docs?.length) {
    return [];
  }

  const payloadUserId = userResult.docs[0].id;

  const installationsResult = await env.PAYLOAD.find({
    collection: "installations",
    where: { users: { contains: payloadUserId } },
    limit: 100,
    overrideAccess: true,
  });

  if (!installationsResult.docs?.length) {
    return [];
  }

  const installationIds = installationsResult.docs.map((i: any) => i.id);

  const reposResult = await env.PAYLOAD.find({
    collection: "repos",
    where: { installation: { in: installationIds } },
    limit: 100,
    overrideAccess: true,
  });

  return reposResult.docs || [];
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
 * Search tool handler
 */
async function handleSearch(
  args: { query: string; limit?: number },
  props: Props,
  env: Env
): Promise<ToolResult> {
  try {
    const { query, limit = 20 } = args;
    const workosUserId = props.user?.id!;
    const repos = await getUserRepos(env, workosUserId);

    const results: Array<{
      id: string;
      title: string;
      repo: string;
      status: string;
      url: string;
    }> = [];

    for (const repo of repos) {
      const doId = env.REPO.idFromName(repo.fullName);
      const stub = env.REPO.get(doId);

      try {
        const response = await stub.fetch(
          new Request("http://do/issues/search", {
            method: "POST",
            body: JSON.stringify({ query, limit: Math.min(limit, 50) }),
            headers: { "Content-Type": "application/json" },
          })
        );

        if (response.ok) {
          const data = (await response.json()) as any;
          for (const issue of data.results || []) {
            results.push({
              id: issue.id,
              title: issue.title,
              repo: repo.fullName,
              status: issue.status || "open",
              url: `https://github.com/${repo.fullName}/issues/${issue.githubNumber}`,
            });
          }
        }
      } catch (e) {
        console.error(`Search failed for ${repo.fullName}:`, e);
      }
    }

    return {
      content: [{ type: "text", text: JSON.stringify(results.slice(0, limit)) }],
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
